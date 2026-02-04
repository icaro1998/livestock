#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
MAX_ATTEMPTS="${2:-30}"
DELAY_SECONDS="${3:-1}"

wait_for() {
  local url="$1"
  local name="$2"
  local i
  for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    if curl -fsS "$url" >/dev/null; then
      return 0
    fi
    sleep "$DELAY_SECONDS"
  done
  echo "$name failed after $MAX_ATTEMPTS attempts" >&2
  return 1
}

wait_for "$BASE_URL/healthz" "healthz"
wait_for "$BASE_URL/metrics" "metrics"

echo "health ok"
