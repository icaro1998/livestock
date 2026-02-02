# Production Configuration & Secrets

This repo treats `NODE_ENV=production` as strict mode. Startup will fail if required
production env vars are missing or unsafe.

## Required env vars
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` (32+ chars, not a placeholder)
- `JWT_REFRESH_SECRET` (32+ chars, not a placeholder)
- `CORS_ORIGIN` (must be explicit, not `*`)

## Forbidden in production
- `BOOTSTRAP_ADMIN=true`
- `OPENAPI_ENABLED=true`
- `AUTO_MIGRATE=true`
- `AUTO_SEED=true`

## Secrets strategy (recommended)
- Store secrets in the platform secret manager (GitHub Actions secrets, VPS env store,
  cloud secret manager).
- Do not commit secrets to the repo.
- Use `.env.production.example` as a template for required keys only.

## Quick check (local)
```
NODE_ENV=production node apps/api/dist/index.js
```
If a required value is missing/weak, startup will fail with a descriptive error.
