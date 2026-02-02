# Backup & Restore Runbook

This repo ships simple backup/restore helpers under `packages/db/scripts` and a verification script at `scripts/backup-restore-verify.mjs`.

## Prerequisites
- `pg_dump` and `pg_restore` available on PATH **or** a running Docker `postgres` service
- `DATABASE_URL` set in your environment

## 1) Create a backup
From repo root:

```bash
npm run db:backup
```

This writes a compressed dump file to `./backups/livestock-<timestamp>.dump`.

If `pg_dump` is not installed, the script will try to use the `postgres` Docker container.

## 2) Verify backup file
This checks the dump can be read (does not touch the DB):

```bash
node scripts/backup-restore-verify.mjs
```

You can also specify a file:

```bash
node scripts/backup-restore-verify.mjs --file=backups/my.dump
```

If `pg_restore` is not installed, the script will attempt verification inside the Docker `postgres` container.

## 3) Restore (destructive)
**Warning:** restore drops and recreates objects in the target DB.

Set a target restore URL (recommended: a temp DB):

```bash
export RESTORE_DATABASE_URL="postgresql://user:pass@host:5432/livestock_restore"
node scripts/backup-restore-verify.mjs --file=backups/my.dump
```

On Windows PowerShell:

```powershell
$env:RESTORE_DATABASE_URL="postgresql://user:pass@host:5432/livestock_restore"
node scripts/backup-restore-verify.mjs --file=backups\my.dump
```

## Notes
- The verify script is safe by default. It only runs a restore if `RESTORE_DATABASE_URL` is set or `--restore-url=...` is passed.
- If `pg_dump/pg_restore` are missing, the script falls back to the running `postgres` Docker container (service name `postgres`). You can override with `POSTGRES_CONTAINER`.
- For production, always restore into an isolated database first and validate before swapping.
