#!/usr/bin/env node
const { execSync } = require("child_process");
const { existsSync, mkdirSync } = require("fs");
const path = require("path");

const args = process.argv.slice(2);
let fileArg = args.find((a) => a.startsWith("--file="));
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const backupsDir = path.resolve(process.cwd(), "backups");
if (!existsSync(backupsDir)) mkdirSync(backupsDir);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = fileArg ? fileArg.split("=")[1] : path.join(backupsDir, `livestock-${timestamp}.dump`);

const cmd = `pg_dump -Fc -f "${target}" "${dbUrl}"`;
console.log(`Running: ${cmd}`);
execSync(cmd, { stdio: "inherit" });
console.log(`Backup created at ${target}`);
