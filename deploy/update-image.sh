#!/bin/bash
# 换镜像更新（保留 platform_srpm-data 数据卷）
# 用法：sudo bash ./update-image.sh [可选:新镜像.tar.gz]
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

IMAGE_TAR="${1:-$APP_DIR/srpm-platform-app-18087.tar.gz}"
IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"
VOL="${DATA_VOLUME:-platform_srpm-data}"
PORT="${SRPM_PORT:-18087}"
BACKUP_HOST="${BACKUP_HOST:-$APP_DIR/backups}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./update-image.sh"
  exit 1
fi

if [ -f .env ]; then
  PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
  PORT="${PORT:-18087}"
fi

docker volume inspect "$VOL" >/dev/null
if [ -f "$IMAGE_TAR" ]; then
  echo "加载镜像: $IMAGE_TAR"
  if [[ "$IMAGE_TAR" == *.tar.gz ]]; then
    gzip -dc "$IMAGE_TAR" | docker load
  else
    docker load -i "$IMAGE_TAR"
  fi
fi

mkdir -p "$BACKUP_HOST"
docker rm -f "$NAME" 2>/dev/null || true
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${PORT}:8787" \
  -e TZ=Asia/Shanghai \
  -e HOST=0.0.0.0 \
  -e PORT=8787 \
  -e NODE_ENV=production \
  -v "${VOL}:/app/server/data" \
  -v "${BACKUP_HOST}:/app/server/backups" \
  "$IMAGE"

sleep 4
curl -I "http://127.0.0.1:${PORT}/" || true
echo "[OK] 已用新镜像重建容器，数据卷 $VOL 未删"
