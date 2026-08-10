#!/bin/bash
# 安全迭代更新：先导出业务数据，再换镜像/重建容器，不碰数据卷
# 用法：
#   ./scripts/safe-update.sh                  # 仅用当前已 load 的镜像 recreate
#   ./scripts/safe-update.sh /path/to.tar.gz  # 先 docker load 再更新
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

IMAGE_TAR="${1:-}"
export DATA_VOLUME="${DATA_VOLUME:-platform_srpm-data}"
export APP_IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"
PORT="${SRPM_PORT:-18087}"

if [ -f .env ]; then
  PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
  PORT="${PORT:-18087}"
fi
export SRPM_PORT="$PORT"

echo "======== 1/4 导出业务数据 ========"
bash "$APP_DIR/scripts/export-business-data.sh" "$APP_DIR/data-exports"
LATEST=$(ls -1t "$APP_DIR/data-exports"/business-data_*.tar.gz | head -1)
echo "[safe-update] latest export: $LATEST"

echo "======== 2/4 确保 FORCE_SEED 为空 ========"
sed -i 's/^FORCE_SEED=.*/FORCE_SEED=/' .env || true
grep -q '^FORCE_SEED=' .env || echo 'FORCE_SEED=' >> .env
grep '^FORCE_SEED=' .env

if [ -n "$IMAGE_TAR" ]; then
  echo "======== 3/4 加载新镜像 $IMAGE_TAR ========"
  if [[ "$IMAGE_TAR" == *.tar.gz ]]; then
    gzip -dc "$IMAGE_TAR" | docker load
  else
    docker load -i "$IMAGE_TAR"
  fi
else
  echo "======== 3/4 跳过 load（使用现有 $APP_IMAGE） ========"
fi

echo "======== 4/4 重建容器（保留 external 数据卷） ========"
docker volume inspect "$DATA_VOLUME" >/dev/null
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose --env-file .env up -d --force-recreate
else
  echo "未找到 docker-compose，改用 update-image.sh 逻辑"
  bash "$APP_DIR/update-image.sh" ${IMAGE_TAR:+"$IMAGE_TAR"}
fi

sleep 5
for i in 1 2 3 4 5 6 7 8 9 10 12; do
  code=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
  echo "health try $i -> $code"
  [ "$code" = "200" ] && break
  sleep 2
done

echo "======== 校验数据仍在 ========"
docker exec "$NAME" node -e '
const Database=require("better-sqlite3");
const db=new Database("/app/server/data/platform.db",{readonly:true});
console.log("integrity="+db.pragma("integrity_check",{simple:true}));
for (const t of ["users","projects","approvals","documents"]) {
  try { console.log(t+"="+db.prepare("select count(*) n from "+t).get().n); } catch(e) { console.log(t+"=n/a"); }
}
db.close();
'
docker logs --tail 15 "$NAME" 2>&1 || true

echo
echo "[safe-update] OK"
echo "  若异常需回滚数据: ./scripts/import-business-data.sh $LATEST"
echo "  禁止: docker-compose down -v"
