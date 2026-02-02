#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const restoreArg = args.find((a) => a.startsWith("--restore-url="));
const dbUrl = process.env.DATABASE_URL;
const restoreUrl = restoreArg ? restoreArg.split("=")[1] : process.env.RESTORE_DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const backupsDir = path.resolve(process.cwd(), "backups");
if (!existsSync(backupsDir)) mkdirSync(backupsDir);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = fileArg ? fileArg.split("=")[1] : path.join(backupsDir, `livestock-${timestamp}.dump`);

const run = (cmd) => {
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

run(`pg_dump -Fc -f "${target}" "${dbUrl}"`);

if (!existsSync(target) || statSync(target).size === 0) {
  console.error("Backup file missing or empty.");
  process.exit(1);
}

run(`pg_restore --list "${target}" > ${process.platform === "win32" ? "NUL" : "/dev/null"}`);
console.log(`Backup verified at ${target}`);

if (!restoreUrl) {
  console.log("Restore skipped. Set RESTORE_DATABASE_URL or pass --restore-url=... to run restore.");
  process.exit(0);
}

console.warn("Restoring into RESTORE_DATABASE_URL (this overwrites target DB).\n");
run(`pg_restore --clean --if-exists -d "${restoreUrl}" "${target}"`);
console.log("Restore completed.");
