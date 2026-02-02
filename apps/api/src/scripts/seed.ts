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

const strict = bool(process.env.SEED_STRICT, false);
const dryRun = bool(process.env.SEED_DRY_RUN, false);

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
  if (["M", "MALE", "MACHO"].includes(normalized)) return "M";
  if (["F", "FEMALE", "HEMBRA"].includes(normalized)) return "F";
  return null;
};

const parseBoolean = (value: unknown, lineNo: number, field: string, errors: string[]) => {
  const str = normalizeValue(value);
  if (!str) return null;
  const normalized = str.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  errors.push(`row ${lineNo}: invalid boolean "${value}" for ${field}`);
  return null;
};

const parseIntField = (
  value: unknown,
  lineNo: number,
  field: string,
  errors: string[],
  opts: { min?: number; max?: number } = {}
) => {
  const str = normalizeValue(value);
  if (!str) return null;
  const num = Number(str);
  if (!Number.isInteger(num)) {
    errors.push(`row ${lineNo}: invalid integer "${value}" for ${field}`);
    return null;
  }
  if (opts.min !== undefined && num < opts.min) {
    errors.push(`row ${lineNo}: ${field} must be >= ${opts.min}`);
    return null;
  }
  if (opts.max !== undefined && num > opts.max) {
    errors.push(`row ${lineNo}: ${field} must be <= ${opts.max}`);
    return null;
  }
  return num;
};

const parseDateField = (value: unknown, lineNo: number, field: string, errors: string[]) => {
  const str = normalizeValue(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`row ${lineNo}: invalid date "${value}" for ${field}`);
    return null;
  }
  return parsed;
};

