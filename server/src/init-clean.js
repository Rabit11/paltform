/**
 * 首次部署：单位 + 渠道字典 + 12 个可登录账户。不造演示项目。
 * docker exec -w /app/server srpm-18087 node src/init-clean.js
 */
import { openDb, createSchema } from './db.js';
import { CHANNEL_SPEC, DECLARE_CHAIN } from './channelSpec.js';
import { STAFF_UNITS, ensureStaffAccounts } from './staffAccounts.js';

const db = openDb();
createSchema(db);

const unitN = db.prepare('SELECT COUNT(1) n FROM units').get().n;
if (!unitN) {
  const ins = db.prepare('INSERT INTO units (id,name,short,kind) VALUES (?,?,?,?)');
  for (const u of STAFF_UNITS) ins.run(u.id, u.name, u.short, u.kind);
  console.log('units inserted', STAFF_UNITS.length);
} else {
  console.log('units keep', unitN);
}

const chN = db.prepare('SELECT COUNT(1) n FROM channels').get().n;
if (!chN) {
  const ins = db.prepare(`INSERT INTO channels (key,name,level,source_channel,org_office,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  for (const c of CHANNEL_SPEC) {
    const dept = c.level === '公司级' ? c.orgOffice : '科研项目处';
    ins.run(
      c.key, c.name, c.level, c.sourceChannel, c.orgOffice, c.orgOffice, dept,
      JSON.stringify(c.flow),
      JSON.stringify(c.declare || []),
      JSON.stringify(c.filing || []),
      JSON.stringify(c.chain || DECLARE_CHAIN),
      c.mode || '审批',
      JSON.stringify(c.assess || []),
    );
  }
  console.log('channels inserted', CHANNEL_SPEC.length);
} else {
  console.log('channels keep', chN);
}

const staff = ensureStaffAccounts(db);
console.log('staff created', staff.created, 'updated', staff.updated, 'total', staff.total);
console.log('login: emp_no = password; 登录页不展示这些人');
db.close();
