#!/bin/bash
# 目标机：只读导出本机 8092 表单台账 → 写入 18087。不碰 8092 数据卷。
# 保留 12 个可登录账户。清掉演示项目。
set -euo pipefail
FORM="${FORM_CONTAINER:-form-maintenance-8092}"
NAME="${CONTAINER_NAME:-srpm-18087}"
STAMP="$(date +%Y%m%d%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./attach-form-ledger.sh"
  exit 1
fi

echo "======== 检查容器 ========"
docker ps --format '{{.Names}} {{.Ports}}'
docker ps --format '{{.Names}}' | grep -qx "$FORM" || { echo "错误：找不到表单维护容器 $FORM"; echo "若名称不同：FORM_CONTAINER=实际名 sudo bash $0"; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$NAME" || { echo "错误：找不到平台容器 $NAME，请先 sudo bash ./install.sh"; exit 1; }

echo "======== 备份 18087 库 ========"
docker exec -w /app/server "$NAME" node --input-type=module -e 'import Database from "better-sqlite3"; const db=new Database("/app/server/data/srpm.db"); console.log(JSON.stringify(db.pragma("wal_checkpoint(TRUNCATE)")));'
docker exec "$NAME" sh -c "cp -a /app/server/data/srpm.db /app/server/data/srpm.db.bak-${STAMP}"

echo "======== 只读导出 8092 台账 ========"
docker exec -w /app/server "$FORM" node --input-type=module -e '
import fs from "fs";
import Database from "better-sqlite3";
let db = null, src = "";
try {
  const mod = await import("/app/server/src/db.js");
  if (typeof mod.openDb === "function") { db = mod.openDb(); src = "openDb()"; }
} catch {}
if (!db) {
  const cands = ["/app/server/data/platform.db","/app/data/form-maintenance.db","/app/server/data/form-maintenance.db"];
  src = cands.find((p) => fs.existsSync(p)) || "";
  if (!src) throw new Error("未找到8092库");
  db = new Database(src, { readonly: true });
}
let rows = [];
try {
  rows = db.prepare("SELECT row_json FROM transition_records ORDER BY id").all()
    .map((r) => { try { return JSON.parse(r.row_json); } catch { return null; } }).filter(Boolean);
} catch {}
if (!rows.length) {
  try { rows = db.prepare("SELECT * FROM transition_records ORDER BY id").all(); } catch {}
}
if (!rows.length) {
  try {
    const kv = db.prepare("SELECT value FROM kv WHERE key=?").get("transition.records.v19");
    if (kv && kv.value) rows = JSON.parse(kv.value);
  } catch {}
}
if (!Array.isArray(rows) || !rows.length) throw new Error("8092 台账行为 0");
fs.writeFileSync("/tmp/form-rows-from-8092.json", JSON.stringify(rows));
console.log("source=" + src);
console.log("rows=" + rows.length);
'

docker cp "$FORM":/tmp/form-rows-from-8092.json /tmp/form-rows-from-8092.json
docker cp /tmp/form-rows-from-8092.json "$NAME":/tmp/form-rows-from-8092.json

echo "======== 写入台账、清演示项目、保留人员账户 ========"
docker exec -w /app/server "$NAME" node src/attachFormLedger.js
echo "======== 接入完成（8092 未改、未重启）========"
echo "请用 100001 / 100001 登录平台，Ctrl+F5 后看项目台账 / 表单维护"
