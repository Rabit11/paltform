#!/bin/bash
# 目标机首次安装科研预研平台（18087）。不删除 8092 容器和卷。
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
NAME="${CONTAINER_NAME:-srpm-18087}"
VOL="${DATA_VOLUME:-platform_srpm-data}"
IMAGE="${APP_IMAGE:-srpm-platform:20260821}"
PORT="${SRPM_PORT:-18087}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./install.sh"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未安装 Docker。请先安装 Docker 后再执行。"
  exit 1
fi
docker info >/dev/null

if ss -lntp 2>/dev/null | grep -q ":${PORT} " ; then
  echo "警告：端口 ${PORT} 已被占用。可改 .env 里 SRPM_PORT 后重试。"
fi

mkdir -p "$APP_DIR/backups"
test -f .env || cp .env.example .env
sed -i 's/\r$//' .env .env.example 2>/dev/null || true
PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d "[:space:]")"
PORT="${PORT:-18087}"

echo "======== 1/4 创建数据卷 $VOL（已存在则跳过） ========"
docker volume create "$VOL" >/dev/null

echo "======== 2/4 构建镜像 $IMAGE ========"
docker build -t "$IMAGE" .

echo "======== 3/4 启动容器 ========"
if docker ps -a --format "{{.Names}}" | grep -qx "$NAME"; then
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker rm "$NAME" >/dev/null 2>&1 || true
fi
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${PORT}:8787" \
  -e TZ=Asia/Shanghai \
  -e HOST=0.0.0.0 \
  -e PORT=8787 \
  -e NODE_ENV=production \
  -e SRPM_DB_FILE=srpm.db \
  -v "${VOL}:/app/server/data" \
  -v "${APP_DIR}/backups:/app/server/backups" \
  --workdir /app/server \
  "$IMAGE"

echo "======== 4/4 初始化单位/渠道/12个账户（无演示项目） ========"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec "$NAME" node --input-type=module -e 'fetch("http://127.0.0.1:8787/healthz").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
    break
  fi
  sleep 2
done
docker exec -w /app/server "$NAME" node src/init-clean.js

echo "======== 安装完成 ========"
echo "访问: http://本机IP:${PORT}/"
echo "管理员: 100001 / 100001"
echo "下一步（必须）：sudo bash ./attach-form-ledger.sh   # 把本机 8092 台账接入平台"
echo "禁止: docker compose down -v   以及   docker volume rm ${VOL}"
