# Production Config and Secrets Strategy

This document defines the minimum production configuration and secrets handling for the Livestock backend.

## 1) Configuration source of truth
- All runtime config is read from environment variables.
- Do not commit `.env.production` or any secrets to the repo.
- Use a secrets manager or CI/CD environment variables.

## 2) Required environment variables
Use `.env.production.example` as a template. At minimum:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NODE_ENV=production`
- `CORS_ORIGIN` (explicit origin, not `*`)

Recommended:
- `OPENAPI_ENABLED=false`
- `BOOTSTRAP_ADMIN=false`
- `CORS_ORIGIN` set to your frontend domain(s)
- `RATE_LIMIT_*` tuned for production traffic
- `AUTO_MIGRATE=false` and `AUTO_SEED=false` (run migrations manually)

Runtime enforcement:
- When `NODE_ENV=production`, the API will refuse to boot if any required
  secrets are missing or if unsafe flags are enabled (OPENAPI/BOOTSTRAP/AUTO_*).

## 3) Secrets storage strategy
Choose one:
- **GitHub Actions + deployment secrets**
  - Store secrets in GitHub repo/environment secrets
  - Inject into deployment pipeline (not committed)
- **Cloud secrets manager** (preferred)
  - AWS Secrets Manager / GCP Secret Manager / Azure Key Vault
  - Inject as environment variables at runtime

## 4) Rotation policy
- Rotate JWT secrets if compromised.
- Rotate database credentials periodically.
- Maintain a procedure to reissue refresh tokens if JWT secrets change.

## 5) Database
- Use a dedicated production DB user with least privilege.
- Ensure backups are scheduled.
- Run migrations via:
  ```
  npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
  ```
- Validate backups with periodic restore tests.
- Use `npm run db:backup` / `npm run db:restore -- --file=...` (workspace @livestock/db) for manual ops.

## 6) Redis
- Use a dedicated Redis instance for production.
- Consider persistence settings if needed.

## 7) Deployment runbook (Docker)
- Build image:
  ```
  docker build -f apps/api/Dockerfile -t livestock-api:latest .
  ```
- Validate production env locally (optional; for `.env.production` only):
  ```
  NODE_ENV=production ALLOW_DOTENV=true DOTENV_PATH=.env.production npm run prod:validate
  ```
- Run migrations (from the image, using your production env):
  ```
  docker run --rm --env-file .env.production livestock-api:latest npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
  ```
- Start the API:
  ```
  docker run -d --name livestock-api --env-file .env.production -p 3000:3000 livestock-api:latest
  ```
- Wait for health (retries up to 30s):
  ```
  ./scripts/health-check.sh
  ```

## 8) Deployment runbook (Docker Compose)
- External DB/Redis (recommended):
  ```
  docker compose -f infra/docker-compose.prod.yml up -d
  ```
- Single-host stack (API + Postgres + Redis):
  ```
  docker compose -f infra/docker-compose.prod.stack.yml up -d
  ```
- Postgres/Redis are not exposed on host ports in the prod stack.
- Run migrations (either compose file):
  ```
  docker compose -f infra/docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
  ```
- Backup (single-host stack):
  ```
  ./scripts/backup-prod.sh
  ```
- Wait for health (retries up to 30s):
  ```
  ./scripts/health-check.sh
  ```

## 9) Deployment checklist
- [ ] `NODE_ENV=production`
- [ ] Secrets are injected from a secure source
- [ ] DB migrations applied
- [ ] `AUTO_SEED` and `BOOTSTRAP_ADMIN` disabled
- [ ] Admin user created via CLI if needed:
  ```
  npm run admin --workspace @livestock/api -- --create --email=... --generate-password --role=admin
  ```
- [ ] Health endpoint `/healthz` returns OK
- [ ] Smoke test passes against production URL

## 10) TLS and ingress
- Terminate TLS at your load balancer / ingress and forward to the API.
- Set `CORS_ORIGIN` to only the allowed frontend origins.

## 11) Incident response basics
- If a JWT secret is rotated, revoke refresh tokens:
  ```
  npm run admin --workspace @livestock/api -- --revoke-tokens --email=...
  ```
- Keep a short runbook with rollback steps and a known-good image tag.
