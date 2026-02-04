import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import buildServer from "../index";
import { createEvent } from "../services/events";
import { eventCreateSchema } from "@livestock/shared";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const getArg = (name: string) => {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const printUsage = () => {
  console.log("Usage: npm run import:events -- --file=path.csv [--dry-run] [--limit=N] [--max-errors=N] [--report=path.json] [--allow-errors]");
};

if (flag("help") || flag("h")) {
  printUsage();
  process.exit(0);
}

const file = getArg("file");
if (!file) {
  printUsage();
  process.exit(1);
}

const resolved = path.resolve(file);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const dryRun = flag("dry-run") || flag("dry");
const allowErrors = flag("allow-errors");
const limitRaw = getArg("limit");
const maxErrorsRaw = getArg("max-errors");
const reportPath = getArg("report");

const limit = limitRaw ? Number(limitRaw) : undefined;
const maxErrors = maxErrorsRaw ? Number(maxErrorsRaw) : 50;
if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
  console.error("--limit must be a positive number");
  process.exit(1);
}
if (!Number.isFinite(maxErrors) || maxErrors <= 0) {
  console.error("--max-errors must be a positive number");
  process.exit(1);
}

const normalize = (row: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase()] = v;
  }
  return out;
};

const getField = (row: Record<string, any>, ...names: string[]) => {
  for (const name of names) {
    const key = name.trim().toLowerCase();
    const value = row[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") return value;
  }
  return undefined;
};

const parseNumber = (value: any, field: string, errors: string[]) => {
  if (value === undefined || value === null || `${value}`.trim() === "") return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) {
    errors.push(`Invalid number for ${field}`);
    return undefined;
  }
  return num;
};

const parseIntField = (value: any, field: string, errors: string[]) => {
  const num = parseNumber(value, field, errors);
  if (num === undefined) return undefined;
  if (!Number.isInteger(num)) {
    errors.push(`Invalid integer for ${field}`);
    return undefined;
  }
  return num;
};

const validateDate = (value: any, field: string, errors: string[]) => {
  if (value === undefined || value === null || `${value}`.trim() === "") return undefined;
  const str = `${value}`;
  const parsed = Date.parse(str);
  if (Number.isNaN(parsed)) {
    errors.push(`Invalid date for ${field}`);
  }
  return str;
};

const content = fs.readFileSync(resolved, "utf-8");
const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

const summary = {
  total: records.length,
  processed: 0,
  valid: 0,
  invalid: 0,
  imported: 0,
  deduped: 0,
};

const errors: Array<{ row: number; message: string; data?: any }> = [];

const buildInput = (row: Record<string, any>, rowErrors: string[]) => {
  const eventTypeRaw = getField(row, "event_type", "eventtype", "type");
  const eventType = eventTypeRaw ? `${eventTypeRaw}`.trim().toLowerCase() : undefined;
  const eventAt = validateDate(getField(row, "event_at", "eventat", "date"), "event_at", rowErrors);

  const input: any = {
    uid: getField(row, "uid"),
    event_at: eventAt,
    event_type: eventType,
    event_subtype: getField(row, "event_subtype", "eventsubtype"),
    source_ref: getField(row, "source_ref", "sourceref", "idempotency_key"),
    batch_id: getField(row, "batch_id", "batchid"),
    notes: getField(row, "notes"),
    confidence: parseNumber(getField(row, "confidence"), "confidence", rowErrors),
    location_from_code: getField(row, "location_from_code", "location_from"),
    location_to_code: getField(row, "location_to_code", "location_to"),
    group_code: getField(row, "group_code"),
    party_code: getField(row, "party_code"),
    product_code: getField(row, "product_code"),
    weight_kg: parseNumber(getField(row, "weight_kg"), "weight_kg", rowErrors),
    method: getField(row, "method"),
    shrink_pct: parseNumber(getField(row, "shrink_pct"), "shrink_pct", rowErrors),
    reason: getField(row, "reason"),
    distance_km: parseNumber(getField(row, "distance_km"), "distance_km", rowErrors),
    transport_party_code: getField(row, "transport_party_code"),
    repro_action: getField(row, "repro_action"),
    sire_uid: getField(row, "sire_uid"),
    dam_uid: getField(row, "dam_uid"),
    result: getField(row, "result"),
    calf_uid: getField(row, "calf_uid"),
    gestation_days: parseIntField(getField(row, "gestation_days"), "gestation_days", rowErrors),
    action: getField(row, "action"),
    diagnosis: getField(row, "diagnosis"),
    dose: parseNumber(getField(row, "dose"), "dose", rowErrors),
    dose_unit: getField(row, "dose_unit"),
    withdrawal_days: parseIntField(getField(row, "withdrawal_days"), "withdrawal_days", rowErrors),
    ration_code: getField(row, "ration_code"),
    intake_kg_day: parseNumber(getField(row, "intake_kg_day"), "intake_kg_day", rowErrors),
    supplement_code: getField(row, "supplement_code"),
  };

  if (!input.uid) rowErrors.push("uid is required");
  if (!input.event_at) rowErrors.push("event_at is required");
  if (!input.event_type) rowErrors.push("event_type is required");
  if (input.event_type === "movement") {
    if (!input.location_from_code || !input.location_to_code) {
      rowErrors.push("movement requires location_from_code and location_to_code");
    }
  }

  return input;
};

const main = async () => {
  const app = dryRun ? null : buildServer();

  try {
    for (let idx = 0; idx < records.length; idx += 1) {
      if (limit !== undefined && summary.processed >= limit) break;
      const row = normalize(records[idx]);
      summary.processed += 1;

      const rowErrors: string[] = [];
      const input = buildInput(row, rowErrors);

      if (rowErrors.length > 0) {
        summary.invalid += 1;
        errors.push({ row: idx + 1, message: rowErrors.join("; "), data: row });
      } else {
        const parsed = eventCreateSchema.safeParse(input);
        if (!parsed.success) {
          summary.invalid += 1;
          const issues = parsed.error.issues.map((i) => i.message).join("; ");
          errors.push({ row: idx + 1, message: issues, data: row });
        } else if (dryRun) {
          summary.valid += 1;
          summary.imported += 1;
        } else {
          summary.valid += 1;
          const result = await createEvent(app as any, parsed.data, "import-script");
          if (result.dedup) summary.deduped += 1;
          else summary.imported += 1;
        }
      }

      if (errors.length >= maxErrors) {
        console.error(`Reached max errors (${maxErrors}). Aborting.`);
        break;
      }
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }

  const report = { summary, errors };
  console.log(JSON.stringify(summary, null, 2));
  if (reportPath) {
    fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2));
  }
  if (errors.length > 0 && !allowErrors) {
    process.exitCode = 1;
  }
};

main();
