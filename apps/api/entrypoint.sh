#!/bin/sh
set -e

if [ "$AUTO_MIGRATE" = "true" ] || [ "$AUTO_MIGRATE" = "1" ]; then
  echo "AUTO_MIGRATE enabled"
  npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
fi

if [ "$AUTO_SEED" = "true" ] || [ "$AUTO_SEED" = "1" ]; then
  echo "AUTO_SEED enabled"
  node apps/api/dist/scripts/seed.js
fi

exec node apps/api/dist/index.js
