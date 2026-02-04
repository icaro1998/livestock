import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import buildServer from "../index";
import { bulkCreateCosts } from "../services/costs";
import { costCreateSchema } from "@livestock/shared";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const getArg = (name: string) => {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const printUsage = () => {
  console.log("Usage: npm run import:costs -- --file=path.csv [--dry-run] [--limit=N] [--max-errors=N] [--batch-size=N] [--report=path.json] [--allow-errors]");
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
const batchSizeRaw = getArg("batch-size");
const reportPath = getArg("report");

const limit = limitRaw ? Number(limitRaw) : undefined;
const maxErrors = maxErrorsRaw ? Number(maxErrorsRaw) : 50;
const batchSize = batchSizeRaw ? Number(batchSizeRaw) : 200;
if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
  console.error("--limit must be a positive number");
  process.exit(1);
}
if (!Number.isFinite(maxErrors) || maxErrors <= 0) {
  console.error("--max-errors must be a positive number");
  process.exit(1);
}
if (!Number.isFinite(batchSize) || batchSize <= 0) {
  console.error("--batch-size must be a positive number");
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
};

const errors: Array<{ row: number; message: string; data?: any }> = [];

const buildInput = (row: Record<string, any>, rowErrors: string[]) => {
  const costAt = validateDate(getField(row, "cost_at", "costat"), "cost_at", rowErrors);
  const input: any = {
    cost_at: costAt,
    scope: getField(row, "scope"),
    uid: getField(row, "uid"),
    group_code: getField(row, "group_code"),
    location_code: getField(row, "location_code"),
    category: getField(row, "category"),
    product_code: getField(row, "product_code"),
    party_code: getField(row, "party_code"),
    amount: parseNumber(getField(row, "amount"), "amount", rowErrors),
    currency: getField(row, "currency"),
    quantity: parseNumber(getField(row, "quantity"), "quantity", rowErrors),
    unit: getField(row, "unit"),
    source_ref: getField(row, "source_ref", "sourceref"),
    batch_id: getField(row, "batch_id", "batchid"),
    notes: getField(row, "notes"),
  };

  if (!input.cost_at) rowErrors.push("cost_at is required");
  if (!input.scope) rowErrors.push("scope is required");
  if (!input.category) rowErrors.push("category is required");
  if (input.amount === undefined) rowErrors.push("amount is required");

  return input;
};

const main = async () => {
  const app = dryRun ? null : buildServer();
  const batch: any[] = [];

  const flush = async () => {
    if (batch.length === 0 || dryRun) {
      batch.length = 0;
      return;
    }
    const created = await bulkCreateCosts(app as any, batch, "import-script");
    summary.imported += created.length;
    batch.length = 0;
  };

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
        const parsed = costCreateSchema.safeParse(input);
        if (!parsed.success) {
          summary.invalid += 1;
          const issues = parsed.error.issues.map((i) => i.message).join("; ");
          errors.push({ row: idx + 1, message: issues, data: row });
        } else if (dryRun) {
          summary.valid += 1;
          summary.imported += 1;
        } else {
          summary.valid += 1;
          batch.push(parsed.data);
          if (batch.length >= batchSize) await flush();
        }
      }

      if (errors.length >= maxErrors) {
        console.error(`Reached max errors (${maxErrors}). Aborting.`);
        break;
      }
    }

    await flush();
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
