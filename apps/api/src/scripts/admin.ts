import bcrypt from "bcryptjs";
import { prisma } from "@livestock/db";
import { Role } from "@livestock/shared";
import { config } from "../config";

const usage = () => {
  console.log(`\nAdmin CLI (uses DATABASE_URL from .env):\n\n` +
    `  npm run admin --workspace @livestock/api -- --list\n` +
    `  npm run admin --workspace @livestock/api -- --create --email=... --password=... --role=admin|manager|viewer\n` +
    `  npm run admin --workspace @livestock/api -- --set-password --email=... --password=...\n` +
    `  npm run admin --workspace @livestock/api -- --set-role --email=... --role=admin|manager|viewer\n` +
    `  npm run admin --workspace @livestock/api -- --revoke-tokens --email=...\n`
  );
};

const parseFlags = (argv: string[]) => {
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const [key, ...rest] = raw.split("=");
    flags[key] = rest.length ? rest.join("=") : true;
  }
  return flags;
};

const getString = (flags: Record<string, string | boolean>, key: string) => {
  const val = flags[key];
  return typeof val === "string" ? val : undefined;
};

const parseRole = (value?: string): Role => {
  if (value === "admin" || value === "manager" || value === "viewer") return value as Role;
  throw new Error("role must be one of: admin, manager, viewer");
};

const main = async () => {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.help || flags.h) {
    usage();
    return;
  }

  if (flags.list) {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, email: true, role: true, created_at: true, updated_at: true },
    });
    console.table(users.map((u) => ({
      id: Number(u.id),
      email: u.email,
      role: u.role,
      created_at: u.created_at.toISOString(),
      updated_at: u.updated_at.toISOString(),
    })));
    return;
  }

  if (flags.create) {
    const email = getString(flags, "email");
    const password = getString(flags, "password");
    const role = parseRole(getString(flags, "role"));
    if (!email || !password) throw new Error("--email and --password are required");

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new Error(`user already exists: ${email}`);

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash, role } });
    console.log(`created user ${user.email} (${user.role})`);
    return;
  }

  if (flags["set-password"]) {
    const email = getString(flags, "email");
    const password = getString(flags, "password");
    if (!email || !password) throw new Error("--email and --password are required");

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email }, data: { password: hash } });
    console.log(`updated password for ${email}`);
    return;
  }

  if (flags["set-role"]) {
    const email = getString(flags, "email");
    const role = parseRole(getString(flags, "role"));
    if (!email) throw new Error("--email is required");

    await prisma.user.update({ where: { email }, data: { role } });
    console.log(`updated role for ${email} -> ${role}`);
    return;
  }

  if (flags["revoke-tokens"]) {
    const email = getString(flags, "email");
    if (!email) throw new Error("--email is required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`user not found: ${email}`);

    const res = await prisma.refreshToken.updateMany({
      where: { user_id: user.id, revoked: false },
      data: { revoked: true },
    });
    console.log(`revoked ${res.count} refresh tokens for ${email}`);
    return;
  }

  usage();
};

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
