#!/bin/bash
# 手动/一键安装：不依赖 docker-compose，使用 docker run
# 用法：sudo bash ./install-manual.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

IMAGE_TAR="${IMAGE_TAR:-$APP_DIR/srpm-platform-app-18087.tar.gz}"
IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"
VOL="${DATA_VOLUME:-platform_srpm-data}"
PORT="${SRPM_PORT:-18087}"
BACKUP_HOST="${BACKUP_HOST:-$APP_DIR/backups}"
DATA_TAR="${DATA_TAR:-$APP_DIR/srpm-platform-data.tar.gz}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./install-manual.sh"
  exit 1
fi

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

if [ -f .env ]; then
  PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
  PORT="${PORT:-18087}"
fi

mkdir -p "$BACKUP_HOST"

echo "======== 1/5 加载镜像 ========"
if [[ "$IMAGE_TAR" == *.tar.gz ]]; then
  gzip -dc "$IMAGE_TAR" | docker load
else
  docker load -i "$IMAGE_TAR"
fi
docker images | grep srpm-platform || true

echo "======== 2/5 清理旧容器（保留数据卷） ========"
docker rm -f "$NAME" 2>/dev/null || true

echo "======== 3/5 创建数据卷 $VOL ========"
docker volume create "$VOL" >/dev/null
docker volume inspect "$VOL" >/dev/null

if [ -f "$DATA_TAR" ]; then
  echo "======== 4/5 导入数据 $DATA_TAR ========"
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
       '
else
  echo "======== 4/5 无数据包，跳过导入 ========"
fi

echo "======== 5/5 启动容器 ========"
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${PORT}:8787" \
  -e TZ=Asia/Shanghai \
  -e HOST=0.0.0.0 \
  -e PORT=8787 \
  -e NODE_ENV=production \
  -v "${VOL}:/app/server/data" \
  -v "${BACKUP_HOST}:/app/server/backups" \
  "$IMAGE"

sleep 5
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
  echo "health $i -> $code"
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 2
done

echo
if [ "$ok" = "1" ]; then
  echo "[OK] 安装完成"
  echo "  访问: http://<本机IP>:${PORT}/"
  echo "  账号: u_hq / Srpm@2026"
  echo "  数据卷: $VOL"
  echo "  容器名: $NAME"
else
  echo "[WARN] 健康检查未通过，请查看日志:"
  echo "  docker logs --tail 50 $NAME"
  exit 1
fi
