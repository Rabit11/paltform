#!/bin/bash
# 目标机：补齐登录所需表（login_attempts / login_sessions）
# 不重装、不清卷、不动 8092。
# 用法：sudo bash ./fix-login-tables.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
test -f .env || cp .env.example .env
sed -i 's/\r$//' .env "$0" 2>/dev/null || true
NAME="$(sed -n 's/^CONTAINER_NAME=//p' .env | tail -1 | tr -d '[:space:]')"
NAME="${CONTAINER_NAME:-${NAME:-srpm-18087}}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用: sudo bash ./fix-login-tables.sh"
  exit 1
fi

docker ps --format '{{.Names}}' | grep -qx "$NAME" || {
  echo "找不到容器: $NAME"
  exit 1
}

docker exec -i -w /app/server "$NAME" node --input-type=module <<'EOF'
import Database from "better-sqlite3";
const db = new Database("/app/server/data/srpm.db");
db.exec(`
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TEXT NOT NULL,
  succeeded INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS login_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
`);
const n = db.prepare("select count(*) n from users").get().n;
const names = db.prepare("select name from sqlite_master where type='table' and name like 'login_%' order by name").all().map((x) => x.name);
console.log("users=" + n);
console.log("tables=" + names.join(","));
if (!names.includes("login_attempts") || !names.includes("login_sessions")) {
  throw new Error("login tables missing after create");
}
console.log("LOGIN_TABLES_OK");
db.close();
EOF

echo "完成。浏览器打开 http://本机IP:18087/login ，Ctrl+F5 后用工号 100001 密码 100001 登录。"
