#!/bin/sh
set -e

DB=/app/server/data/platform.db

# 首次启动（或显式要求）自动灌注演示数据；四色状态按容器当天日期锚定
if [ ! -f "$DB" ] || [ "$FORCE_SEED" = "1" ]; then
  echo "[srpm] seeding demo database (anchor date: $(date +%F)) ..."
  node /app/server/src/seed.js
else
  echo "[srpm] existing database found, skip seeding (set FORCE_SEED=1 to reset)"
fi

echo "[srpm] starting server on port ${PORT:-8787} ..."
exec node /app/server/src/index.js
