import { createHash, randomBytes } from 'node:crypto';

/** 成员管理 12 人：可登录，登录页不展示。初始密码 = 工号。 */
export const STAFF_ACCOUNTS = [
  { emp_no: '100001', id: 'u_admin', name: '系统管理员', role: 'admin', scope: 'hq', unit_id: 7, title: '系统管理员', form_access: 1, form_scope: 'hq' },
  { emp_no: '100002', id: '100002', name: '周明远', role: 'leader', scope: 'hq', unit_id: 7, title: '公司领导 / 科技管理数智大屏决策查看', form_access: 0, form_scope: null },
  { emp_no: '100003', id: '100003', name: '王建国', role: 'mgmt', scope: 'hq', unit_id: 7, title: '管理团队 / 总部责任处室处长', form_access: 1, form_scope: 'hq' },
  { emp_no: '100004', id: '100004', name: '何雨桐', role: 'mgmt', scope: 'hq', unit_id: 7, title: '管理团队 / 总部科研项目主管', form_access: 1, form_scope: 'hq' },
  { emp_no: '100005', id: '100005', name: '方致远', role: 'mgmt', scope: 'unit', unit_id: 1, title: '管理团队 / 单位科研管理部门负责人', form_access: 0, form_scope: null },
  { emp_no: '100006', id: '100006', name: '田念慈', role: 'mgmt', scope: 'unit', unit_id: 1, title: '管理团队 / 单位项目主管', form_access: 0, form_scope: null },
  { emp_no: '100007', id: '100007', name: '陈铁军', role: 'chief', scope: 'chief', unit_id: 7, title: '责任总师 / 一级总师（公司级）', form_access: 0, form_scope: null },
  { emp_no: '100008', id: '100008', name: '蔡文渊', role: 'chief', scope: 'chief', unit_id: 1, title: '责任总师 / 二级总师（单位级）', form_access: 0, form_scope: null },
  { emp_no: '100009', id: '100009', name: '赵美玲', role: 'finance', scope: 'unit', unit_id: 2, title: '财务团队 / 上飞公司财务主管', form_access: 0, form_scope: null },
  { emp_no: '100010', id: '100010', name: '毕仲文', role: 'finance', scope: 'unit', unit_id: 1, title: '财务团队 / 二级单位财务负责人', form_access: 0, form_scope: null },
  { emp_no: '100011', id: '100011', name: '龚雪君', role: 'finance', scope: 'unit', unit_id: 1, title: '财务团队 / 经费核销经办', form_access: 0, form_scope: null },
  { emp_no: '100012', id: '100012', name: '林晚晴', role: 'team', scope: 'self', unit_id: 1, title: '项目团队 / 项目责任人', form_access: 0, form_scope: null },
];

export const STAFF_UNITS = [
  { id: 1, name: '上海飞机设计研究院', short: '上飞院', kind: 'unit' },
  { id: 2, name: '上海飞机制造有限公司', short: '上飞公司', kind: 'unit' },
  { id: 3, name: '北京民用飞机技术研究中心', short: '北研中心', kind: 'unit' },
  { id: 4, name: '上海飞机客户服务有限公司', short: '客服公司', kind: 'unit' },
  { id: 5, name: '民用飞机试飞中心', short: '试飞中心', kind: 'unit' },
  { id: 6, name: '复合材料与基础能力中心', short: '基础能力中心', kind: 'unit' },
  { id: 7, name: '公司总部科技管理部', short: '总部科技部', kind: 'hq' },
];

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = createHash('sha256').update(`${salt}:${String(password)}`).digest('hex');
  return `sha256$${salt}$${digest}`;
}

