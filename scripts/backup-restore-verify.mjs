#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const restoreArg = args.find((a) => a.startsWith("--restore-url="));
const dbUrl = process.env.DATABASE_URL;
const restoreUrl = restoreArg ? restoreArg.split("=")[1] : process.env.RESTORE_DATABASE_URL;
const isWindows = process.platform === "win32";
const nullDevice = isWindows ? "NUL" : "/dev/null";

const commandExists = (cmd) => {
  try {
    execSync(isWindows ? `where ${cmd}` : `command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const parseUrl = (url) => {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    host: parsed.hostname,
    db: parsed.pathname.replace(/^\//, ""),
  };
};

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

const pgDumpAvailable = commandExists("pg_dump");
const pgRestoreAvailable = commandExists("pg_restore");
const preferDocker = Boolean(process.env.POSTGRES_CONTAINER);

const repoRoot = process.cwd();
const composeFile = path.resolve(repoRoot, "infra", "docker-compose.yml");
const detectContainer = () => {
  if (process.env.POSTGRES_CONTAINER) return process.env.POSTGRES_CONTAINER;
  try {
    const out = execSync(`docker compose -f "${composeFile}" ps -q postgres`, {
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (out) return out;
  } catch {}
  try {
    const out = execSync(`docker ps --filter "name=infra-postgres-1" --format "{{.ID}}"`, {
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (out) return out;
  } catch {}
  return null;
};

const runPgDump = () => {
  const container = detectContainer();
  if (!preferDocker && pgDumpAvailable) {
    run(`pg_dump -Fc -f "${target}" "${dbUrl}"`);
    return { method: "host" };
  }
  if (!container) {
    throw new Error(
      "pg_dump not found and no postgres container detected. Install PostgreSQL client tools or start docker compose."
    );
  }
  const { user, password, db } = parseUrl(dbUrl);
  if (!user || !db) {
    throw new Error("DATABASE_URL must include username and database name for docker fallback.");
  }
  const passwordArg = password ? `-e PGPASSWORD="${password}" ` : "";
  run(`docker exec ${passwordArg}-i ${container} pg_dump -Fc -U ${user} -d ${db} > "${target}"`);
  return { method: "docker", container };
};

const runPgRestoreList = (methodInfo) => {
  if (!preferDocker && pgRestoreAvailable) {
    run(`pg_restore --list "${target}" > ${nullDevice}`);
    return;
  }
  if (methodInfo.method === "docker") {
    run(`docker exec -i ${methodInfo.container} pg_restore --list < "${target}" > ${nullDevice}`);
    return;
  }
  console.warn("pg_restore not found; skipping dump list verification.");
};

const methodInfo = runPgDump();

if (!existsSync(target) || statSync(target).size === 0) {
  console.error("Backup file missing or empty.");
  process.exit(1);
}

runPgRestoreList(methodInfo);
console.log(`Backup verified at ${target}`);

if (!restoreUrl) {
  console.log("Restore skipped. Set RESTORE_DATABASE_URL or pass --restore-url=... to run restore.");
  process.exit(0);
}

console.warn("Restoring into RESTORE_DATABASE_URL (this overwrites target DB).\n");
if (!preferDocker && pgRestoreAvailable) {
  run(`pg_restore --clean --if-exists -d "${restoreUrl}" "${target}"`);
} else if (methodInfo.method === "docker") {
  const { user, password, db } = parseUrl(restoreUrl);
  if (!user || !db) {
    throw new Error("RESTORE_DATABASE_URL must include username and database name for docker restore.");
  }
  const passwordArg = password ? `-e PGPASSWORD="${password}" ` : "";
  run(`docker exec ${passwordArg}-i ${methodInfo.container} pg_restore --clean --if-exists -U ${user} -d ${db} < "${target}"`);
} else {
  throw new Error("pg_restore not found. Install PostgreSQL client tools to restore.");
}
console.log("Restore completed.");
