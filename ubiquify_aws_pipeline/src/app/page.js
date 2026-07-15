"use client";

import { useEffect, useRef, useState } from "react";

const GROUPS = [
  { value: "admin", label: "Admin (AdministratorAccess)" },
  { value: "developers", label: "Developer (PowerUserAccess)" },
  { value: "qa", label: "QA (ReadOnlyAccess)" },
];

const emptyUser = () => ({ name: "", group: "developers", passwordMode: "temporary", password: "" });

export default function Home() {
  const [users, setUsers] = useState([
    { name: "admin", group: "admin", passwordMode: "temporary", password: "" },
    { name: "developer", group: "developers", passwordMode: "temporary", password: "" },
    { name: "qa", group: "qa", passwordMode: "temporary", password: "" },
  ]);
  const [services, setServices] = useState({ ec2: true, ecr: false, s3: false });
  const [environments, setEnvironments] = useState(["staging", "production"]);
  const [attachEip, setAttachEip] = useState(true);
  const [ecrRepoName, setEcrRepoName] = useState("app-repo");
  const [s3BucketName, setS3BucketName] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [emailTo, setEmailTo] = useState("");

  const [job, setJob] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const logRef = useRef(null);

  const running = job?.status === "running" || submitting;

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) setJob(await res.json());
    }, 2500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.log?.length]);

  const updateUser = (i, patch) =>
    setUsers((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

  const toggleEnv = (env) =>
    setEnvironments((prev) =>
      prev.includes(env) ? prev.filter((e) => e !== env) : [...prev, env]
    );

  async function submit(e) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    setJob(null);
    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users,
          services,
          environments,
          attachEip,
          ecrRepoName,
          s3BucketName,
          email: { send: sendEmail, to: emailTo },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Request failed.");
        return;
      }
      setJob({ id: data.jobId, status: "running", phase: "starting", log: [] });
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const result = job?.result;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Ubiquify AWS Provisioning</h1>
      <p className="mt-1 text-sm opacity-70">
        Configure IAM users and AWS services, then provision them with Terraform. The resulting
        details are shown below and emailed to you.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        {/* Users */}
        <section className="rounded-xl border border-black/10 dark:border-white/15 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">IAM Users</h2>
            <button
              type="button"
              onClick={() => setUsers((prev) => [...prev, emptyUser()])}
              className="rounded-lg border border-black/15 dark:border-white/20 px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              + Add user
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {users.length === 0 && (
              <p className="text-sm opacity-60">No users — only services will be provisioned.</p>
            )}
            {users.map((user, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  value={user.name}
                  onChange={(e) => updateUser(i, { name: e.target.value })}
                  placeholder="username"
                  required
                  className="rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
                />
                <select
                  value={user.group}
                  onChange={(e) => updateUser(i, { group: e.target.value })}
                  className="rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm dark:[&>option]:bg-neutral-900"
                >
                  {GROUPS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    value={user.passwordMode}
                    onChange={(e) => updateUser(i, { passwordMode: e.target.value })}
                    className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm dark:[&>option]:bg-neutral-900"
                  >
                    <option value="temporary">Temporary password</option>
                    <option value="custom">Custom password</option>
                  </select>
                  {user.passwordMode === "custom" && (
                    <input
                      type="password"
                      value={user.password}
                      onChange={(e) => updateUser(i, { password: e.target.value })}
                      placeholder="min 8 chars"
                      minLength={8}
                      required
                      className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setUsers((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                  title="Remove user"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs opacity-60">
            Temporary passwords are generated by AWS and must be changed on first login. Custom
            passwords are set exactly as entered.
          </p>
        </section>

        {/* Services */}
        <section className="rounded-xl border border-black/10 dark:border-white/15 p-5">
          <h2 className="font-semibold">AWS Services</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={services.ec2}
                  onChange={(e) => setServices((s) => ({ ...s, ec2: e.target.checked }))}
                />
                EC2 App Servers
              </label>
              {services.ec2 && (
                <div className="mt-3 ml-6 space-y-2 text-sm">
                  <div className="flex gap-5">
                    {["staging", "production"].map((env) => (
                      <label key={env} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={environments.includes(env)}
                          onChange={() => toggleEnv(env)}
                        />
                        {env}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachEip}
                      onChange={(e) => setAttachEip(e.target.checked)}
                    />
                    Attach an Elastic IP to each server
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={services.ecr}
                  onChange={(e) => setServices((s) => ({ ...s, ecr: e.target.checked }))}
                />
                ECR Container Registry
              </label>
              {services.ecr && (
                <div className="mt-3 ml-6">
                  <input
                    value={ecrRepoName}
                    onChange={(e) => setEcrRepoName(e.target.value)}
                    placeholder="repository name"
                    className="w-full max-w-xs rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={services.s3}
                  onChange={(e) => setServices((s) => ({ ...s, s3: e.target.checked }))}
                />
                S3 Bucket
              </label>
              {services.s3 && (
                <div className="mt-3 ml-6">
                  <input
                    value={s3BucketName}
                    onChange={(e) => setS3BucketName(e.target.value)}
                    placeholder="bucket name (blank = auto-generated)"
                    className="w-full max-w-xs rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Email */}
        <section className="rounded-xl border border-black/10 dark:border-white/15 p-5">
          <h2 className="font-semibold">Email Notification</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              Email the details to:
            </label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="recipient@example.com"
              required={sendEmail}
              disabled={!sendEmail}
              className="w-full max-w-sm rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm disabled:opacity-40"
            />
          </div>
        </section>

        {submitError && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={running}
          className="w-full rounded-xl bg-foreground px-6 py-3 font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Provisioning…" : "Provision Infrastructure"}
        </button>
      </form>

      {/* Progress + log */}
      {job && (
        <section className="mt-8 rounded-xl border border-black/10 dark:border-white/15 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {job.status === "running" && `Running — ${job.phase}`}
              {job.status === "succeeded" && "✅ Provisioning succeeded"}
              {job.status === "failed" && "❌ Provisioning failed"}
            </h2>
            {job.status === "running" && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </div>
          {job.error && <p className="mt-2 text-sm text-red-500">{job.error}</p>}
          <pre
            ref={logRef}
            className="mt-4 max-h-72 overflow-auto rounded-lg bg-black/90 p-4 font-mono text-xs leading-relaxed text-green-300"
          >
            {job.log?.join("\n") || "Waiting for output…"}
          </pre>
        </section>
      )}

      {/* Results */}
      {result && (
        <section className="mt-8 rounded-xl border border-emerald-500/40 p-5">
          <h2 className="font-semibold">Environment Details</h2>

          <div className="mt-4 space-y-4 text-sm">
            {result.consoleSigninUrl && (
              <p>
                <span className="font-medium">Console sign-in:</span>{" "}
                <a
                  href={result.consoleSigninUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 underline"
                >
                  {result.consoleSigninUrl}
                </a>
              </p>
            )}

            {Object.keys(result.serverIps || {}).length > 0 && (
              <div>
                <p className="font-medium">
                  Servers {result.elasticIpAttached ? "(Elastic IPs)" : "(public IPs)"}:
                </p>
                <ul className="mt-1 ml-5 list-disc">
                  {Object.entries(result.serverIps).map(([env, ip]) => (
                    <li key={env}>
                      {env}: <code className="font-mono">{ip}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.ecrRepositoryUrl && (
              <p>
                <span className="font-medium">ECR repository:</span>{" "}
                <code className="font-mono">{result.ecrRepositoryUrl}</code>
              </p>
            )}
            {result.s3BucketName && (
              <p>
                <span className="font-medium">S3 bucket:</span>{" "}
                <code className="font-mono">{result.s3BucketName}</code>
              </p>
            )}

            {result.users?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="mt-2 w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/15 dark:border-white/20">
                      <th className="py-2 pr-4 font-medium">User</th>
                      <th className="py-2 pr-4 font-medium">Group</th>
                      <th className="py-2 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.users.map((u) => (
                      <tr key={u.name} className="border-b border-black/5 dark:border-white/10">
                        <td className="py-2 pr-4 font-mono">{u.name}</td>
                        <td className="py-2 pr-4">{u.group}</td>
                        <td className="py-2 font-mono">
                          {u.passwordMode === "custom"
                            ? "custom (as entered)"
                            : u.password ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs opacity-60">
                  Temporary passwords must be changed on first login.
                </p>
              </div>
            )}

            <p>
              {result.emailSent && (
                <span className="text-emerald-500">📧 Details emailed successfully.</span>
              )}
              {result.emailError && (
                <span className="text-red-500">Email failed: {result.emailError}</span>
              )}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
