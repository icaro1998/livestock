# LAN Runbook (Windows)

## Daily checks
- Confirm containers are running:
  ```powershell
  docker compose -f infra/docker-compose.yml ps
  ```
- Verify health endpoints:
  ```powershell
  Invoke-RestMethod http://localhost:3000/healthz
  Invoke-RestMethod http://localhost:3000/readyz
  Invoke-RestMethod http://localhost:3000/metrics
  ```
- Confirm disk space before backups:
  ```powershell
  Get-PSDrive -PSProvider FileSystem
  ```

## Logs
- API logs:
  ```powershell
  docker compose -f infra/docker-compose.yml logs -f api
  ```
- Postgres logs:
  ```powershell
  docker compose -f infra/docker-compose.yml logs -f postgres
  ```
- Redis logs:
  ```powershell
  docker compose -f infra/docker-compose.yml logs -f redis
  ```

## Backup
- Run backup to default `backups/` folder:
  ```powershell
  npm run db:backup --workspace @livestock/db
  ```
- Verify backup file exists:
  ```powershell
  Get-ChildItem -Path packages/db/backups
  ```

## Restore
- Restore from a specific backup file:
  ```powershell
  npm run db:restore --workspace @livestock/db -- --file packages/db/backups/<backup-file>.dump
  ```
- Re-run migrations if schema drift is suspected:
  ```powershell
  npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
  ```

## Troubleshooting
- `readyz` fails with Redis error:
  - Check Redis is running and reachable at `REDIS_URL`.
  - Restart Redis container:
    ```powershell
    docker compose -f infra/docker-compose.yml restart redis
    ```
- `readyz` fails with DB error:
  - Validate `DATABASE_URL` and container status.
  - Restart Postgres container:
    ```powershell
    docker compose -f infra/docker-compose.yml restart postgres
    ```
- API won't boot in production:
  - Confirm `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are at least 32 chars and not placeholders.
  - Ensure `DATABASE_URL` contains a non-default password.
