#!/usr/bin/env node
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

if (!fileArg) {
  console.error("Usage: npm run db:restore -- --file=path.dump");
  process.exit(1);
}

const file = fileArg.split("=")[1];
const cmd = `pg_restore --clean --if-exists -d "${dbUrl}" "${file}"`;
console.log(`Running: ${cmd}`);
execSync(cmd, { stdio: "inherit" });
console.log("Restore completed");
