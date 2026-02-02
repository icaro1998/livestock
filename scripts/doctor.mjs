import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

const checks = [
  { label: "Node.js", command: "node -v" },
  { label: "npm", command: "npm -v" },
  { label: "git", command: "git --version" },
  { label: "docker", command: "docker version" },
  { label: "docker compose", command: "docker compose version" }
];

const results = [];
let failed = false;

for (const check of checks) {
  try {
    const output = execSync(check.command, { stdio: "pipe" }).toString().trim();
    results.push({ ...check, ok: true, output });
  } catch (error) {
    results.push({ ...check, ok: false, output: error.message });
    failed = true;
  }
}

const envFile = existsSync(".env");
const composeFile = existsSync("infra/docker-compose.yml") || existsSync("docker-compose.yml");

console.log("Livestock ERP Doctor");
console.log(`Platform: ${platform()}`);
console.log("");

for (const result of results) {
  const status = result.ok ? "OK" : "MISSING";
  console.log(`[${status}] ${result.label}: ${result.output}`);
}

console.log("");
console.log(`[${envFile ? "OK" : "MISSING"}] .env file present`);
console.log(`[${composeFile ? "OK" : "MISSING"}] docker compose file present`);

if (!envFile) {
  console.log("Tip: copy .env.example to .env and fill in values.");
}

if (failed) {
  console.error("\nDoctor failed: missing required prerequisites.");
  process.exit(1);
}
