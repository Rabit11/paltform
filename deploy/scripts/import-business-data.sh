#!/bin/bash
# 导入业务数据 — 覆盖数据卷内容
# 用法：./scripts/import-business-data.sh <business-data_xxx.tar.gz>
# 警告：会替换卷内现有 platform.db / uploads，请先 export 再操作
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

PACK="${1:-}"
if [ -z "$PACK" ] || [ ! -f "$PACK" ]; then
  echo "用法: $0 <business-data_xxx.tar.gz>"
  echo "可用导出:"
  ls -1t data-exports/business-data_*.tar.gz 2>/dev/null | head -10 || true
  exit 1
fi
PACK="$(cd "$(dirname "$PACK")" && pwd)/$(basename "$PACK")"

VOL="${DATA_VOLUME:-platform_srpm-data}"
IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-srpm}"
PORT="${SRPM_PORT:-18087}"

if [ -f .env ]; then
  PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
  PORT="${PORT:-18087}"
  sed -i 's/^FORCE_SEED=.*/FORCE_SEED=/' .env || true
  grep -q '^FORCE_SEED=' .env || echo 'FORCE_SEED=' >> .env
fi
export SRPM_PORT="$PORT"

echo "[import] pack=$PACK"
echo "[import] volume=$VOL"
echo "[import] 将停止容器、写入数据卷、再启动"

if command -v docker-compose >/dev/null 2>&1; then
  docker-compose --env-file .env stop "$COMPOSE_SERVICE" 2>/dev/null || docker stop "$NAME" 2>/dev/null || true
else
  docker stop "$NAME" 2>/dev/null || true
fi

docker volume inspect "$VOL" >/dev/null

docker run --rm --entrypoint sh \
  -v "$VOL":/data \
  -v "$PACK":/in/pack.tar.gz:ro \
  "$IMAGE" \
  -c 'set -e
      rm -rf /data/platform.db /data/platform.db-wal /data/platform.db-shm
      mkdir -p /data/uploads /tmp/restore
      tar xzf /in/pack.tar.gz -C /tmp/restore
      test -f /tmp/restore/platform.db
      cp -a /tmp/restore/platform.db /data/platform.db
      if [ -d /tmp/restore/uploads ]; then
        rm -rf /data/uploads
        mkdir -p /data/uploads
        cp -a /tmp/restore/uploads/. /data/uploads/ || true
      fi
      chown -R 1000:1000 /data 2>/dev/null || true
      chmod -R u+rwX /data 2>/dev/null || true
      ls -la /data
     '

if command -v docker-compose >/dev/null 2>&1; then
  docker-compose --env-file .env up -d
else
  docker start "$NAME" 2>/dev/null || bash "$APP_DIR/update-image.sh"
fi

sleep 4
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
  [ "$code" = "200" ] && break
  sleep 2
done

docker exec "$NAME" node -e '
const Database=require("better-sqlite3");
const db=new Database("/app/server/data/platform.db",{readonly:true});
console.log("integrity="+db.pragma("integrity_check",{simple:true}));
for (const t of ["users","projects","approvals","documents"]) {
  try { console.log(t+"="+db.prepare("select count(*) n from "+t).get().n); } catch(e) { console.log(t+"=n/a"); }
}
db.close();
'

echo "[import] done — 业务数据已载入，与当前镜像并存"
