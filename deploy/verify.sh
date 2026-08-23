#!/bin/bash
# 部署后校验
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
NAME="${CONTAINER_NAME:-srpm-18087}"
PORT=18087
if [ -f "$ROOT/.env" ]; then
  PORT="$(sed -n 's/^SRPM_PORT=//p' "$ROOT/.env" | tail -1 | tr -d '[:space:]')"
  PORT="${PORT:-18087}"
fi

echo "--- 容器 ---"
docker ps --filter "name=$NAME" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
echo "--- HTTP ---"
curl -fsS -o /dev/null -w '首页 HTTP %{http_code}\n' "http://127.0.0.1:${PORT}/"
echo "--- 登录 / 成员 / 台账 ---"
docker exec "$NAME" node --input-type=module -e '
const B="http://127.0.0.1:8787";
async function call(method, path, data, token){
  const headers={"Content-Type":"application/json"};
  if (token) headers["x-session"]=token;
  const r=await fetch(B+path,{method, headers, body: data==null?undefined:JSON.stringify(data)});
  const t=await r.text();
  if (!r.ok) throw new Error(method+" "+path+" "+r.status+" "+t.slice(0,200));
  return t ? JSON.parse(t) : {};
}
const boot0=await call("GET","/api/bootstrap", null, null);
if ((boot0.users||[]).length) throw new Error("登录页不应返回成员清单");
console.log("unsigned_users", (boot0.users||[]).length);
const login=await call("POST","/api/login",{username:"100001",password:"100001"});
console.log("login", login.name, login.role);
const tok=login.sessionToken;
const boot=await call("GET","/api/bootstrap", null, tok);
console.log("signed_users", (boot.users||[]).length, "channels", (boot.channels||[]).length);
const d=await call("GET","/api/transition-tool", null, tok);
const s=d.summary||{};
console.log("form_rows", (d.rows||[]).length);
console.log("totalBudget", s.totalBudget, "centralGrant", s.centralGrant);
console.log("LOGIN_OK");
'
echo "--- 数据库 ---"
docker exec "$NAME" node --input-type=module -e '
import Database from "better-sqlite3";
const d=new Database("/app/server/data/srpm.db",{readonly:true});
console.log("integrity="+d.pragma("integrity_check",{simple:true}));
const n=t=>{try{return d.prepare("select count(*) n from "+t).get().n}catch{return "n/a"}};
for (const t of ["users","projects","channels","units"]) console.log(t+"="+n(t));
try {
  const v=d.prepare("SELECT value FROM kv WHERE key=?").get("transition.records.v19");
  console.log("transition_kv="+(v?JSON.parse(v.value).length:0));
} catch { console.log("transition_kv=0"); }
const list=d.prepare("SELECT emp_no,name,role FROM users ORDER BY emp_no").all();
for (const u of list) console.log(u.emp_no+" "+u.name+" "+u.role);
d.close();
'
echo "VERIFY_OK"
