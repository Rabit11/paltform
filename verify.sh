#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
test -f .env || cp .env.example .env
sed -i 's/\r$//' .env 2>/dev/null || true
NAME="$(sed -n 's/^CONTAINER_NAME=//p' .env | tail -1 | tr -d '[:space:]')"
NAME="${NAME:-srpm-18087}"
PORT="$(sed -n 's/^SRPM_PORT=//p' .env | tail -1 | tr -d '[:space:]')"
PORT="${PORT:-18087}"

echo "--- 容器 ---"
docker ps --filter "name=$NAME" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
echo "--- HTTP ---"
curl -fsS -o /dev/null -w '首页 HTTP %{http_code}\n' "http://127.0.0.1:${PORT}/"
echo "--- 登录 / 台账 ---"
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
const login=await call("POST","/api/login",{username:"100001",password:"100001"});
console.log("login", login.name, login.role);
const tok=login.sessionToken;
const list=await call("GET","/api/projects", null, tok);
const dash=await call("GET","/api/dashboard", null, tok);
const form=await call("GET","/api/transition-tool", null, tok);
console.log("projects", Array.isArray(list)?list.length:0);
console.log("dashboard_total", dash && dash.kpis ? dash.kpis.total : 0);
console.log("form_rows", ((form.rows)||[]).length);
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
d.close();
'
echo "VERIFY_OK"
