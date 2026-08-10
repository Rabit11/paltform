#!/bin/bash
# 将 data-exports 或快照中的 platform.db / tar.gz 写入 Docker volume（覆盖）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK="${1:-}"
VOL="${VOLUME_NAME:-platform_srpm-data}"
IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"

if [ -z "$PACK" ]; then
  echo "用法: $0 <business-data_xxx.tar.gz|platform.db>"
  exit 1
fi
if [ ! -f "$PACK" ]; then
  echo "找不到: $PACK"
  exit 1
fi

cd "$ROOT"
sed -i 's/^FORCE_SEED=.*/FORCE_SEED=/' .env 2>/dev/null || true

echo "[restore] volume=$VOL pack=$PACK"
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose --env-file .env stop || true
else
  docker stop "$NAME" 2>/dev/null || true
fi

if [[ "$PACK" == *.tar.gz ]]; then
  bash "$ROOT/scripts/import-business-data.sh" "$PACK"
else
  docker run --rm --entrypoint sh \
    -v "$VOL":/data \
    -v "$(cd "$(dirname "$PACK")" && pwd)/$(basename "$PACK")":/in/platform.db:ro \
    "$IMAGE" \
    -c 'rm -f /data/platform.db /data/platform.db-wal /data/platform.db-shm
        cp /in/platform.db /data/platform.db
        mkdir -p /data/uploads
        chown -R 1000:1000 /data 2>/dev/null || true
        ls -la /data'
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose --env-file .env up -d
  else
    docker start "$NAME" 2>/dev/null || true
  fi
fi

echo "数据已恢复。访问 http://<服务器IP>:${SRPM_PORT:-18087}/"
echo "切勿使用 docker-compose down -v"
