import fs from "fs";
import path from "path";

// The Terraform configuration lives in the repo root, one level above this app
export const TF_DIR = process.env.TF_DIR || path.resolve(process.cwd(), "..");

// Parse the repo-root .env file (supports `export KEY=VALUE` lines)
export function loadRootEnv() {
  const envPath = path.join(TF_DIR, ".env");
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[match[1]] = value;
  }
  return vars;
}
