#!/bin/bash
# 首次离线部署（推荐，使用 docker-compose）
# 用法：sudo bash ./install-first-deploy.sh
set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
APP_DIR=$(cd "$SCRIPT_DIR" && pwd)
cd "$APP_DIR"

IMAGE_TAR=${IMAGE_TAR:-$APP_DIR/srpm-platform-app-18087.tar.gz}
DATA_TAR=${DATA_TAR:-$APP_DIR/srpm-platform-data.tar.gz}
VOL=${DATA_VOLUME:-platform_srpm-data}
IMAGE=${APP_IMAGE:-srpm-platform:migration-legacy-20260807}
PORT=${SRPM_PORT:-18087}
NAME=${CONTAINER_NAME:-srpm-18087}

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./install-first-deploy.sh"
  exit 1
fi

# 兼容旧包命名
if [ ! -f "$IMAGE_TAR" ] && [ -f "$APP_DIR/assets/srpm-platform-migration-image.tar.gz" ]; then
  IMAGE_TAR="$APP_DIR/assets/srpm-platform-migration-image.tar.gz"
fi
if [ ! -f "$DATA_TAR" ] && [ -f "$APP_DIR/assets/platform-srpm-data.tar.gz" ]; then
  DATA_TAR="$APP_DIR/assets/platform-srpm-data.tar.gz"
fi

if [ ! -f "$IMAGE_TAR" ]; then
  echo "缺少镜像包: $IMAGE_TAR"
  exit 1
fi
if [ ! -f docker-compose.yml ] || [ ! -f .env ]; then
  echo "缺少 docker-compose.yml 或 .env"
  echo "run: ls -la"
  exit 1
fi
if ! command -v docker-compose >/dev/null 2>&1; then
  echo "未找到 docker-compose（独立命令）。可改用: sudo bash ./install-manual.sh"
  exit 1
fi

mkdir -p "$APP_DIR/backups" "$APP_DIR/data-exports"
chmod +x "$APP_DIR"/scripts/*.sh 2>/dev/null || true
chmod +x "$APP_DIR"/*.sh 2>/dev/null || true

# clear FORCE_SEED
sed -i 's/^FORCE_SEED=.*/FORCE_SEED=/' .env || true
grep -q '^FORCE_SEED=' .env || echo 'FORCE_SEED=' >> .env

# 从 .env 读取端口
PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
PORT="${PORT:-18087}"
export SRPM_PORT="$PORT"

echo "======== 1/5 load image ========"
if [[ "$IMAGE_TAR" == *.tar.gz ]]; then
  gzip -dc "$IMAGE_TAR" | docker load
else
  docker load -i "$IMAGE_TAR"
fi
docker images | grep srpm-platform || true

echo "======== 2/5 create volume ========"
docker volume create "$VOL" >/dev/null
docker volume inspect "$VOL" >/dev/null

if [ -f "$DATA_TAR" ]; then
  echo "======== 3/5 import data $DATA_TAR ========"
  docker run --rm --user root --entrypoint sh \
    -v "$VOL":/data \
    -v "$DATA_TAR":/in/pack.tar.gz:ro \
    "$IMAGE" \
    -c 'set -e
        mkdir -p /data/uploads /tmp/restore
        tar xzf /in/pack.tar.gz -C /tmp/restore
        test -f /tmp/restore/platform.db
        rm -f /data/platform.db /data/platform.db-wal /data/platform.db-shm
        cp -a /tmp/restore/platform.db /data/platform.db
        if [ -d /tmp/restore/uploads ]; then
          rm -rf /data/uploads
          mkdir -p /data/uploads
          cp -a /tmp/restore/uploads/. /data/uploads/ || true
        fi
        chown -R 1000:1000 /data 2>/dev/null || true
        ls -la /data
       '
else
  echo "======== 3/5 no data pack, empty volume ========"
fi

echo "======== 4/5 start with docker-compose ========"
docker-compose --env-file .env up -d
sleep 5

echo "======== 5/5 health check ========"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10 12 15; do
  code=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
  echo "health try $i -> $code"
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 2
done

if [ "$ok" != "1" ]; then
  echo "start failed, recent logs:"
  docker logs --tail 40 "$NAME" || true
  exit 1
fi

echo
echo "[OK] deploy done"
echo "  url: http://<host-ip>:${PORT}/"
echo "  login: u_hq / Srpm@2026"
echo "  NEVER: docker-compose down -v"
echo "  update: ./scripts/safe-update.sh ./new-image.tar.gz"
