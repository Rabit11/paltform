#!/bin/bash
# 导出业务数据（用户、项目、审批、文档、上传文件）— 与镜像隔离
# 用法：./scripts/export-business-data.sh [输出目录]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

OUT_DIR="${1:-$APP_DIR/data-exports}"
STAMP=$(date +%Y%m%d_%H%M%S)
VOL="${DATA_VOLUME:-platform_srpm-data}"
IMAGE="${APP_IMAGE:-srpm-platform:migration-legacy-20260807}"
NAME="${CONTAINER_NAME:-srpm-18087}"
PACK_NAME="business-data_${STAMP}.tar.gz"
PACK="$OUT_DIR/$PACK_NAME"
TEMP="platform-export-${STAMP}.db"
mkdir -p "$OUT_DIR" backups
chmod 777 "$OUT_DIR" backups 2>/dev/null || true

if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "[export] ERROR: 容器 $NAME 未运行，无法做一致性导出"
  exit 1
fi

echo "[export] online backup via running container..."
docker exec "$NAME" node --input-type=module -e "
  import Database from 'better-sqlite3';
  const db=new Database('/app/server/data/platform.db',{readonly:true});
  await db.backup('/app/server/data/$TEMP');
  db.close();
  const check=new Database('/app/server/data/$TEMP',{readonly:true});
  const integrity=check.pragma('integrity_check',{simple:true});
  if(integrity!=='ok') throw new Error(integrity);
  console.log('snapshot-integrity=ok projects='+check.prepare('select count(*) n from projects').get().n);
  check.close();
"

echo "[export] volume snapshot -> $PACK"
docker run --rm --entrypoint sh \
  -e PACK_NAME="$PACK_NAME" \
  -e TEMP="$TEMP" \
  -v "$VOL":/data:ro \
  -v "$OUT_DIR":/out \
  "$IMAGE" \
  -c 'set -e
      test -f "/data/${TEMP}"
      mkdir -p /tmp/snap
      cp -a "/data/${TEMP}" /tmp/snap/platform.db
      if [ -d /data/uploads ]; then cp -a /data/uploads /tmp/snap/uploads; fi
      cd /tmp/snap && tar czf "/out/${PACK_NAME}" .
      ls -lh "/out/${PACK_NAME}"
     '

docker exec "$NAME" rm -f "/app/server/data/$TEMP" \
  "/app/server/data/${TEMP}-wal" \
  "/app/server/data/${TEMP}-shm" 2>/dev/null || true

MANIFEST="$OUT_DIR/business-data_${STAMP}.manifest.txt"
{
  echo "stamp=$STAMP"
  echo "volume=$VOL"
  echo "pack=$PACK_NAME"
  echo "created=$(date -Iseconds 2>/dev/null || date)"
  docker exec "$NAME" node -e '
const Database=require("better-sqlite3");
const db=new Database("/app/server/data/platform.db",{readonly:true});
console.log("users="+db.prepare("select count(*) c from users").get().c);
console.log("projects="+db.prepare("select count(*) c from projects").get().c);
try { console.log("approvals="+db.prepare("select count(*) c from approvals").get().c); } catch { console.log("approvals=0"); }
try { console.log("documents="+db.prepare("select count(*) c from documents").get().c); } catch { console.log("documents=0"); }
'
} > "$MANIFEST"

echo "[export] done"
echo "  pack:     $PACK"
echo "  manifest: $MANIFEST"
echo "  cold:     $APP_DIR/backups/"
