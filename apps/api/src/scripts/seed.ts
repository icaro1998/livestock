import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "@livestock/db";
import { config } from "../config";
import bcrypt from "bcryptjs";

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
    console.warn(`Seed CSV not found at ${csvPath}, skipping animals.`);
    return;
  }
  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true });
  let inserted = 0;
  for (const row of records) {
    const uid = row.uid || row.UID || row.Uid || row["UID "] || row["uid "];
    if (!uid) continue;
    await prisma.animal.upsert({
      where: { uid },
      update: {
        eid: row.eid || row.EID || null,
        vid: row.vid || row.VID || null,
        sex: row.sex || row.SEX || null,
        race: row.race || row.RACE || null,
        brand_mark: row.brand_mark || row.brand || null,
      },
      create: {
        uid,
        eid: row.eid || row.EID || null,
        vid: row.vid || row.VID || null,
        sex: row.sex || row.SEX || null,
        race: row.race || row.RACE || null,
        brand_mark: row.brand_mark || row.brand || null,
      },
    });
    inserted++;
  }
  console.log(`Seeded ${inserted} animals`);
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
