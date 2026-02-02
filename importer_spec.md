# Importer Specification

## Deduplication rules
- Events are uniquely identified by `(uid, event_at, event_type, COALESCE(event_subtype, ""), COALESCE(source_ref, ""))`.
- The database enforces this via the `uq_event_dedup` unique index on `animal_event`.
- When `Idempotency-Key` header is provided it overrides `source_ref`; the value is stored exactly as received (no trimming/normalization).
- On conflict the API returns HTTP 200 with the existing event payload (idempotent behavior). No error is thrown for duplicates.

## Dimension resolution
- Codes are matched **exactly as provided** (case and whitespace preserved).
- When a code is not found the dimension row is auto-created with the code and `name/type/meta` set to null.
- Affected dimensions: `location`, `herd_group` (exposed as `group_code`), `party`, `product`.
- Movement events require origin/destiny codes in the request; the API auto-creates missing locations instead of failing.

## Accepted CSV headers
### Animals seed (`ANIMAL_REG - data.csv`)
Required: `uid`
Optional: `eid, vid, sex, race, brand_mark, mother_name, father_name, birth_year, birth_month, color`

### Universal event import
Required columns (case-insensitive):
- `uid`
- `event_at` (ISO8601)
- `event_type` (weight|movement|repro|health|nutrition|inventory|management|diagnostic|environment)
Optional columns:
- `event_subtype`, `source_ref`, `batch_id`, `notes`, `confidence`
- Dimension codes: `location_from_code`, `location_to_code`, `group_code`, `party_code`, `product_code`
- Weight: `weight_kg`, `method`, `shrink_pct`
- Movement: `reason`, `distance_km`, `transport_party_code`
- Repro: `repro_action`, `sire_uid`, `dam_uid`, `result`, `calf_uid`, `gestation_days`
- Health: `action`, `diagnosis`, `dose`, `dose_unit`, `withdrawal_days`
- Nutrition: `ration_code`, `intake_kg_day`, `supplement_code`, `reason`

### Cost import (via /costs or /costs/bulk)
Required: `cost_at`, `scope`, `category`, `amount`
Optional: `uid, group_code, location_code, product_code, party_code, currency, quantity, unit, source_ref, batch_id, notes`

## Idempotency handling
- `Idempotency-Key` request header sets `source_ref` for events and is part of the dedup key.
- For bulk operations the same header is applied to every event unless an event provides its own `source_ref`.
- Costs are not deduplicated automatically; callers should provide unique `source_ref` if needed.

## Data integrity
- All bulk writes execute inside DB transactions.
- `uid` and `eid` are stored exactly as received—no trimming, casing changes, or whitespace normalization.
- Static `animal` table is kept separate from event payloads; events are not denormalized into animal rows.

## Examples
Event row:
```
uid,event_at,event_type,location_from_code,location_to_code,weight_kg,method,source_ref
A-001,2024-12-01T10:00:00Z,weight,,,420,scale,batch-001-row-1
```
Cost row:
```
cost_at,scope,category,amount,uid,location_code,source_ref
2024-12-05T00:00:00Z,animal,feed,123.45,A-001,LOT-01,feed-dec05
```
