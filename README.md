# GANADERÍA AVANZADA – Livestock ERP Backend

TypeScript/Fastify + PostgreSQL + Prisma + Redis backend with real-time event sourcing for collaborative livestock operations.

## Quick start (Windows / LAN)
1. Install Node.js 20 and Docker Desktop.
2. Copy `.env.example` to `.env` and adjust secrets if needed.
3. Install deps (workspace-aware):
   ```powershell
   npm install
   ```
4. Start infra (Postgres + Redis + API):
   ```powershell
   docker compose -f infra/docker-compose.yml up -d
   ```
5. Apply DB migrations:
   ```powershell
   npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
   ```
6. Seed bootstrap admin and sample animals:
   ```powershell
   npm run seed --workspace @livestock/api
   ```
7. Run API locally (outside Docker) for dev:
   ```powershell
   npm run dev --workspace @livestock/api
   ```
   or rely on the Docker `api` service (port 3000).
8. Smoke test (server must be running at http://localhost:3000):
   ```powershell
   npm run smoke --workspace @livestock/api
   ```

### Default credentials
- admin@example.com / admin1234 (created by seed if no users exist)

## API surface
- REST on port `3000`.
- WebSocket endpoint: `/ws` broadcasting `animal.updated`, `event.created`, `cost.created`, `dimension.updated` with envelope `{ topic, ts, requestId?, data }`.
- OpenAPI docs: `/docs` (served when `OPENAPI_ENABLED=true`).
- Health endpoints: `/healthz`, `/readyz`, `/metrics`.

## Auth & roles
- JWT access + refresh tokens (configurable expirations).
- Roles: `viewer` (read), `manager` (events + patch animals), `admin` (dimensions, users, animals).
- Optimistic concurrency on `PATCH /animals/:uid` via header `If-Match-Version`.

## Data model highlights
- Static table `animal` separated from event log `animal_event` (+ strong-arm tables for weight/movement/repro/health/nutrition).
- Dedup enforced by unique index on `(uid, event_at, event_type, COALESCE(event_subtype,''), COALESCE(source_ref,''))`.
- Dimension codes resolved exactly as provided; missing codes auto-create rows.
- Redis pub/sub -> WS fan-out after successful transactions.

## Commands
- `npm run migrate` (workspace @livestock/db) – deploy migrations.
- `npm run db:backup` / `npm run db:restore -- --file=...` (workspace @livestock/db) – pg_dump/pg_restore helpers.
- `npm run import:events --workspace @livestock/api -- --file=path.csv` – import universal event CSV.
- `npm test` – runs workspace tests (Vitest).

## Files of interest
- `packages/db/prisma/schema.prisma` – Prisma models.
- `packages/db/prisma/migrations/0001_init/migration.sql` – authoritative DDL with dedup index.
- `apps/api/src/routes/*` – REST routes.
- `apps/api/src/plugins/ws.ts` – Redis + WebSocket broadcast path.
- `importer_spec.md` – CSV/dedup/dimension rules.

## Operational notes
- Analytics job (node-cron every 10 minutes) writes to `derived_metrics` and caches summary in Redis.
- LAN-friendly defaults: binds to `0.0.0.0:3000`, Redis on 6379, Postgres on 5432.
- `ANIMALS_CSV_PATH` env points to default `data/ANIMAL_REG - data.csv` for seeding.

## Smoke checklist (manual)
- Open `/docs` and confirm OpenAPI renders.
- `POST /auth/login` with admin creds -> tokens.
- `POST /events` with `Idempotency-Key` repeated -> returns same event id (HTTP 200).
- Connect WS client to `/ws`, create event -> receive `event.created` within ~1s.
