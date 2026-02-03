#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-infra/docker-compose.prod.stack.yml}"
SERVICE="${2:-postgres}"
DATABASE="${3:-livestock}"
USER_NAME="${4:-livestock}"
OUT_DIR="${5:-backups}"

timestamp="$(date +"%Y%m%d-%H%M%S")"
mkdir -p "$OUT_DIR"
backup_path="$OUT_DIR/livestock-$timestamp.dump"

echo "Writing backup to $backup_path"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" pg_dump -U "$USER_NAME" -d "$DATABASE" -Fc > "$backup_path"
echo "Backup complete"
