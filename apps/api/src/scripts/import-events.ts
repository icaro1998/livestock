import fs from "fs";
import { parse } from "csv-parse/sync";
import buildServer from "../index";
import { createEvent } from "../services/events";

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
if (!fileArg) {
  console.error("Usage: npm run import:events -- --file=path.csv");
  process.exit(1);
}
const file = fileArg.split("=")[1];
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const content = fs.readFileSync(file, "utf-8");
const records = parse(content, { columns: true, skip_empty_lines: true });

const main = async () => {
  const app = buildServer();
  try {
    const events = [];
    for (const row of records) {
      const input: any = {
        uid: row.uid || row.UID,
        event_at: row.event_at || row.EventAt || row.date,
        event_type: row.event_type || row.type,
        event_subtype: row.event_subtype || null,
        source_ref: row.source_ref || row.idempotency_key || null,
        batch_id: row.batch_id || null,
        notes: row.notes || null,
        location_from_code: row.location_from_code || null,
        location_to_code: row.location_to_code || null,
        group_code: row.group_code || null,
        party_code: row.party_code || null,
        product_code: row.product_code || null,
        weight_kg: row.weight_kg ? Number(row.weight_kg) : undefined,
        method: row.method,
        shrink_pct: row.shrink_pct ? Number(row.shrink_pct) : undefined,
        reason: row.reason,
        distance_km: row.distance_km ? Number(row.distance_km) : undefined,
        repro_action: row.repro_action,
        sire_uid: row.sire_uid,
        dam_uid: row.dam_uid,
        result: row.result,
        calf_uid: row.calf_uid,
        gestation_days: row.gestation_days ? Number(row.gestation_days) : undefined,
      };
      if (!input.uid || !input.event_at || !input.event_type) continue;
      const created = await createEvent(app as any, input, "import-script");
      events.push(created?.event_id);
    }
    console.log(`Imported ${events.length} events`);
  } catch (err) {
    console.error(err);
  } finally {
    await app.close();
  }
};

main();
