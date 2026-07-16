import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { IAMClient, UpdateLoginProfileCommand } from "@aws-sdk/client-iam";
import nodemailer from "nodemailer";
import { TF_DIR, loadRootEnv } from "./env";

const jobs = globalThis.__ubiquifyJobs ?? (globalThis.__ubiquifyJobs = new Map());

export function getJob(id) {
  return jobs.get(id) ?? null;
}

export function startProvisionJob(payload) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: "running",
    phase: "starting",
    log: [],
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  runJob(job, payload).catch((err) => {
    job.status = "failed";
    job.error = String(err?.message ?? err);
    log(job, `ERROR: ${job.error}`);
  });
  return job;
}

function log(job, line) {
  job.log.push(line);
  if (job.log.length > 5000) job.log.splice(0, job.log.length - 5000);
}

function runCommand(job, command, args, env, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    log(job, `$ ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: TF_DIR,
      env: { ...process.env, ...env },
      windowsHide: true,
    });

    let stdout = "";
    const onData = (data, capture) => {
      const text = data.toString();
      if (capture) stdout += text;
      if (quiet) return; 
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) log(job, line);
      }
    };
    child.stdout.on("data", (d) => onData(d, true));
    child.stderr.on("data", (d) => onData(d, false));

    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `Could not find "${command}". Install Terraform and make sure it is on PATH, ` +
              `or set TERRAFORM_BIN in the root .env to its full path.`
          )
        );
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} ${args[0]} exited with code ${code}`));
    });
  });
}

async function runJob(job, payload) {
  const rootEnv = loadRootEnv();
  const terraform = rootEnv.TERRAFORM_BIN || process.env.TERRAFORM_BIN || "terraform";
  const awsEnv = {
    AWS_ACCESS_KEY_ID: rootEnv.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    AWS_SECRET_ACCESS_KEY:
      rootEnv.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    AWS_DEFAULT_REGION: "us-east-1",
  };
  if (!awsEnv.AWS_ACCESS_KEY_ID || !awsEnv.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not found in the root .env file.");
  }

  job.phase = "writing tfvars";
  const tfvars = {
    users: payload.users.map((u) => ({ name: u.name, group: u.group })),
    create_ec2: payload.services.ec2,
    environments: payload.environments,
    attach_eip: payload.services.ec2 && payload.attachEip,
    create_ecr: payload.services.ecr,
    ecr_repo_name: payload.ecrRepoName || "app-repo",
    create_s3: payload.services.s3,
    s3_bucket_name: payload.s3BucketName || "",
  };
  fs.writeFileSync(
    path.join(TF_DIR, "terraform.tfvars.json"),
    JSON.stringify(tfvars, null, 2)
  );
  log(job, "Wrote terraform.tfvars.json");

  if (!fs.existsSync(path.join(TF_DIR, ".terraform"))) {
    job.phase = "terraform init";
    await runCommand(job, terraform, ["init", "-input=false", "-no-color"], awsEnv);
  }

  job.phase = "terraform apply";
  await runCommand(
    job,
    terraform,
    ["apply", "-auto-approve", "-input=false", "-no-color"],
    awsEnv
  );

  job.phase = "reading outputs";
  const outputJson = await runCommand(job, terraform, ["output", "-json", "-no-color"], awsEnv, {
    quiet: true,
  });
  log(job, "Outputs collected (values hidden from log).");
  const outputs = JSON.parse(outputJson);
  const value = (name, fallback) => outputs[name]?.value ?? fallback;

  const credentials = value("user_credentials", {});
  const serverIps = value("server_ips", {});

  const passwordFailures = {};
  const customUsers = payload.users.filter((u) => u.passwordMode === "custom");
  if (customUsers.length > 0) {
    job.phase = "setting custom passwords";
    const iam = new IAMClient({
      region: "us-east-1",
      credentials: {
        accessKeyId: awsEnv.AWS_ACCESS_KEY_ID,
        secretAccessKey: awsEnv.AWS_SECRET_ACCESS_KEY,
      },
    });
    for (const user of customUsers) {
      try {
        await iam.send(
          new UpdateLoginProfileCommand({
            UserName: user.name,
            Password: user.password,
            PasswordResetRequired: false,
          })
        );
        log(job, `Set custom password for user "${user.name}"`);
      } catch (err) {
        // A policy rejection must not fail the job — the infrastructure is
        // already created. Keep the temporary password and report the reason.
        passwordFailures[user.name] = String(err?.message ?? err);
        log(
          job,
          `Could not set custom password for "${user.name}": ${passwordFailures[user.name]} — keeping the temporary password.`
        );
      }
    }
  }

  const users = payload.users.map((u) => {
    const usedCustom = u.passwordMode === "custom" && !passwordFailures[u.name];
    return {
      name: u.name,
      group: u.group,
      passwordMode: usedCustom ? "custom" : "temporary",
      password: usedCustom ? null : credentials[u.name] ?? null,
      passwordError: passwordFailures[u.name] ?? null,
    };
  });

  const result = {
    consoleSigninUrl: value("console_signin_url", null),
    serverIps,
    elasticIpAttached: tfvars.attach_eip,
    ecrRepositoryUrl: value("ecr_repository_url", null),
    s3BucketName: value("s3_bucket_name", null),
    users,
    emailSent: false,
    emailError: null,
  };

  if (payload.email?.send && payload.email?.to) {
    job.phase = "sending email";
    try {
      await sendDetailsEmail(rootEnv, payload.email.to, result);
      result.emailSent = true;
      log(job, `Email sent to ${payload.email.to}`);
    } catch (err) {
      const smtpError = String(err?.message ?? err);
      log(job, `Direct SMTP failed: ${smtpError}`);
      try {
        await dispatchEmailWorkflow(rootEnv, payload.email.to);
        result.emailSent = true;
        log(job, `Email queued via GitHub Actions for ${payload.email.to}`);
      } catch (ghErr) {
        result.emailError = `${smtpError}; GitHub Actions fallback: ${String(
          ghErr?.message ?? ghErr
        )}`;
        log(job, `Email failed: ${result.emailError}`);
      }
    }
  }

  job.result = result;
  job.phase = "done";
  job.status = "succeeded";
  log(job, "Provisioning complete.");
}

