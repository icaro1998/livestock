# GANADERIA AVANZADA - Livestock ERP Backend

TypeScript/Fastify + PostgreSQL + Prisma + Redis backend with real-time event sourcing for collaborative livestock operations.
This repo currently contains the backend only (no frontend app yet).

## What this repo is
- Monorepo with one app and shared packages
- API server: Fastify + JWT auth + Redis pub/sub + WebSocket fanout
- Database: PostgreSQL with Prisma schema + migrations
- Background job: analytics computed into derived_metrics

## Repo layout
- `apps/api` - Fastify API server
- `packages/db` - Prisma schema, migrations, db helpers
- `packages/shared` - shared types/schemas/helpers
- `infra/docker-compose.yml` - local Postgres + Redis + API container

## Quick start (Windows)
Prereqs:
- Node.js 20+
- Docker Desktop (Linux engine)

### Option A: Docker API (full stack in containers)
1) Install deps (workspace-aware):
```powershell
npm install
```
2) Build and run containers:
```powershell
docker compose -f infra/docker-compose.yml up -d --build
```
3) Apply DB migrations:
```powershell
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```
4) Seed data (creates admin user if none exists):
```powershell
npm run seed --workspace @livestock/api
```
Note: the Docker API can also auto-run migrations and seed on startup if `AUTO_MIGRATE=true` and `AUTO_SEED=true` (see `.env.example`).
5) Health check:
```powershell
(iwr http://localhost:3000/healthz -UseBasicParsing).Content
```

### Option B: Local API + Docker infra
1) Install deps:
```powershell
npm install
```
2) Start infra only:
```powershell
docker compose -f infra/docker-compose.yml up -d postgres redis
```
3) Copy env and set local DB/Redis:
```powershell
copy .env.example .env
```
Edit `.env`:
```
DATABASE_URL=postgresql://livestock:livestock@localhost:5432/livestock
REDIS_URL=redis://localhost:6379
```
4) Migrate + seed:
```powershell
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run seed --workspace @livestock/api
```
5) Build shared/db packages (first time or after changes):
```powershell
npm run generate --workspace @livestock/db
npm run build --workspace @livestock/shared
npm run build --workspace @livestock/db
```
6) Run API:
```powershell
npm run dev --workspace @livestock/api
```

### Smoke test
Server must be running at http://localhost:3000
```powershell
npm run smoke --workspace @livestock/api
```

## PowerShell helper
There is a helper script to bootstrap local dev:
```powershell
# From repo root
./scripts/dev.ps1
```
Optional flags:
- `-DockerApi` build/run API container instead of local dev server
- `-Smoke` run smoke tests after startup
- `-SkipSeed` skip seeding

Reset DB script (dev only):
```powershell
./scripts/reset-db.ps1
```

## Default credentials
- admin@example.com / admin1234 (created by seed if no users exist)

## Environment variables
See `.env.example`. Common ones:
- `DATABASE_URL` - Postgres connection string
- `REDIS_URL` - Redis connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `OPENAPI_ENABLED` - serve Swagger UI at `/docs`
- `BOOTSTRAP_ADMIN` - allow bootstrapping admin if no users exist

## API surface
- REST on port `3000`
- WebSocket endpoint: `/ws` (topics: `animal.updated`, `event.created`, `cost.created`, `dimension.updated`)
- OpenAPI docs: `/docs` when `OPENAPI_ENABLED=true`
- Health endpoints: `/healthz`, `/readyz`, `/metrics`, `/info`
- Export endpoints: `/export/animals` and `/export/events` (add `?format=csv` for CSV). Optional: `limit` (default 1000, max 5000), `cursor`. Events support `include_payload=true`.

## Auth and roles
- JWT access + refresh tokens
- Roles: `viewer` (read), `manager` (events + patch animals), `admin` (dimensions, users, animals)
- Optimistic concurrency on `PATCH /animals/:uid` via `If-Match-Version`

## Data model highlights
- Static `animal` table separated from event log `animal_event` (+ strong-arm tables for weight/movement/repro/health/nutrition)
- Dedup index on `(uid, event_at, event_type, COALESCE(event_subtype,''), COALESCE(source_ref,''))`
- Dimension codes resolved exactly as provided; missing codes auto-create
- Redis pub/sub to WS fanout after successful transactions

## Commands
- `npm run migrate` (workspace @livestock/db) - deploy migrations
- `npm run db:backup` / `npm run db:restore -- --file=...` (workspace @livestock/db)
- `npm run db:reset` (workspace @livestock/db) - reset DB (dev only)
- `npm run import:events --workspace @livestock/api -- --file=path.csv` - import CSV events
- `npm run admin --workspace @livestock/api -- --list` - list users (admin CLI)
- `npm test` - run workspace tests (Vitest)

## CI and Ops
- GitHub Actions CI: `.github/workflows/ci.yml`
- Production guidance: `docs/PRODUCTION.md`
- Observability guidance: `docs/OBSERVABILITY.md`

## Files of interest
- `packages/db/prisma/schema.prisma` - Prisma models
- `packages/db/prisma/migrations/0001_init/migration.sql` - authoritative DDL
- `apps/api/src/routes/*` - REST routes
- `apps/api/src/plugins/ws.ts` - Redis + WebSocket fanout
- `importer_spec.md` - CSV/dedup/dimension rules

## Troubleshooting
- PowerShell `curl` warns about script execution. Use:
  ```powershell
  (iwr http://localhost:3000/healthz -UseBasicParsing).Content
  ```
- If Docker API fails to start, check logs:
  ```powershell
  docker compose -f infra/docker-compose.yml logs --tail 200 api
  ```
- Ensure Docker Desktop is running (Linux engine) and WSL2 is enabled.

## Roadmap (proposed)
Implemented now:
- Auth + roles + JWT access/refresh
- Event sourcing with dedup + CSV import
- Redis pub/sub + WebSocket fanout
- Analytics job populating derived metrics
- Docker build and local dev workflows

Next (short term):
- CI pipeline with lint/test/build
- Expanded automated tests (API + db)
- Seed data improvements and validation
- Observability: structured logs, metrics docs, alerts

Later:
- Frontend UI (separate app)
- Multi-tenant support
- Advanced reporting and dashboards
