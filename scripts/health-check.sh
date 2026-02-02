#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

curl -fsS "$BASE_URL/healthz" >/dev/null
curl -fsS "$BASE_URL/metrics" >/dev/null

echo "health ok"
