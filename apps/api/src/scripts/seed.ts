import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "@livestock/db";
import { config } from "../config";
import bcrypt from "bcryptjs";

const bool = (val: string | undefined, def = false) => {
  if (val === undefined) return def;
  return ["1", "true", "yes", "on"].includes(val.toLowerCase());
};

const normalizeHeader = (value: string) =>
  value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");

const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const normalizeSex = (value: unknown) => {
  const str = normalizeValue(value);
  if (!str) return null;
  const normalized = str.toUpperCase();
  if (normalized === "M" || normalized === "F") return normalized;
  return null;
};

const seedUsers = async () => {
  const count = await prisma.user.count();
  if (count === 0) {
    const password = await bcrypt.hash("admin1234", 10);
    await prisma.user.create({ data: { email: "admin@example.com", password, role: "admin" } });
    console.log("Created bootstrap admin admin@example.com / admin1234");
  }
};

const seedAnimals = async () => {
  const csvPath = path.resolve(config.animalsCsvPath);
  if (!fs.existsSync(csvPath)) {
    const message = `Seed CSV not found at ${csvPath}`;
    if (bool(process.env.SEED_STRICT, false)) {
      throw new Error(message);
    }
    console.warn(`${message}, skipping animals.`);
    return;
  }
  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parse(content, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  });

  const seen = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];
  let processed = 0;
  let skipped = 0;

  for (let index = 0; index < records.length; index++) {
    const row = records[index];
    const lineNo = index + 2;
    const uid = normalizeValue(row.uid);

    if (!uid) {
      errors.push(`row ${lineNo}: missing uid`);
      skipped++;
      continue;
    }

    if (seen.has(uid)) {
      warnings.push(`row ${lineNo}: duplicate uid ${uid} (skipped)`);
      skipped++;
      continue;
    }
    seen.add(uid);

    const sex = normalizeSex(row.sex);
    if (row.sex && !sex) {
      warnings.push(`row ${lineNo}: invalid sex "${row.sex}" (set to null)`);
    }

    await prisma.animal.upsert({
      where: { uid },
      update: {
        eid: normalizeValue(row.eid),
        vid: normalizeValue(row.vid),
        sex,
        race: normalizeValue(row.race),
        brand_mark: normalizeValue(row.brand_mark) || normalizeValue(row.brand),
      },
      create: {
        uid,
        eid: normalizeValue(row.eid),
        vid: normalizeValue(row.vid),
        sex,
        race: normalizeValue(row.race),
        brand_mark: normalizeValue(row.brand_mark) || normalizeValue(row.brand),
      },
    });
    processed++;
  }

  console.log(`Seeded ${processed} animals (${skipped} skipped)`);
  if (warnings.length) {
    console.warn(`Seed warnings (showing up to 5):\n- ${warnings.slice(0, 5).join("\n- ")}`);
  }
  if (errors.length) {
    console.error(`Seed errors (showing up to 5):\n- ${errors.slice(0, 5).join("\n- ")}`);
    if (bool(process.env.SEED_STRICT, false)) {
      throw new Error(`Seed failed with ${errors.length} error(s).`);
    }
  }
};

const main = async () => {
  try {
    await seedUsers();
    await seedAnimals();
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
};

main();
