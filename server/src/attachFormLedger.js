/**
 * 把 /tmp/form-rows-from-8092.json 写入 kv transition.records.v19
 * 清除演示项目，保留 12 个可登录账户。
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { ensureStaffAccounts } from './staffAccounts.js';

const SRC = process.env.FORM_ROWS_FILE || '/tmp/form-rows-from-8092.json';
const rows = JSON.parse(fs.readFileSync(SRC, 'utf8'));
if (!Array.isArray(rows) || !rows.length) throw new Error('8092 台账行为 0：' + SRC);

const db = new Database('/app/server/data/srpm.db');
db.pragma('journal_mode = WAL');
const key = 'transition.records.v19';
const bakKey = `${key}.bak.${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
const old = db.prepare('SELECT value FROM kv WHERE key=?').get(key);
if (old?.value) {
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(bakKey, old.value);
}
db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
  .run(key, JSON.stringify(rows));

const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((x) => x.name);
const dropOrder = [
  'milestones', 'plans', 'funds', 'funding_requests', 'funding_quota', 'funding_pool',
  'project_finance_profile', 'project_decisions', 'external_contracts', 'deliverables',
  'packages', 'collaborators', 'post_evals', 'approvals', 'changes', 'documents', 'uploads',
  'alerts', 'issues', 'project_issues', 'projects',
];
db.transaction(() => {
  for (const t of dropOrder) {
    if (names.includes(t)) db.prepare(`DELETE FROM ${t}`).run();
  }
  if (names.includes('login_sessions')) db.prepare('DELETE FROM login_sessions').run();
})();

const staff = ensureStaffAccounts(db);
const nLedger = JSON.parse(db.prepare('SELECT value FROM kv WHERE key=?').get(key).value).length;
console.log('ledger=' + nLedger);
console.log('staff_created=' + staff.created);
console.log('staff_updated=' + staff.updated);
console.log('users=' + db.prepare('SELECT COUNT(1) n FROM users').get().n);
db.close();