function buildDetailsText(result) {
  const lines = [`Console Sign-in URL: ${result.consoleSigninUrl}`, ""];
  for (const [env, ip] of Object.entries(result.serverIps)) {
    const label = env.charAt(0).toUpperCase() + env.slice(1);
    lines.push(`${label} Server IP: ${ip}${result.elasticIpAttached ? " (Elastic IP)" : ""}`);
  }
  if (result.ecrRepositoryUrl) lines.push(`ECR Repository: ${result.ecrRepositoryUrl}`);
  if (result.s3BucketName) lines.push(`S3 Bucket: ${result.s3BucketName}`);
  lines.push("");
  for (const user of result.users) {
    lines.push(
      user.passwordMode === "custom"
        ? `${user.name} (${user.group}) -> custom password (set during provisioning)`
        : `${user.name} (${user.group}) -> temporary password: ${user.password} (must be changed on first login)`
    );
  }
  return lines.join("\n");
}

async function dispatchEmailWorkflow(rootEnv, to) {
  const token = rootEnv.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN not set in the root .env (needed to dispatch the email workflow)."
    );
  }
  const repo = rootEnv.GITHUB_REPO || process.env.GITHUB_REPO || "ZainJ5/Ubiquify_aws_pipeline";
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/email.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { to } }),
    }
  );
  if (res.status !== 204) {
    throw new Error(`GitHub API returned ${res.status}: ${await res.text()}`);
  }
}

async function sendDetailsEmail(rootEnv, to, result) {
  const user = rootEnv.MAIL_USERNAME || process.env.MAIL_USERNAME;
  const pass = rootEnv.MAIL_PASSWORD || process.env.MAIL_PASSWORD;
  if (!user || !pass) {
    throw new Error("MAIL_USERNAME / MAIL_PASSWORD not set in the root .env file.");
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4, 
    connectionTimeout: 15000,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"Ubiquify Pipeline" <${user}>`,
    to,
    subject: "AWS Environment Details",
    text: buildDetailsText(result),
  });
}
