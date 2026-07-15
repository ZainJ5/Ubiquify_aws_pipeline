import { NextResponse } from "next/server";
import { startProvisionJob } from "@/lib/jobs";

export const runtime = "nodejs";

const IAM_NAME_RE = /^[\w+=,.@-]{1,64}$/;
const GROUPS = ["admin", "developers", "qa"];
const ENVIRONMENTS = ["staging", "production"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(payload) {
  if (!payload || typeof payload !== "object") return "Invalid request body.";

  const users = payload.users;
  if (!Array.isArray(users)) return "users must be a list.";
  if (users.length > 20) return "Too many users (max 20).";
  const seen = new Set();
  for (const u of users) {
    if (!u?.name || !IAM_NAME_RE.test(u.name))
      return `Invalid IAM user name: "${u?.name ?? ""}". Allowed: letters, digits, +=,.@-_`;
    if (seen.has(u.name)) return `Duplicate user name: "${u.name}".`;
    seen.add(u.name);
    if (!GROUPS.includes(u.group)) return `Invalid group for "${u.name}".`;
    if (!["temporary", "custom"].includes(u.passwordMode))
      return `Invalid password mode for "${u.name}".`;
    if (u.passwordMode === "custom" && (typeof u.password !== "string" || u.password.length < 8))
      return `Custom password for "${u.name}" must be at least 8 characters.`;
  }

  const services = payload.services;
  if (!services || typeof services !== "object") return "services must be an object.";
  for (const key of ["ec2", "ecr", "s3"]) {
    if (typeof services[key] !== "boolean") return `services.${key} must be true or false.`;
  }

  if (services.ec2) {
    if (
      !Array.isArray(payload.environments) ||
      payload.environments.length === 0 ||
      !payload.environments.every((e) => ENVIRONMENTS.includes(e))
    )
      return "Select at least one environment (staging / production) for EC2.";
  }

  if (services.ecr && payload.ecrRepoName && !/^[a-z0-9][a-z0-9._/-]{0,255}$/.test(payload.ecrRepoName))
    return "Invalid ECR repository name (lowercase letters, digits, . _ / -).";

  if (services.s3 && payload.s3BucketName && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(payload.s3BucketName))
    return "Invalid S3 bucket name (3-63 chars, lowercase letters, digits, . -).";

  if (payload.email?.send && !EMAIL_RE.test(payload.email?.to ?? ""))
    return "Enter a valid recipient email address.";

  return null;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const error = validate(payload);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const normalized = {
    users: payload.users.map((u) => ({
      name: u.name.trim(),
      group: u.group,
      passwordMode: u.passwordMode,
      password: u.passwordMode === "custom" ? u.password : null,
    })),
    services: { ec2: payload.services.ec2, ecr: payload.services.ecr, s3: payload.services.s3 },
    environments: payload.services.ec2 ? payload.environments : [],
    attachEip: Boolean(payload.attachEip),
    ecrRepoName: (payload.ecrRepoName || "").trim(),
    s3BucketName: (payload.s3BucketName || "").trim(),
    email: { send: Boolean(payload.email?.send), to: (payload.email?.to || "").trim() },
  };

  const job = startProvisionJob(normalized);
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
