# Livestock Backend - Deep Technical Summary (Section by Section)

Repository URL (copyable):
`https://github.com/icaro1998/livestock`

This document is a deep, technical summary of the repository. It is intended for AI ingestion and system context, not marketing.

## 0) Repository root
Files:
- `.env` / `.env.example`: Environment variables for local/dev. `.env.example` defaults to `localhost` for DB/Redis.
- `.dockerignore`: Docker ignore rules for builds.
- `.gitignore`: Git ignore rules.
- `Dockerfile`: Root-level Dockerfile (not used by infra compose; API uses `apps/api/Dockerfile`).
- `README.md`: Human-facing setup + overview + roadmap.
- `importer_spec.md`: CSV import specification for event ingestion rules.
- `package.json` / `package-lock.json`: Monorepo workspace config and dependencies.
- `tsconfig.base.json`: TypeScript base config (shared across packages).
- `tsconfig.json`: Root TS config.

## 1) infra/ (Docker Compose)
- `infra/docker-compose.yml`:
  - Services: `postgres`, `redis`, `api`.
  - Postgres 15, Redis 7, API built from `apps/api/Dockerfile`.
  - API env: `DATABASE_URL`, `REDIS_URL`, JWT secrets.
  - Ports: 5432, 6379, 3000 exposed.

## 2) apps/api/ (API server)
### 2.1 Dockerfile
- `apps/api/Dockerfile`:
  - Build stage on `node:20-bullseye-slim`.
  - Installs `openssl` to satisfy Prisma libssl dependency.
  - Builds shared/db/api packages.
  - Runtime stage also installs `openssl`.
  - Copies both root `node_modules` and `apps/api/node_modules` to runtime.

### 2.2 TypeScript config
- `apps/api/tsconfig.json`:
  - `outDir` = `dist`, `rootDir` = `src`.
  - Uses `paths` to `packages/*/dist` for shared/db imports.
  - Project references to `packages/shared` and `packages/db`.

### 2.3 Entry + config
- `apps/api/src/config.ts`:
  - Loads `.env` via `dotenv`.
  - Fallback: loads repo-root `.env` if `DATABASE_URL` not found.
  - Exposes config: DB/Redis URLs, JWT secrets, expirations, rate-limit config, CORS, etc.

- `apps/api/src/index.ts`:
  - Creates Fastify server.
  - Registers plugins: CORS, rate-limit, Redis, JWT auth, WebSocket, OpenAPI.
  - Decorates `fastify.config` and `fastify.prisma`.
  - Sets routes and starts server.

### 2.4 Plugins
- `apps/api/src/plugins/auth.ts`:
  - Registers `@fastify/jwt` with access secret.
  - Decorates `authenticate` and `authorize`.
  - Reads JWT payload and sets `request.user`.

- `apps/api/src/plugins/redis.ts`:
  - Creates Redis clients (publisher + subscriber).

- `apps/api/src/plugins/ws.ts`:
  - WebSocket endpoint `/ws`.
  - Publishes events to clients and via Redis pub/sub.

- `apps/api/src/plugins/openapi.ts`:
  - Serves Swagger/OpenAPI docs when enabled.

- `apps/api/src/plugins/request-id.ts`:
  - Adds request IDs to responses and logs.

### 2.5 Routes
- `apps/api/src/routes/*`:
  - `auth.ts`: login/refresh logic.
  - `animals.ts`: CRUD for animals.
  - `events.ts`: event ingestion, list, idempotency.
  - `costs.ts`: costs ingestion + list.
  - `dimensions.ts`: dimension management.
  - `analytics.ts`: derived metrics queries.
  - `system.ts`: health, ready, metrics endpoints.

### 2.6 Services
- `apps/api/src/services/*`:
  - `auth.ts`: register, login, refresh, token rotation.
  - `animals.ts`: animal CRUD & event side-effects.
  - `events.ts`: event ingestion, dedup, strong-arm table writes.
  - `costs.ts`: cost event creation + list.
  - `dimensions.ts`: find-or-create for dimensions.
  - `analytics.ts`: compute derived metrics; used by cron job.

### 2.7 Jobs
- `apps/api/src/jobs/analytics.ts`:
  - Scheduled analytics (node-cron) to compute derived metrics.

### 2.8 Scripts
- `apps/api/src/scripts/seed.ts`:
  - Seeds admin user if none exists.
  - Optionally seeds animals from CSV path.

- `apps/api/src/scripts/import-events.ts`:
  - CSV import for events; uses services for ingestion.

### 2.9 Tests
- `apps/api/test/smoke.ts`:
  - Hits `/healthz`, `/auth/login`, creates animal, creates event, verifies retrieval.

### 2.10 Types
- `apps/api/src/types/fastify.d.ts`:
  - Type augmentation for Fastify instance and request user.

## 3) packages/db/ (Prisma + DB helpers)
- `packages/db/prisma/schema.prisma`:
  - Prisma models for animals, events, dimensions, costs, refresh tokens, derived metrics.

- `packages/db/prisma/migrations/*`:
  - SQL migration(s). Dedup index defined in migration.

- `packages/db/src/index.ts`:
  - Prisma client instance and helpers (`initDb`, `shutdownDb`, `withTransaction`).

- `packages/db/scripts/backup.js`, `restore.js`:
  - `pg_dump` / `pg_restore` helpers.

## 4) packages/shared/ (Shared types/utilities)
- `packages/shared/src/constants.ts`: system constants.
- `packages/shared/src/roles.ts`: role definitions + helpers.
- `packages/shared/src/schemas.ts`: zod schemas for inputs.
- `packages/shared/src/pagination.ts`: cursor pagination helpers.
- `packages/shared/src/events.ts`: event helpers + WebSocket message shapes.
- `packages/shared/src/index.ts`: re-exports.
- `packages/shared/test/pagination.test.ts`: tests for pagination utils.

## 5) scripts/
- `scripts/dev.ps1`:
  - Bootstraps infra (Postgres/Redis)
  - Runs migrations + seed
  - Optionally builds and runs Docker API, or local dev server
  - Optional `-Smoke` flag

- `scripts/doctor.mjs`:
  - Diagnostics / environment checks

## 6) data/
- `data/ANIMAL_REG - data.csv`:
  - Optional CSV used by seed script for animal data

## 7) docs/
- `docs/baseline/*`:
  - Baseline environment / docker / git status snapshots

## 8) Operational behavior (current state)
- API is reachable on `http://localhost:3000` after `docker compose up -d --build`.
- Health check: `GET /healthz` returns `{ "status": "ok" }`.
- `npm run smoke --workspace @livestock/api` passes against running API.
- Prisma requires OpenSSL; Docker image installs it.

---

## How to find the project online
GitHub repository:
`https://github.com/icaro1998/livestock`

Clone:
```
git clone https://github.com/icaro1998/livestock
```

Default branch in use locally: `codex/implement-stabilization-for-launch-today`

