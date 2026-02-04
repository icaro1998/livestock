import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log("DATABASE_URL missing; skipping db health test.");
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("db health ok");
} catch (err) {
  console.error("db health failed", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
