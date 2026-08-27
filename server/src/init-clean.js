/**
 * 首次部署：单位 + 渠道字典 + 12 个可登录账户。不造演示项目。
 * docker exec -w /app/server srpm-18087 node src/init-clean.js
 */
import { openDb, createSchema } from './db.js';
import { getCascadeConfig } from './cascadeConfig.js';
import { STAFF_UNITS, ensureStaffAccounts } from './staffAccounts.js';

const DECLARE_CHAIN = ['项目联系人', '项目负责人', '项目承担部门负责人', '二级总师', '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处'];
const DEFAULT_FLOW = ['建议书申报', '建议书评审', '项目立项', '任务书提交', '阶段性检查', '单位级验收评审', '公司级验收评审'];

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
  const cascade = getCascadeConfig();
  const ins = db.prepare(`INSERT INTO channels (key,name,level,source_channel,org_office,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  cascade.paths.forEach((p, i) => {
    const key = `C${i + 1}`;
    const dept = p.level === '公司级' ? p.orgOffice : '科研项目处';
    ins.run(
      key, p.projectType, p.level, p.sourceChannel, p.orgOffice, p.orgOffice, dept,
      JSON.stringify(DEFAULT_FLOW),
      JSON.stringify(['建议书', '建议书评审']),
      JSON.stringify(['立项通知']),
      JSON.stringify(DECLARE_CHAIN),
      '审批',
      JSON.stringify(['阶段性检查']),
    );
  });
  console.log('channels inserted', cascade.paths.length);
} else {
  console.log('channels keep', chN);
}

const staff = ensureStaffAccounts(db);
console.log('staff created', staff.created, 'updated', staff.updated, 'total', staff.total);
console.log('login: emp_no = password; 登录页不展示这些人');
db.close();