export function ensureAuthColumns(db) {
  const cols = db.prepare('pragma table_info(users)').all().map((c) => c.name);
  if (!cols.includes('password_hash')) db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run();
  if (!cols.includes('emp_no')) db.prepare('ALTER TABLE users ADD COLUMN emp_no TEXT').run();
  if (!cols.includes('form_access')) db.prepare('ALTER TABLE users ADD COLUMN form_access INTEGER NOT NULL DEFAULT 0').run();
  if (!cols.includes('form_scope')) db.prepare('ALTER TABLE users ADD COLUMN form_scope TEXT').run();
  if (!cols.includes('form_scope_keys')) db.prepare('ALTER TABLE users ADD COLUMN form_scope_keys TEXT').run();
  if (!cols.includes('declare_result_access')) db.prepare('ALTER TABLE users ADD COLUMN declare_result_access INTEGER NOT NULL DEFAULT 0').run();
}

export const HQ_TECH_ACCOUNTS = [
  { emp_no: '411582', name: '黄光辉', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部科技部', form_access: 1, form_scope: 'hq' },
  { emp_no: '333897', name: '黄晓华', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部科技部', form_access: 1, form_scope: 'hq' },
  { emp_no: '203322', name: '张大伟', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部科技部', form_access: 1, form_scope: 'hq' },
  { emp_no: '339189', name: '罗鑫鑫', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部科技部', form_access: 1, form_scope: 'hq' },
  { emp_no: '201882', name: '邹运佳', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部科技部', form_access: 1, form_scope: 'hq' },
];

function findUser(db, empNo, id) {
  return db.prepare('SELECT * FROM users WHERE emp_no=? OR id=? OR id=?').get(empNo, empNo, id) || null;
}

/** upsert 12 人；已有密码不覆盖。登录页不展示这些人。 */
export function ensureStaffAccounts(db) {
  ensureAuthColumns(db);
  let created = 0;
  let updated = 0;
  const tx = db.transaction(() => {
    for (const s of STAFF_ACCOUNTS) {
      const keys = s.form_access ? JSON.stringify([]) : null;
      const hit = findUser(db, s.emp_no, s.id);
      if (!hit) {
        db.prepare(`INSERT INTO users (id,name,role,scope,unit_id,title,status,password_hash,emp_no,form_access,form_scope,form_scope_keys)
          VALUES (?,?,?,?,?,?,'在岗',?,?,?,?,?)`)
          .run(s.id, s.name, s.role, s.scope, s.unit_id, s.title, hashPassword(s.emp_no), s.emp_no, s.form_access, s.form_scope, keys);
        created += 1;
        continue;
      }
      db.prepare(`UPDATE users SET name=?, role=?, scope=?, unit_id=?, title=?, status='在岗', emp_no=?, form_access=?, form_scope=?, form_scope_keys=?
        WHERE id=?`)
        .run(s.name, s.role, s.scope, s.unit_id, s.title, s.emp_no, s.form_access, s.form_scope, keys, hit.id);
      if (!hit.password_hash) {
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(s.emp_no), hit.id);
      }
      updated += 1;
    }
  });
  tx();
  return { created, updated, total: STAFF_ACCOUNTS.length };
}

/** 表单维护「人员权限」清单：总部科技部实名账号。已存在则不改密码、不覆盖角色。 */
export function ensureHqTechAccounts(db) {
  ensureAuthColumns(db);
  let created = 0;
  let skipped = 0;
  const tx = db.transaction(() => {
    for (const s of HQ_TECH_ACCOUNTS) {
      const hit = findUser(db, s.emp_no, s.emp_no);
      if (hit) {
        skipped += 1;
        continue;
      }
      const keys = s.form_access ? JSON.stringify([]) : null;
      db.prepare(`INSERT INTO users (id,name,role,scope,unit_id,title,status,password_hash,emp_no,form_access,form_scope,form_scope_keys,declare_result_access)
        VALUES (?,?,?,?,?,?,'在岗',?,?,?,?,?,0)`)
        .run(s.emp_no, s.name, s.role, s.scope, s.unit_id, s.title, hashPassword(s.emp_no), s.emp_no, s.form_access, s.form_scope, keys);
      created += 1;
    }
  });
  tx();
  return { created, skipped, total: HQ_TECH_ACCOUNTS.length };
}

export function staffEmpNos() {
  return STAFF_ACCOUNTS.map((s) => s.emp_no);
}