const seedUsers = async () => {
  if (dryRun) {
    console.log("Dry run: skipping user seed.");
    return;
  }
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
  let headerList: string[] = [];
  const records = parse(content, {
    columns: (headers: string[]) => {
      const normalized = headers.map(normalizeHeader);
      headerList = normalized;
      return normalized;
    },
    skip_empty_lines: true,
    trim: true,
  });
  const headerSet = new Set(headerList);
  const hasColumn = (name: string) => headerSet.has(name);
  const knownColumns = new Set([
    "uid",
    "eid",
    "vid",
    "registration_at",
    "alert",
    "race",
    "sex",
    "color",
    "mother_name",
    "father_name",
    "brand_mark",
    "brand",
    "birth_year",
    "birth_month",
    "birth_place",
    "diagnostic",
    "warning",
    "notes",
  ]);

  const seen = new Set<string>();
  const seenEid = new Set<string>();
  const seenVid = new Set<string>();
  const existingEid = new Map<string, Set<string>>();
  const existingVid = new Map<string, Set<string>>();
  const errors: string[] = [];
  const warnings: string[] = [];
  let processed = 0;
  let skipped = 0;

  const unknownColumns = headerList.filter((col) => !knownColumns.has(col));
  if (unknownColumns.length) {
    const message = `unknown columns: ${unknownColumns.join(", ")}`;
    if (strict) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (hasColumn("eid") || hasColumn("vid")) {
    const eids = new Set<string>();
    const vids = new Set<string>();
    for (const row of records) {
      if (hasColumn("eid")) {
        const eid = normalizeValue(row.eid);
        if (eid) eids.add(eid);
      }
      if (hasColumn("vid")) {
        const vid = normalizeValue(row.vid);
        if (vid) vids.add(vid);
      }
    }
    const or: Array<Record<string, unknown>> = [];
    if (eids.size) or.push({ eid: { in: Array.from(eids) } });
    if (vids.size) or.push({ vid: { in: Array.from(vids) } });
    if (or.length) {
      const existing = await prisma.animal.findMany({
        where: { OR: or },
        select: { uid: true, eid: true, vid: true },
      });
      for (const row of existing) {
        if (row.eid) {
          const set = existingEid.get(row.eid) ?? new Set<string>();
          set.add(row.uid);
          existingEid.set(row.eid, set);
        }
        if (row.vid) {
          const set = existingVid.get(row.vid) ?? new Set<string>();
          set.add(row.uid);
          existingVid.set(row.vid, set);
        }
      }
    }
  }

  for (let index = 0; index < records.length; index++) {
    const row = records[index];
    const lineNo = index + 2;
    const rowErrors: string[] = [];
    const uid = normalizeValue(row.uid);

    if (!uid) {
      rowErrors.push(`row ${lineNo}: missing uid`);
      skipped++;
      continue;
    }

    if (seen.has(uid)) {
      const message = `row ${lineNo}: duplicate uid ${uid} (skipped)`;
      if (strict) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
      skipped++;
      continue;
    }
    seen.add(uid);

    let shouldSkip = false;
    const eid = normalizeValue(row.eid);
    if (eid) {
      if (seenEid.has(eid)) {
        const message = `row ${lineNo}: duplicate eid ${eid}`;
        if (strict) {
          errors.push(message);
          shouldSkip = true;
        } else {
          warnings.push(message);
        }
      } else {
        seenEid.add(eid);
      }
      const existingUids = existingEid.get(eid);
      if (existingUids && (existingUids.size > 1 || !existingUids.has(uid))) {
        const message = `row ${lineNo}: eid ${eid} already exists for uid ${Array.from(existingUids).join(", ")}`;
        if (strict) {
          errors.push(message);
          shouldSkip = true;
        } else {
          warnings.push(message);
        }
      }
    }

    const vid = normalizeValue(row.vid);
    if (vid) {
      if (seenVid.has(vid)) {
        const message = `row ${lineNo}: duplicate vid ${vid}`;
        if (strict) {
          errors.push(message);
          shouldSkip = true;
        } else {
          warnings.push(message);
        }
      } else {
        seenVid.add(vid);
      }
      const existingUids = existingVid.get(vid);
      if (existingUids && (existingUids.size > 1 || !existingUids.has(uid))) {
        const message = `row ${lineNo}: vid ${vid} already exists for uid ${Array.from(existingUids).join(", ")}`;
        if (strict) {
          errors.push(message);
          shouldSkip = true;
        } else {
          warnings.push(message);
        }
      }
    }
    if (shouldSkip) {
      skipped++;
      continue;
    }

    const sex = normalizeSex(row.sex);
    if (row.sex && !sex) {
      rowErrors.push(`row ${lineNo}: invalid sex "${row.sex}"`);
    }

    const registrationAt = hasColumn("registration_at")
      ? parseDateField(row.registration_at, lineNo, "registration_at", rowErrors)
      : null;
    const alert = hasColumn("alert") ? parseBoolean(row.alert, lineNo, "alert", rowErrors) : null;
    const birthYear = hasColumn("birth_year")
      ? parseIntField(row.birth_year, lineNo, "birth_year", rowErrors, { min: 1900, max: 2100 })
      : null;
    const birthMonth = hasColumn("birth_month")
      ? parseIntField(row.birth_month, lineNo, "birth_month", rowErrors, { min: 1, max: 12 })
      : null;

    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped++;
      continue;
    }

    const brandMark =
      (hasColumn("brand_mark") && normalizeValue(row.brand_mark)) ||
      (hasColumn("brand") && normalizeValue(row.brand)) ||
      null;

    const update: Record<string, unknown> = {};
    const create: Record<string, unknown> = { uid };
    const assign = (key: string, value: unknown) => {
      update[key] = value;
      create[key] = value;
    };
    const assignIfPresent = (key: string, value: unknown) => {
      if (hasColumn(key)) assign(key, value);
    };

    assignIfPresent("eid", eid);
    assignIfPresent("vid", vid);
    assignIfPresent("registration_at", registrationAt);
    assignIfPresent("alert", alert);
    assignIfPresent("race", normalizeValue(row.race));
    assignIfPresent("sex", sex);
    assignIfPresent("color", normalizeValue(row.color));
    assignIfPresent("mother_name", normalizeValue(row.mother_name));
    assignIfPresent("father_name", normalizeValue(row.father_name));
    if (hasColumn("brand_mark") || hasColumn("brand")) {
      assign("brand_mark", brandMark);
    }
    assignIfPresent("birth_year", birthYear);
    assignIfPresent("birth_month", birthMonth);
    assignIfPresent("birth_place", normalizeValue(row.birth_place));
    assignIfPresent("diagnostic", normalizeValue(row.diagnostic));
    assignIfPresent("warning", normalizeValue(row.warning));
    assignIfPresent("notes", normalizeValue(row.notes));

    if (!dryRun) {
      await prisma.animal.upsert({
        where: { uid },
        update,
        create,
      });
    }
    processed++;
  }

  if (dryRun) {
    console.log(`Dry run: validated ${processed} animals (${skipped} skipped). No DB writes.`);
  } else {
    console.log(`Seeded ${processed} animals (${skipped} skipped)`);
  }
  console.log(
    `Seed summary: total=${records.length} processed=${processed} skipped=${skipped} warnings=${warnings.length} errors=${errors.length}`
  );
  if (warnings.length) {
    console.warn(`Seed warnings (showing up to 5):\n- ${warnings.slice(0, 5).join("\n- ")}`);
  }
  if (errors.length) {
    console.error(`Seed errors (showing up to 5):\n- ${errors.slice(0, 5).join("\n- ")}`);
    if (strict) {
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
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

main();
