#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-infra/docker-compose.prod.stack.yml}"
SERVICE="${2:-postgres}"
DATABASE="${3:-livestock}"
USER_NAME="${4:-livestock}"
OUT_DIR="${5:-backups}"
RETAIN="${RETAIN:-7}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-9}"
PGPASSWORD="${PGPASSWORD:-}"

timestamp="$(date +"%Y%m%d-%H%M%S")"
mkdir -p "$OUT_DIR"
backup_path="$OUT_DIR/livestock-$timestamp.dump"
hash_path="$backup_path.sha256"

echo "Writing backup to $backup_path"
exec_args=(compose -f "$COMPOSE_FILE" exec -T)
if [[ -n "$PGPASSWORD" ]]; then
  exec_args+=(-e "PGPASSWORD=$PGPASSWORD")
fi
exec_args+=("$SERVICE" pg_dump -U "$USER_NAME" -d "$DATABASE" -Fc -Z "$COMPRESS_LEVEL" --no-owner --no-acl)
docker "${exec_args[@]}" > "$backup_path"

if [[ ! -s "$backup_path" ]]; then
  echo "Backup file missing or empty." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup_path" > "$hash_path"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$backup_path" > "$hash_path"
else
  echo "sha256 tool not found; skipping hash file." >&2
fi

if [[ "$RETAIN" -gt 0 ]]; then
  ls -1t "$OUT_DIR"/livestock-*.dump 2>/dev/null | tail -n +"$((RETAIN + 1))" | while read -r old; do
    rm -f "$old" "$old.sha256"
  done
fi
echo "Backup complete"
