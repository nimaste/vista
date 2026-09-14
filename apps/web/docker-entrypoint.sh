#!/bin/sh
set -e

DB_PATH="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DB_PATH")"

echo "[vista] syncing schema against $DATABASE_URL"
cd /app/apps/web
prisma db push --skip-generate --accept-data-loss
cd /app

echo "[vista] starting Next server on $HOSTNAME:$PORT"
exec node apps/web/server.js
