#!/bin/bash
# 目标机首次安装平台（18087）。不删除 8092 容器和卷。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
NAME="${CONTAINER_NAME:-srpm-18087}"
VOL="${DATA_VOLUME:-platform_srpm-data}"
IMAGE="${APP_IMAGE:-srpm-platform:20260827}"
PORT="${SRPM_PORT:-18087}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./install.sh"
  exit 1
fi
command -v docker >/dev/null || { echo "未安装 Docker"; exit 1; }
docker info >/dev/null

mkdir -p "$ROOT/backups"
test -f .env || cp .env.example .env
sed -i 's/\r$//' .env .env.example *.sh 2>/dev/null || true
PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
PORT="${PORT:-18087}"
NAME="$(sed -n 's/^CONTAINER_NAME=//p' .env | tail -1 | tr -d '[:space:]')"
NAME="${NAME:-srpm-18087}"
VOL="$(sed -n 's/^DATA_VOLUME=//p' .env | tail -1 | tr -d '[:space:]')"
VOL="${VOL:-platform_srpm-data}"

echo "======== 1/4 创建数据卷 $VOL ========"
docker volume create "$VOL" >/dev/null

for f in server/src/init-clean.js server/src/attachFormLedger.js server/src/staffAccounts.js; do
  test -f "$ROOT/$f" || { echo "部署包缺少 $f ，请用完整迁移包重新拷贝"; exit 1; }
done

echo "======== 2/4 构建镜像 $IMAGE ========"
docker build -t "$IMAGE" "$ROOT"
docker run --rm "$IMAGE" test -f /app/server/src/init-clean.js
docker run --rm "$IMAGE" test -f /app/server/src/attachFormLedger.js

echo "======== 3/4 启动容器 ========"
if docker ps -a --format "{{.Names}}" | grep -qx "$NAME"; then
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker rm "$NAME" >/dev/null 2>&1 || true
fi
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${PORT}:8787" \
  -e TZ=Asia/Shanghai -e HOST=0.0.0.0 -e PORT=8787 -e NODE_ENV=production \
  -e SRPM_DB_FILE=srpm.db \
  -v "${VOL}:/app/server/data" \
  -v "${ROOT}/backups:/app/server/backups" \
  --workdir /app/server \
  "$IMAGE"

echo "======== 4/4 初始化单位/渠道/12个账户（无演示项目） ========"
for i in $(seq 1 15); do
  if docker exec "$NAME" node --input-type=module -e 'fetch("http://127.0.0.1:8787/healthz").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
    break
  fi
  sleep 2
done
docker cp "$ROOT/server/src/db.js" "$NAME":/app/server/src/db.js
docker cp "$ROOT/server/src/staffAccounts.js" "$NAME":/app/server/src/staffAccounts.js
docker cp "$ROOT/server/src/init-clean.js" "$NAME":/app/server/src/init-clean.js
docker exec -w /app/server "$NAME" node src/init-clean.js

echo "======== 安装完成 ========"
echo "访问: http://本机IP:${PORT}/"
echo "管理员: 100001 / 100001"
echo "下一步必须执行: sudo bash ./attach-form-ledger.sh"
echo "禁止: docker compose down -v    docker volume rm ${VOL}"
