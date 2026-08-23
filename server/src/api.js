import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { openDb, createSchema } from './db.js';
import { todayISO, statusColor, worstColor, evalGrade, daysLeft, addDays } from './domain.js';
import { aiStatus, extractProjectInfo } from './ai.js';
import { findCascadePath, getCascadeConfig, resolveOfficeByProjectType, buildCascadeIndexes } from './cascadeConfig.js';
import { getMajorConfig, majorPayload, validateMajorPair } from './majorConfig.js';
import { normalizeResultFields, pairResultItems, splitResultLines } from './resultItems.js';
import { buildStyledTransitionWorkbookBuffer, exportTransitionFieldValue } from './transitionExport.js';
import { selectPrimaryImportSheet } from './transitionFiles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', 'data', 'uploads');
const TRANSITION_TEMPLATE_FILE = '预先研究项目信息-表头-项目处.xlsx';
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = openDb();
createSchema(db);
const r = Router();

const J = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const TODAY = () => todayISO();
const LEVELS = ['国家级', '地方级', '公司级'];
const STATUS_FLOW = ['申报中', '立项中', '实施中', '验收中', '已验收', '已终止'];

function dashboardStatusOf(p) {
  const st = String(p?.status || '');
  if (STATUS_FLOW.includes(st)) return st;
  if (/终止|中止/.test(st)) return '已终止';
  if (/已验收|验收完成|结题/.test(st)) return '已验收';
  if (/验收/.test(st)) return '验收中';
  if (/立项/.test(st)) return '立项中';
  if (/申报|草稿/.test(st)) return '申报中';
  return st || '实施中';
}

function dashboardMajor1Of(p) {
  const raw = String(p?.v19?.major1 || p?.major1 || '').trim();
  const cfg = getMajorConfig();
  if (raw && cfg.major1.includes(raw)) return raw;
  const m2 = String(p?.v19?.major2 || p?.major2 || '').trim();
  const code = (m2.match(/^(\d{2})\d{2}-/) || [])[1];
  if (code) {
    const hit = cfg.major1.find((x) => x.startsWith(`${code}-`));
    if (hit) return hit;
  }
  if (raw) {
    const byPrefix = cfg.major1.find((x) => x.startsWith(`${String(raw).slice(0, 2)}-`));
    if (byPrefix) return byPrefix;
  }
  return raw || '未填专业';
}

function dashboardMajor2Of(p) {
  const raw = String(p?.v19?.major2 || p?.major2 || '').trim();
  const cfg = getMajorConfig();
  if (raw && cfg.major2.includes(raw)) return raw;
  return raw || '';
}

function buildMajorDist(projects) {
  const cfg = getMajorConfig();
  const byMajor1 = (cfg.major1 || []).map((m) => {
    const ps = projects.filter((p) => dashboardMajor1Of(p) === m);
    const childMap = {};
    for (const p of ps) {
      const m2 = dashboardMajor2Of(p) || '未填二级专业';
      childMap[m2] = (childMap[m2] || 0) + 1;
    }
    return {
      major: m,
      count: ps.length,
      budget: Math.round(ps.reduce((s, p) => s + (Number(p.total_budget) || 0), 0)),
      children: Object.entries(childMap).map(([major2, count]) => ({ major2, count })).sort((a, b) => b.count - a.count),
    };
  });
  const known = new Set(cfg.major1 || []);
  const other = projects.filter((p) => !known.has(dashboardMajor1Of(p)));
  if (other.length) {
    byMajor1.push({
      major: '未填专业',
      count: other.length,
      budget: Math.round(other.reduce((s, p) => s + (Number(p.total_budget) || 0), 0)),
      children: [],
    });
  }
  return byMajor1;
}

/** 渠道 → 附件1 一级/二级专业（canonical，含编码前缀） */
const V19_MAJOR_BY_CHANNEL = {
  MJKY: ['10-总体气动', '1003-适航与四性'],
  ZX04: ['30-系统', '3001-航电电气'],
  ZDYF: ['10-总体气动', '1001-总体与气动'],
  XX25: ['40-制造', '4005-增材制造'],
  NSFC: ['80-通用基础', '8005-信息化'],
  NSFC_2030: ['50-复合材料', '5001-复合材料设计'],
  FGW: ['80-通用基础', '8005-信息化'],
  JBGS: ['20-机体', '2003-结构'],
  SHKC: ['30-系统', '3002-飞控'],
  YYGD: ['10-总体气动', '1002-需求与验证'],
  ZDKC: ['20-机体', '2002-强度'],
  XJQX: ['80-通用基础', '8001-市场技术'],
  LAB: ['60-飞行', '6001-试飞工程'],
  KJW: ['80-通用基础', '8002-质量工程'],
  KT: ['40-制造', '4001-系统工艺'],
  XP: ['50-复合材料', '5002-复合材料与工艺'],
  HQZX: ['30-系统', '3004-动力机APU'],
  KJZ: ['70-运行支持', '7004-培训工程'],
  DFY_NH: ['80-通用基础', '8006-工业工程'],
  DFY_XG: ['80-通用基础', '8006-工业工程'],
  DFY_TJ: ['80-通用基础', '8006-工业工程'],
  DFY_SJ: ['80-通用基础', '8006-工业工程'],
  DFY_BH: ['80-通用基础', '8006-工业工程'],
  DFY_CQ: ['80-通用基础', '8006-工业工程'],
  DFY_POLYU: ['80-通用基础', '8006-工业工程'],
  DFY_MH: ['80-通用基础', '8004-标准化技术'],
  CLLM: ['50-复合材料', '5002-复合材料与工艺'],
  BOEING: ['10-总体气动', '1001-总体与气动'],
};

function mapChannelRow(c) {
  const orgOffice = c.org_office || c.org || '';
  return {
    ...c,
    source_channel: c.source_channel || '',
    org_office: orgOffice,
    org: orgOffice,
    flow: J(c.flow_json, []),
    declare: J(c.declare_json, []),
    filing: J(c.filing_json, []),
    chain: J(c.approve_chain_json, []),
    assess: J(c.assess_json, []),
  };
}

function cascadePayload() {
  const cfg = liveCascadeConfig();
  return {
    version: cfg.version,
    updated: cfg.updated,
    rules: cfg.rules,
    levels: cfg.levels,
    sourcesByLevel: cfg.sourcesByLevel,
    typesByLevel: cfg.typesByLevel,
    typesByLevelSource: cfg.typesByLevelSource,
    officesByLevelSource: cfg.officesByLevelSource,
    typesByLevelSourceOffice: cfg.typesByLevelSourceOffice,
    officeByType: cfg.officeByType,
    pathByType: cfg.pathByType,
    paths: cfg.paths,
    tree: cfg.tree,
    majors: majorPayload(),
  };
}

const TRANSITION_FIELDS = [
  { group: '项目基本信息', subGroup: null, code: 'serial', label: '序号', required: false, width: 8 },
  { group: '项目基本信息', subGroup: null, code: 'level', label: '级别', required: true, width: 10 },
  { group: '项目基本信息', subGroup: null, code: 'sourceChannel', label: '项目来源/渠道', required: true, width: 16 },
  { group: '项目基本信息', subGroup: null, code: 'projectType', label: '项目类型', required: true, width: 16 },
  { group: '项目基本信息', subGroup: null, code: 'major1', label: '一级专业', required: true, width: 16 },
  { group: '项目基本信息', subGroup: null, code: 'major2', label: '二级专业', required: true, width: 18 },
  { group: '项目基本信息', subGroup: null, code: 'name', label: '项目名称', required: true, width: 34 },
  { group: '项目基本信息', subGroup: null, code: 'demandUnit', label: '管理/需求单位', required: false, width: 18 },
  { group: '项目基本信息', subGroup: null, code: 'responsibleUnit', label: '责任单位', required: true, width: 16 },
  { group: '项目基本信息', subGroup: null, code: 'projectStatus', label: '项目状态', required: true, width: 12 },
  { group: '项目基本信息', subGroup: null, code: 'acceptanceStatus', label: '验收状态', required: false, width: 12 },
  { group: '项目基本信息', subGroup: null, code: 'owner', label: '负责人', required: false, width: 18, aliases: ['中国商飞内部负责人'] },
  { group: '项目基本信息', subGroup: null, code: 'approvalMonth', label: '项目立项年月', required: false, width: 14 },
  { group: '项目基本信息', subGroup: null, code: 'startMonth', label: '项目开始年月', required: false, width: 14 },
  { group: '项目基本信息', subGroup: null, code: 'endMonth', label: '项目结束年月', required: false, width: 14 },
  { group: '项目基本信息', subGroup: null, code: 'duration', label: '项目周期', required: false, width: 12 },
  { group: '经费情况', subGroup: null, code: 'totalBudget', label: '总经费（万元）', required: true, width: 14, number: true },
  { group: '经费情况', subGroup: '国拨经费', code: 'centralGrant', label: '国拨经费（万元）', required: false, width: 14, number: true },
  { group: '经费情况', subGroup: '国拨经费', code: 'internalGrant', label: '其中商飞内部单位国拨经费（万元）', required: false, width: 22, number: true },
  { group: '经费情况', subGroup: '自筹经费', code: 'selfFund', label: '自筹经费（万元）', required: false, width: 14, number: true },
  { group: '经费情况', subGroup: '自筹经费', code: 'internalSelfFund', label: '其中商飞内部单位自筹经费（万元）', required: false, width: 22, number: true },
  { group: '经费情况', subGroup: '预算情况', code: 'spent', label: '累计支出（万元）', required: false, width: 14, number: true },
  { group: '经费情况', subGroup: '预算情况', code: 'budget2026', label: '2026年预算（万元）', required: false, width: 16, number: true },
  { group: '经费情况', subGroup: '预算情况', code: 'budget2026Actual', label: '2026年实际执行经费（万元）', required: false, width: 18, number: true, ledger: false },
  { group: '经费情况', subGroup: '预算情况', code: 'budget2026Rate', label: '2026年预算执行率', required: false, width: 16, ledger: false },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedActualBudget', label: '已结题项目实际执行经费（万元）', required: false, width: 22, number: true },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedGrantSpent', label: '已结题项目国拨经费执行（万元）', required: false, width: 22, number: true },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedSelfSpent', label: '已结题项目自筹经费执行（万元）', required: false, width: 24, number: true, aliases: ['已结题项目国自筹经费执行（万元）'] },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedExecutionRate', label: '已结题项目经费执行率', required: false, width: 16, aliases: ['执行率'] },
  { group: '转化基本信息', subGroup: null, code: 'resultCount', label: '产生成果数量', required: false, width: 14, number: true },
  { group: '转化基本信息', subGroup: null, code: 'resultNames', label: '生成成果名称', required: false, width: 28, aliases: ['产生成果名称'] },
  { group: '转化基本信息', subGroup: '已转化成果', code: 'convertedCount', label: '已转化数量', required: false, width: 14, number: true },
  { group: '转化基本信息', subGroup: '已转化成果', code: 'convertedNames', label: '转化成果名称', required: false, width: 28 },
  { group: '转化基本信息', subGroup: '已转化成果', code: 'convertedMonth', label: '转化年份', required: false, width: 14, aliases: ['转化年月'] },
  { group: '转化基本信息', subGroup: '已转化成果', code: 'convertedModel', label: '转化型号', required: false, width: 18 },
  { group: '转化基本信息', subGroup: '技术储备成果', code: 'reserveCount', label: '技术成熟度数量', required: false, width: 14, number: true, aliases: ['技术储备数量'] },
  { group: '转化基本信息', subGroup: '技术储备成果', code: 'reserveNames', label: '储备成果名称', required: false, width: 28 },
  { group: '转化基本信息', subGroup: '技术储备成果', code: 'reserveYear', label: '预计转化年度', required: false, width: 14 },
  { group: '转化基本信息', subGroup: null, code: 'remarks', label: '备注', required: false, width: 18 },
].map((field, index) => ({ ...field, index, ledger: field.ledger !== false, headerBanner: Boolean(field.headerBanner) }));

function ledgerTransitionFields() {
  return TRANSITION_FIELDS.filter((f) => f.ledger).map((field, index) => ({ ...field, index }));
}

function audit(userName, action, target, detail) {
  db.prepare('INSERT INTO audit (ts,user_name,action,target,detail) VALUES (?,?,?,?,?)')
    .run(new Date().toISOString().slice(0, 19).replace('T', ' '), userName || '演示用户', action, target, detail);
}

function monthDiff(start, end) {
  if (!start || !end) return null;
  const a = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const b = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
}

function fundSplit(total, level) {
  const grantRatio = level === '国家级' ? 0.62 : level === '地方级' ? 0.42 : 0.08;
  const internalRatio = level === '公司级' ? 0.82 : 0.16;
  const centralGrant = Math.round(total * grantRatio * 10) / 10;
  const internalFund = Math.round(total * internalRatio * 10) / 10;
  const selfFund = Math.max(0, Math.round((total - centralGrant - internalFund) * 10) / 10);
  return { centralGrant, selfFund, internalFund };
}

function v19LedgerFields(p, funds, delivered, delivTotal) {
  const channel = db.prepare('SELECT key,name,dept,org FROM channels WHERE id=?').get(p.channel_id) || {};
  const unit = db.prepare('SELECT short,name FROM units WHERE id=?').get(p.lead_unit_id) || {};
  const mapped = V19_MAJOR_BY_CHANNEL[channel.key];
  const fallback = getMajorConfig().major1[0]
    ? [getMajorConfig().major1[0], (getMajorConfig().major2ByMajor1[getMajorConfig().major1[0]] || [])[0] || '']
    : ['10-总体气动', '1001-总体与气动'];
  const storedMaj = validateMajorPair(p.major1, p.major2);
  const major = storedMaj.ok ? [storedMaj.major1, storedMaj.major2] : (mapped || fallback);
  const majorCheck = validateMajorPair(major[0], major[1]);
  const major1 = majorCheck.ok ? majorCheck.major1 : major[0];
  const major2 = majorCheck.ok ? majorCheck.major2 : major[1];
  const profile = db.prepare('SELECT * FROM project_finance_profile WHERE project_id=?').get(p.id) || {};
  const spentAll = funds.reduce((s, f) => s + f.spent, 0);
  const execRate = p.total_budget ? Math.round((spentAll / p.total_budget) * 100) : 0;
  const pkgs = db.prepare('SELECT status,mode,form FROM packages WHERE project_id=?').all(p.id);
  const collaborators = db.prepare('SELECT total,blacklisted FROM collaborators WHERE project_id=?').all(p.id);
  return {
    major1,
    major2,
    launchMonth: p.start?.slice(0, 7) || '',
    endMonth: p.end?.slice(0, 7) || '',
    projectMonths: monthDiff(p.start, p.end),
    managerUnit: channel.dept || '科研项目处',
    demandUnit: p.demand_unit || (p.level === '公司级' ? '公司总部科技管理部' : channel.org || '上级主管部门'),
    responsibleUnit: unit.name || '',
    leadWork: p.lead_work || `${unit.short || '牵头单位'}牵头；${(p.goal || '').slice(0, 44)}${p.goal && p.goal.length > 44 ? '…' : ''}`,
    plannedPartners: J(p.partners_json, []).map((x) => x.name).join('、'),
    centralGrant: Number(profile.central_grant || 0),
    selfFund: Number(profile.self_fund || 0),
    internalFund: Number(profile.internal_grant || 0) + Number(profile.internal_self_fund || 0),
    cumulativeSpent: Math.round(spentAll * 10) / 10,
    closingActual: ['已验收', '已终止'].includes(p.status) ? Math.round(spentAll * 10) / 10 : null,
    executionRate: execRate,
    deliverableSummary: `${delivered}/${delivTotal} 已交付`,
    collaboratorSummary: `${collaborators.filter((c) => c.total != null).length}/${collaborators.length} 已评价${collaborators.some((c) => c.blacklisted === 1) ? '，含黑名单' : ''}`,
    transformCount: pkgs.length,
    transformSummary: pkgs.length ? `${pkgs.length} 个成果包；${pkgs.filter((k) => k.status === '已完成').length} 个已完成` : (p.transform_status || '未形成成果包'),
  };
}

function packageColor(k, today) {
  return k.status === '已完成' ? 'green' : statusColor(k.plan_date, k.actual_date, today);
}

function transformationTarget(k) {
  const text = `${k.detail || ''}${k.brief || ''}`;
  const m = text.match(/应用对象[：:](.*?)(；|;|。|$)/);
  if (m) return m[1].trim();
  if (k.mode === '向型号转化') return k.form === '装机' ? '在研型号/装机应用' : '型号预研/未装机验证';
  return '市场交易对象待确认';
}

const SESSION_TTL_HOURS = Math.max(1, Number(process.env.SRPM_SESSION_TTL_HOURS || 12));
const MAX_SESSIONS_PER_USER = Math.max(1, Number(process.env.SRPM_MAX_SESSIONS_PER_USER || 8));
const LOGIN_WINDOW_MINUTES = 15;
const MAX_LOGIN_FAILURES = 5;

function sessionToken(req) {
  const direct = String(req.header('x-session') || '').trim();
  if (direct) return direct;
  const authorization = String(req.header('authorization') || '').trim();
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  if (!user) return null;
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

function currentUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const now = new Date().toISOString();
  const user = db.prepare(`
    SELECT u.* FROM login_sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?
  `).get(tokenHash(token), now);
  if (!user || user.status === '已离岗') return null;
  return publicUser(user);
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: '登录已失效或账号无效，请重新登录' });
    return null;
  }
  return user;
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 80);
}

function safeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 用户认证字段：个人密码哈希 + 六位工号 */
function ensureUserAuthColumns() {
  const cols = db.prepare("pragma table_info(users)").all().map((c) => c.name);
  if (!cols.includes('password_hash')) {
    db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run();
  }
  if (!cols.includes('emp_no')) {
    db.prepare('ALTER TABLE users ADD COLUMN emp_no TEXT').run();
  }
  if (!cols.includes('form_access')) {
    db.prepare('ALTER TABLE users ADD COLUMN form_access INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!cols.includes('form_scope')) {
    db.prepare('ALTER TABLE users ADD COLUMN form_scope TEXT').run();
  }
  if (!cols.includes('form_scope_keys')) {
    db.prepare('ALTER TABLE users ADD COLUMN form_scope_keys TEXT').run();
  }
}
ensureUserAuthColumns();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = createHash('sha256').update(`${salt}:${String(password)}`).digest('hex');
  return `sha256$${salt}$${digest}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const [, salt, expect] = parts;
  const actual = createHash('sha256').update(`${salt}:${String(password)}`).digest('hex');
  return safeEqualText(actual, expect);
}

function isEmpNo(id) {
  return /^\d{6}$/.test(String(id || ''));
}

function assertAdminUser(req, res) {
  const user = req.user || requireUser(req, res);
  if (!user) return null;
  if (!requireRoles(user, res, ['admin'], '仅系统管理员可执行此操作')) return null;
  return user;
}

const USER_ROLES = new Set(['team', 'contact', 'mgmt', 'finance', 'chief', 'leader', 'admin']);
const USER_SCOPES = new Set(['self', 'unit', 'hq', 'chief']);
const FORM_SCOPES = new Set(['hq', 'unit', 'channel', 'type', 'self']);
const FORM_SCOPE_LABEL = {
  hq: '总部（全部台账）',
  unit: '本单位',
  channel: '指定渠道（按渠道授权）',
  type: '项目类型主管（按类型授权）',
  self: '仅本人',
};

function parseFormScopeKeys(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
  const v = J(raw, []);
  return Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

function isHqTechUnitId(unitId) {
  if (unitId == null || unitId === '') return false;
  const u = db.prepare('SELECT name, short FROM units WHERE id=?').get(Number(unitId));
  if (!u) return false;
  return /总部科技/.test(`${u.short || ''}${u.name || ''}`);
}

function canAccessFormTool(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Number(user.form_access) === 1;
}

function normalizeFormAccess(body, unitId, existing) {
  if (!isHqTechUnitId(unitId)) {
    return { form_access: 0, form_scope: null, form_scope_keys: null };
  }
  const hasField = body && Object.prototype.hasOwnProperty.call(body, 'form_access');
  if (!hasField && existing) {
    return {
      form_access: Number(existing.form_access) === 1 ? 1 : 0,
      form_scope: existing.form_scope || null,
      form_scope_keys: existing.form_scope_keys || null,
    };
  }
  const on = body?.form_access === true || body?.form_access === 1 || body?.form_access === '1' || body?.form_access === 'true';
  if (!on) return { form_access: 0, form_scope: null, form_scope_keys: null };
  const scope = String(body?.form_scope || 'hq').trim();
  if (!FORM_SCOPES.has(scope)) return { error: '表单维护权限范围不合法' };
  let keys = parseFormScopeKeys(body?.form_scope_keys);
  if ((scope === 'channel' || scope === 'type') && !keys.length) {
    return { error: scope === 'channel' ? '请选择授权渠道' : '请选择授权项目类型' };
  }
  if (scope !== 'channel' && scope !== 'type') keys = [];
  return { form_access: 1, form_scope: scope, form_scope_keys: JSON.stringify(keys) };
}

function filterTransitionRowsForUser(user, rows) {
  if (!user) return [];
  if (user.role === 'admin' || Number(user.form_access) !== 1) {
    if (user.role === 'admin') return rows;
    return [];
  }
  const scope = user.form_scope || 'hq';
  const keys = parseFormScopeKeys(user.form_scope_keys);
  const name = String(user.name || '');
  const unit = user.unit_id != null ? db.prepare('SELECT name, short FROM units WHERE id=?').get(user.unit_id) : null;
  const unitNames = [unit?.name, unit?.short].filter(Boolean);
  return rows.filter((row) => {
    if (scope === 'hq') return true;
    if (scope === 'self') {
      return [row.owner, row.updatedBy].some((x) => x && String(x).includes(name));
    }
    if (scope === 'unit') {
      const blob = [row.responsibleUnit, row.demandUnit, row.orgOffice, row.leadWork].join(' ');
      return unitNames.some((n) => blob.includes(n));
    }
    if (scope === 'channel') {
      const ch = cellText(row.sourceChannel || row.channel);
      return keys.some((k) => ch === k || ch.includes(k));
    }
    if (scope === 'type') {
      const t = cellText(row.projectType || row.sourceType);
      return keys.some((k) => t === k || t.includes(k));
    }
    return false;
  });
}

function formAccessMeta(user) {
  const can = canAccessFormTool(user);
  const scope = user?.role === 'admin' ? 'hq' : (user?.form_scope || null);
  return {
    canFormMaintain: can,
    form_access: can ? 1 : 0,
    form_scope: can ? (scope || 'hq') : null,
    form_scope_label: can ? (user?.role === 'admin' ? '系统管理员（全部）' : (FORM_SCOPE_LABEL[scope] || FORM_SCOPE_LABEL.hq)) : '无',
    form_scope_keys: parseFormScopeKeys(user?.form_scope_keys),
    canReplaceAll: can && (user?.role === 'admin' || (user?.form_scope || 'hq') === 'hq'),
  };
}

function canReplaceAllTransition(user) {
  return !!formAccessMeta(user).canReplaceAll;
}

function assertRowInScope(user, row) {
  return filterTransitionRowsForUser(user, [row]).length > 0;
}



function loginIsBlocked(username, ip) {
  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM login_attempts
    WHERE username=? AND ip_address=? AND succeeded=0 AND attempted_at>=?
  `).get(username, ip, cutoff);
  return Number(row?.n || 0) >= MAX_LOGIN_FAILURES;
}

function recordLoginAttempt(username, ip, succeeded) {
  db.prepare('INSERT INTO login_attempts (username,ip_address,attempted_at,succeeded) VALUES (?,?,?,?)')
    .run(username, ip, new Date().toISOString(), succeeded ? 1 : 0);
  db.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now','-2 days')").run();
}

function createSession(req, user) {
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_HOURS * 3600_000);
  db.transaction(() => {
    db.prepare('DELETE FROM login_sessions WHERE expires_at<=?').run(createdAt.toISOString());
    const old = db.prepare(`
      SELECT token_hash FROM login_sessions WHERE user_id=?
      ORDER BY created_at DESC LIMIT -1 OFFSET ?
    `).all(user.id, MAX_SESSIONS_PER_USER - 1);
    const remove = db.prepare('DELETE FROM login_sessions WHERE token_hash=?');
    for (const row of old) remove.run(row.token_hash);
    db.prepare(`
      INSERT INTO login_sessions
        (token_hash,user_id,created_at,expires_at,ip_address,user_agent)
      VALUES (?,?,?,?,?,?)
    `).run(
      tokenHash(token), user.id, createdAt.toISOString(), expiresAt.toISOString(),
      clientIp(req), String(req.header('user-agent') || '').slice(0, 300),
    );
  })();
  return { token, expiresAt: expiresAt.toISOString() };
}

function assertWritable(user, res) {
  if (user.role === 'leader') {
    res.status(403).json({ error: '领导角色为只读查看权限，不可执行业务操作' });
    return false;
  }
  return true;
}

function isTechTeamRole(role) {
  return role === 'team' || role === 'contact';
}

function requireRoles(user, res, roles, msg = '当前角色无权执行此操作') {
  const allowed = roles.includes('team') ? [...new Set([...roles, 'contact'])] : roles;
  if (!allowed.includes(user.role)) {
    res.status(403).json({ error: msg });
    return false;
  }
  return true;
}

function canAccessProject(user, project) {
  if (!user || !project) return false;
  return scopeProjects(user, [project]).length > 0;
}

function canActApprovalStep(user, approval, step) {
  if (!user || !step) return false;
  if (user.role === 'admin') return true;
  if (!step.assignee && !step.assigneeId) return false;
  return step.assignee === user.name || (step.assigneeId && String(step.assigneeId) === String(user.emp_no || user.id));
}

function canAccessPreResearch(user) {
  if (!user) return false;
  if (user.role === 'leader') return true;
  if (user.role === 'mgmt' && user.scope === 'hq') return true;
  if (user.role === 'admin') return true;
  return false;
}

/** 平台身份（登录）≠ 项目岗位。同一人可在不同项目担任不同岗位，权限按本项目 team_json 岗位取并集。 */
const PROJECT_DUTY_DEFS = [
  { key: 'contact', label: '项目联系人', group: '项目团队' },
  { key: 'owner', label: '项目负责人', group: '项目团队' },
  { key: 'tech', label: '技术负责人', group: '项目团队' },
  { key: 'pm', label: '项目主管', group: '项目团队' },
  { key: 'chief1', label: '一级总师', group: '技术把关' },
  { key: 'chief2', label: '二级总师', group: '技术把关' },
  { key: 'hqHead', label: '总部处室处长', group: '管理' },
  { key: 'hqStaff', label: '总部处室主管', group: '管理' },
  { key: 'unitDeptHead', label: '单位科技部长', group: '管理' },
  { key: 'unitStaff', label: '单位科技主管', group: '管理' },
  { key: 'finHq', label: '总部财务主管', group: '财务' },
  { key: 'finHead', label: '单位财务部长', group: '财务' },
  { key: 'finStaff', label: '单位财务主管', group: '财务' },
];

/** 能进入该项目的人始终可见，岗位矩阵不得关闭（与项目详情页签/概览字段一一对应） */
const PROJECT_VIEW_ALWAYS = {
  tabs: [
    { key: 'overview', label: '概览' },
    { key: 'milestones', label: '里程碑' },
    { key: 'plans', label: '计划' },
    { key: 'funds', label: '经费' },
    { key: 'deliverables', label: '交付物' },
    { key: 'collab', label: '协作评价' },
    { key: 'transform', label: '成果转化' },
    { key: 'records', label: '审批与归档' },
  ],
  overviewFields: ['项目目标', '年度目标', '项目渠道', '渠道流程', '成果转化状态', '协作单位'],
};

const PROJECT_PERM_DEFS = [
  { code: 'baseinfo_edit', group: '概览', label: '完善基本信息' },
  { code: 'milestone_plan', group: '里程碑', label: '编制里程碑计划' },
  { code: 'milestone_close', group: '里程碑', label: '里程碑销项' },
  { code: 'plan_manage', group: '计划', label: '计划填报/办结' },
  { code: 'funds_submit', group: '经费', label: '经费提报' },
  { code: 'deliverable_manage', group: '交付物', label: '交付物维护/交付' },
  { code: 'eval_collaborator', group: '协作评价', label: '协作单位评价' },
  { code: 'transform_update', group: '成果转化', label: '更新成果转化' },
  { code: 'declare_submit', group: '审批与归档', label: '发起申报' },
  { code: 'filing_upload', group: '审批与归档', label: '上传立项备案材料' },
  { code: 'initiate_approval', group: '审批与归档', label: '发起审批并上传材料' },
  { code: 'assess_submit', group: '审批与归档', label: '评估检查填报' },
  { code: 'change_submit', group: '审批与归档', label: '项目/数据变更' },
  { code: 'contract_register', group: '审批与归档', label: '外协合同登记' },
  { code: 'accept_apply', group: '审批与归档', label: '发起验收申请' },
  { code: 'members_edit', group: '审批与归档', label: '指定/转办项目岗位' },
];

const DEFAULT_DUTY_PERMS = {
  contact: ['declare_submit', 'filing_upload', 'initiate_approval', 'transform_update', 'members_edit'],
  owner: ['baseinfo_edit', 'assess_submit', 'change_submit', 'accept_apply', 'transform_update', 'initiate_approval', 'eval_collaborator', 'members_edit'],
  tech: ['milestone_plan', 'milestone_close', 'deliverable_manage', 'initiate_approval'],
  pm: ['baseinfo_edit', 'plan_manage', 'contract_register', 'initiate_approval'],
  chief1: [],
  chief2: [],
  hqHead: [],
  hqStaff: [],
  unitDeptHead: ['members_edit'],
  unitStaff: ['members_edit'],
  finHq: ['funds_submit'],
  finHead: ['funds_submit'],
  finStaff: ['funds_submit'],
};

const RBAC_DUTY_KV = 'rbac.dutyPerms.v1';

function dutyLabelOf(key) {
  return PROJECT_DUTY_DEFS.find((d) => d.key === key)?.label || key;
}

function emptyPermMap() {
  return Object.fromEntries(PROJECT_PERM_DEFS.map((p) => [p.code, false]));
}

function sameProjectPerson(slot, user) {
  const s = String(slot || '').trim();
  if (!s || !user) return false;
  if (s === user.name) return true;
  const emp = String(user.emp_no || user.id || '').trim();
  if (emp && (s === emp || s.includes(`（${emp}）`) || s.includes(`(${emp})`))) return true;
  return false;
}

function projectDutiesOf(user, project) {
  if (!user || !project) return [];
  const pid = Number(project.id);
  if (Number.isFinite(pid) && pid > 0) {
    const emp = String(user.emp_no || user.id || '');
    const rows = db.prepare('SELECT slot FROM project_members WHERE project_id=? AND (emp_no=? OR emp_no=? OR name=?)').all(pid, emp, String(user.id || ''), user.name);
    if (rows.length) return [...new Set(rows.map((r) => r.slot))];
  }
  const team = project.team_json != null ? J(project.team_json, {}) : (project.team || {});
  return PROJECT_DUTY_DEFS.map((d) => d.key).filter((key) => sameProjectPerson(team[key], user));
}

function loadDutyPermMatrix() {
  const raw = J(db.prepare('SELECT value FROM kv WHERE key=?').get(RBAC_DUTY_KV)?.value, null);
  const out = {};
  for (const d of PROJECT_DUTY_DEFS) {
    const fallback = DEFAULT_DUTY_PERMS[d.key] || [];
    const saved = raw && Array.isArray(raw[d.key]) ? raw[d.key] : fallback;
    out[d.key] = saved.filter((code) => PROJECT_PERM_DEFS.some((p) => p.code === code));
  }
  return out;
}

function permsForDuties(duties) {
  const matrix = loadDutyPermMatrix();
  const set = new Set();
  for (const d of duties || []) (matrix[d] || []).forEach((code) => set.add(code));
  return set;
}

function projectAuthPayload(user, project, opts = {}) {
  const readonly = Boolean(opts.readonly || project?.ledgerSource || project?.readonly);
  if (!user || !project || readonly) {
    return { myDuties: [], myDutyLabels: [], myPerms: emptyPermMap(), viewAlways: PROJECT_VIEW_ALWAYS };
  }
  const duties = projectDutiesOf(user, project);
  const set = permsForDuties(duties);
  if (user.role === 'admin') PROJECT_PERM_DEFS.forEach((p) => set.add(p.code));
  return {
    myDuties: duties,
    myDutyLabels: duties.map(dutyLabelOf),
    myPerms: Object.fromEntries(PROJECT_PERM_DEFS.map((p) => [p.code, set.has(p.code)])),
    viewAlways: PROJECT_VIEW_ALWAYS,
  };
}

function requireProjectPerm(user, res, project, perm, msg) {
  if (!assertWritable(user, res)) return false;
  if (!project) {
    res.status(404).json({ error: 'not found' });
    return false;
  }
  if (user.role === 'admin') return true;
  const auth = projectAuthPayload(user, project);
  if (auth.myPerms[perm]) return true;
  const jobs = auth.myDutyLabels.length ? `本项目岗位：${auth.myDutyLabels.join('、')}` : '您未担任本项目岗位';
  res.status(403).json({ error: `${msg || '当前项目岗位无权执行此操作'}（${jobs}）` });
  return false;
}

function listUserProjectDuties(user) {
  if (!user) return [];
  return db.prepare('SELECT id,code,name,status,team_json FROM projects ORDER BY id').all()
    .map((p) => {
      const duties = projectDutiesOf(user, p);
      if (!duties.length) return null;
      return { projectId: p.id, code: p.code, name: p.name, status: p.status, duties, labels: duties.map(dutyLabelOf) };
    })
    .filter(Boolean);
}

function ensureProjectMembersTable() {
  db.exec(`CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    slot TEXT NOT NULL,
    emp_no TEXT NOT NULL,
    name TEXT NOT NULL,
    assigned_at TEXT,
    assigned_by TEXT,
    PRIMARY KEY (project_id, slot)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_members_emp ON project_members(emp_no)');
}

function resolvePerson(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/(\d{6})/);
  if (m) {
    const u = db.prepare("SELECT * FROM users WHERE (emp_no=? OR id=?) AND status='在岗'").get(m[1], m[1]);
    if (u) return u;
  }
  return db.prepare("SELECT * FROM users WHERE name=? AND status='在岗'").get(s) || null;
}

function assignedTeamOf(projectId) {
  const rows = db.prepare('SELECT slot, emp_no, name FROM project_members WHERE project_id=?').all(Number(projectId));
  const team = {};
  for (const r of rows) team[r.slot] = r.name;
  if (rows.length) return team;
  const p = db.prepare('SELECT team_json FROM projects WHERE id=?').get(Number(projectId));
  return J(p?.team_json, {});
}

function writeProjectMembers(projectId, teamObj, actorName) {
  const pid = Number(projectId);
  const ins = db.prepare('INSERT OR REPLACE INTO project_members (project_id,slot,emp_no,name,assigned_at,assigned_by) VALUES (?,?,?,?,?,?)');
  const del = db.prepare('DELETE FROM project_members WHERE project_id=? AND slot=?');
  const next = {};
  for (const d of PROJECT_DUTY_DEFS) {
    const raw = teamObj ? teamObj[d.key] : '';
    const u = resolvePerson(raw);
    if (!u) {
      del.run(pid, d.key);
      continue;
    }
    ins.run(pid, d.key, u.emp_no || u.id, u.name, TODAY(), actorName || '');
    next[d.key] = u.name;
  }
  db.prepare('UPDATE projects SET team_json=? WHERE id=?').run(JSON.stringify(next), pid);
  return next;
}

function seedProjectMembersFromTeamJson() {
  const projects = db.prepare('SELECT id, team_json FROM projects').all();
  const ins = db.prepare('INSERT OR IGNORE INTO project_members (project_id,slot,emp_no,name,assigned_at,assigned_by) VALUES (?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    for (const p of projects) {
      const exists = db.prepare('SELECT 1 FROM project_members WHERE project_id=? LIMIT 1').get(p.id);
      if (exists) continue;
      const team = J(p.team_json, {});
      for (const d of PROJECT_DUTY_DEFS) {
        const u = resolvePerson(team[d.key]);
        if (!u) continue;
        ins.run(p.id, d.key, u.emp_no || u.id, u.name, TODAY(), 'migrate');
      }
    }
  });
  tx();
}

function slotForStepTitle(title) {
  const t = String(title || '');
  if (/联系人|团队填|团队提交|团队编制|项目组填|上传|发起|项目团队填写/.test(t)) return 'contact';
  if (/项目负责人/.test(t)) return 'owner';
  if (/技术负责人/.test(t)) return 'tech';
  if (/项目主管/.test(t)) return 'pm';
  if (/一级总师/.test(t)) return 'chief1';
  if (/二级|三级.*总师|责任总师|学术委员会|专委会/.test(t)) return 'chief2';
  if (/理事会|技术发展战略委员会/.test(t)) return 'chief1';
  if (/总部.*财务/.test(t)) return 'finHq';
  if (/单位财务.*负责人|财务部门审核|单位财务部/.test(t)) return 'finHead';
  if (/单位财务/.test(t)) return 'finStaff';
  if (/单位分管|承担部门负责人|单位科技.*负责人|单位科技部审核|单位科技管理部/.test(t)) return 'unitDeptHead';
  if (/二级单位.*管理|二级单位.*主管|单位管理|单位审查|单位内部|单位科技/.test(t)) return 'unitDeptHead';
  if (/总部|科研项目处|科技发展处|科技管理部|上报GXB|归档回执/.test(t)) return 'hqHead';
  if (/法务|合规/.test(t)) return 'unitDeptHead';
  return '';
}

function reassignOpenSteps(projectId, slot, person) {
  if (!person || !slot) return 0;
  const rows = db.prepare("SELECT * FROM approvals WHERE project_id=? AND status='审批中'").all(Number(projectId));
  let n = 0;
  for (const a of rows) {
    const steps = J(a.steps_json, []);
    let changed = false;
    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i].status === 'approved' || steps[i].status === 'rejected') continue;
      if (slotForStepTitle(steps[i].title) !== slot) continue;
      steps[i] = { ...steps[i], assignee: person.name, assigneeId: person.emp_no || person.id };
      changed = true;
      n += 1;
    }
    if (changed) db.prepare('UPDATE approvals SET steps_json=? WHERE id=?').run(JSON.stringify(steps), a.id);
  }
  return n;
}

function canEditProjectMembers(user, project) {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'mgmt' && (user.scope === 'hq' || (user.scope === 'unit' && user.unit_id === project.lead_unit_id))) return true;
  return projectAuthPayload(user, project).myPerms.members_edit === true;
}

function isCurrentStepAssignee(user, step) {
  if (!user || !step) return false;
  if (step.assignee === user.name) return true;
  return Boolean(step.assigneeId && String(step.assigneeId) === String(user.emp_no || user.id));
}

function participatedApproval(user, a) {
  if (!user || !a) return false;
  const steps = Array.isArray(a.steps) ? a.steps : J(a.steps_json, []);
  const emp = String(user.emp_no || user.id || '');
  return steps.some((s) => s.assignee === user.name || s.actor === user.name || (s.assigneeId && String(s.assigneeId) === emp));
}

function canSeeApproval(user, a) {
  if (!user || !a) return false;
  if (user.role === 'admin' || user.role === 'leader' || (user.role === 'mgmt' && user.scope === 'hq')) return true;
  if (a.initiator === user.name) return true;
  if (user.scope === 'unit' && a.unit_id === user.unit_id) return true;
  if (participatedApproval(user, a)) return true;
  if (a.project_id) {
    const p = db.prepare('SELECT * FROM projects WHERE id=?').get(a.project_id);
    if (p && canAccessProject(user, p)) return true;
  }
  return false;
}

function withApprovalAuth(user, a) {
  const mapped = a && Array.isArray(a.steps) ? a : mapApproval(a);
  const step = mapped.steps?.[mapped.current_step];
  return { ...mapped, canAct: mapped.status === '审批中' && canActApprovalStep(user, mapped, step) };
}

const ROLE_DEPT = {
  team: '项目团队', contact: '项目团队', mgmt: '管理团队',
  finance: '财务', chief: '责任总师', leader: '领导', admin: '系统管理员',
};

function mapRosterPerson(u) {
  const title = String(u.title || '');
  const parts = title.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  const dept = parts[0] || ROLE_DEPT[u.role] || '';
  const unitName = u.unit_name || u.unitName || '';
  const unitShort = u.unit_short || u.unitShort || '';
  return {
    id: u.id,
    empNo: u.emp_no,
    name: u.name,
    role: u.role,
    title,
    dept,
    duty: parts[1] || title || dept,
    unitId: u.unit_id,
    unitName,
    unitShort,
    scope: u.scope,
    label: u.emp_no ? `${u.name}（${u.emp_no}）` : u.name,
  };
}

function rosterPeople() {
  return db.prepare(`
    SELECT u.id, u.emp_no, u.name, u.role, u.title, u.unit_id, u.scope,
           un.name AS unit_name, un.short AS unit_short
    FROM users u
    LEFT JOIN units un ON un.id = u.unit_id
    WHERE u.status='在岗'
    ORDER BY u.emp_no
  `).all().map(mapRosterPerson);
}

const MACRO_OWNER_SLOT = {
  declare: 'contact', filing: 'contact', baseinfo: 'pm', milestone: 'tech',
  plan: 'pm', finance: 'finStaff', assess: 'owner', change: 'owner',
  accept: 'owner', transform: 'owner',
};

ensureProjectMembersTable();
seedProjectMembersFromTeamJson();

function ensureProjectDeclareColumns() {
  const cols = new Set(db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name));
  const add = (name, ddl) => { if (!cols.has(name)) db.exec(`ALTER TABLE projects ADD COLUMN ${ddl}`); };
  add('major1', 'major1 TEXT');
  add('major2', 'major2 TEXT');
  add('demand_unit', 'demand_unit TEXT');
  add('lead_work', 'lead_work TEXT');
}
ensureProjectDeclareColumns();

const PUBLIC_API = new Set(['/bootstrap', '/login', '/cascade', '/ai/status']);

// 业务接口强制登录；bootstrap / login / cascade 放行
r.use((req, res, next) => {
  if (PUBLIC_API.has(req.path)) return next();
  const user = requireUser(req, res);
  if (!user) return;
  req.user = user;
  next();
});

/** 账号密码登录 */
r.post('/login', (req, res) => {
  // 六位工号登录
  const username = String(req.body?.username || req.body?.empNo || req.body?.emp_no || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: '请输入工号和密码' });
  const ip = clientIp(req);
  if (loginIsBlocked(username, ip)) {
    return res.status(429).json({ error: '登录失败次数过多，请15分钟后重试' });
  }
  if (!isEmpNo(username)) {
    recordLoginAttempt(username, ip, false);
    return res.status(400).json({ error: '请输入六位数字工号' });
  }
  const user = db.prepare('SELECT * FROM users WHERE emp_no=? OR id=?').get(username, username);
  if (!user) {
    recordLoginAttempt(username, ip, false);
    return res.status(401).json({ error: '工号或密码错误' });
  }
  if (user.status === '已离岗') return res.status(401).json({ error: '该账号已离岗，权限已自动回收' });
  let authed = false;
  if (user.password_hash) {
    authed = verifyPassword(password, user.password_hash);
  } else if (user.emp_no && safeEqualText(password, String(user.emp_no))) {
    authed = true;
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), user.id);
  }
  if (!authed) {
    recordLoginAttempt(username, ip, false);
    return res.status(401).json({ error: '工号或密码错误' });
  }
  recordLoginAttempt(username, ip, true);
  const session = createSession(req, user);
  res.json({
    ...publicUser(user),
    canPreResearch: canAccessPreResearch(user),
    ...formAccessMeta(user),
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  });
});

r.get('/session', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  res.json({
    ...publicUser(user),
    canPreResearch: canAccessPreResearch(user),
    ...formAccessMeta(user),
    projectDutyHint: '平台身份决定登录入口与组织范围；项目内操作按「本项目岗位」授权，同一人在不同项目可有不同权限。',
  });
});

r.post('/logout', (req, res) => {
  const token = sessionToken(req);
  if (token) db.prepare('DELETE FROM login_sessions WHERE token_hash=?').run(tokenHash(token));
  res.json({ ok: true });
});

// ---------- 项目富化 ----------
function enrichProject(p, today) {
  const ms = db.prepare('SELECT * FROM milestones WHERE project_id=? ORDER BY due').all(p.id);
  const msColors = ms.map((m) => statusColor(m.due, m.done_at, today));
  const deliverableRows = db.prepare('SELECT due,delivered_at FROM deliverables WHERE project_id=?').all(p.id);
  const deliverableColors = deliverableRows.map((d) => statusColor(d.due, d.delivered_at, today));
  const packageRows = db.prepare('SELECT plan_date,actual_date,status FROM packages WHERE project_id=?').all(p.id);
  const packageColors = packageRows.map((k) => k.status === '已完成' ? 'green' : statusColor(k.plan_date, k.actual_date, today));
  const openMs = ms.filter((m) => !m.done_at);
  const operationalColors = [...msColors, ...deliverableColors, ...packageColors];
  // 项目主状态不得覆盖下游红黄风险；只有所有受控对象闭环时才能显示绿色。
  const color = p.status === '已终止' ? 'green'
    : operationalColors.length === 0 ? (p.status === '已验收' ? 'green' : 'blue') : worstColor(operationalColors);
  const funds = db.prepare('SELECT * FROM funds WHERE project_id=? ORDER BY year').all(p.id);
  const yearFund = funds.find((f) => f.year === Number(today.slice(0, 4)));
  const spentAll = funds.reduce((s, f) => s + f.spent, 0);
  const delivered = db.prepare('SELECT COUNT(*) n FROM deliverables WHERE project_id=? AND delivered_at IS NOT NULL').get(p.id).n;
  const delivTotal = db.prepare('SELECT COUNT(*) n FROM deliverables WHERE project_id=?').get(p.id).n;
  const doneMs = ms.filter((m) => m.done_at).length;
  const v19 = v19LedgerFields(p, funds, delivered, delivTotal);
  const rawTeam = assignedTeamOf(p.id);
  const team = {};
  for (const d of PROJECT_DUTY_DEFS) team[d.key] = rawTeam[d.key] || '';
  return {
    ...p,
    partners: J(p.partners_json, []),
    team,
    teamMembers: teamMembersPayload(team),
    tags: J(p.tags_json, []),
    ledgerSource: false,
    v19,
    color,
    msTotal: ms.length,
    msDone: doneMs,
    progress: ms.length ? Math.round((doneMs / ms.length) * 100) : (p.status === '已验收' ? 100 : 0),
    nextMilestone: openMs[0] ? { title: openMs[0].title, due: openMs[0].due, daysLeft: daysLeft(openMs[0].due, today) } : null,
    spentAll: Math.round(spentAll * 10) / 10,
    yearBudget: yearFund ? yearFund.budget : 0,
    yearSpent: yearFund ? yearFund.spent : 0,
    delivered,
    delivTotal,
  };
}

function scopeProjects(user, rows) {
  if (!user) return [];
  if (user.role === 'admin' || user.role === 'leader') return rows;
  if (user.role === 'mgmt' && user.scope === 'hq') return rows;
  const emp = String(user.emp_no || user.id || '');
  const memberIds = new Set(
    db.prepare('SELECT project_id FROM project_members WHERE emp_no=? OR emp_no=? OR name=?').all(emp, String(user.id || ''), user.name).map((r) => r.project_id),
  );
  if ((user.role === 'mgmt' || user.role === 'finance') && user.scope === 'unit') {
    return rows.filter((p) => p.lead_unit_id === user.unit_id || memberIds.has(p.id));
  }
  return rows.filter((p) => memberIds.has(p.id));
}

// ---------- 基础 ----------
r.get('/bootstrap', (req, res) => {
  const units = db.prepare('SELECT * FROM units').all();
  const channels = db.prepare('SELECT * FROM channels').all().map(mapChannelRow);
  // 未登录返回演示账号名单，供登录页折叠入口；不含密码。
  const users = db.prepare('SELECT * FROM users WHERE status=? ORDER BY emp_no').all('在岗').map(publicUser);
  res.json({ today: TODAY(), units, channels, users, cascade: cascadePayload() });
});

r.get('/cascade', (_req, res) => {
  res.json(cascadePayload());
});

function channelMetaById() {
  return Object.fromEntries(db.prepare('SELECT * FROM channels').all().map((c) => [c.id, c]));
}

/** 按四级级联 + 附件1专业字典参数过滤项目列表（兼容旧 channel=id） */
function applyCascadeProjectFilters(list, query) {
  const {
    level, channel, sourceChannel, orgOffice, projectType, unit, status, color, kw,
    major1, major2,
  } = query || {};
  const meta = channelMetaById();
  let out = list;
  if (level) out = out.filter((p) => p.level === level);
  if (sourceChannel) {
    out = out.filter((p) => (meta[p.channel_id]?.source_channel || p.sourceChannel || '') === String(sourceChannel));
  }
  if (orgOffice) {
    out = out.filter((p) => {
      const m = meta[p.channel_id];
      return (m?.org_office || m?.org || p.orgOffice || '') === String(orgOffice);
    });
  }
  if (projectType) {
    out = out.filter((p) => (meta[p.channel_id]?.name || p.projectType || '') === String(projectType));
  }
  if (channel) out = out.filter((p) => String(p.channel_id) === String(channel) || String(p.projectType || '') === String(channel));
  if (unit) {
    out = out.filter((p) => {
      if (String(p.lead_unit_id) === String(unit)) return true;
      const u = db.prepare('SELECT name, short FROM units WHERE id=?').get(Number(unit));
      if (!u) return false;
      const blob = `${p.v19?.responsibleUnit || ''} ${p.v19?.demandUnit || ''}`;
      return (u.name && blob.includes(u.name)) || (u.short && blob.includes(u.short));
    });
  }
  if (major1) {
    out = out.filter((p) => (p.v19?.major1 || p.major1 || '') === String(major1));
  }
  if (major2) {
    out = out.filter((p) => (p.v19?.major2 || p.major2 || '') === String(major2));
  }
  if (status) out = out.filter((p) => p.status === status);
  if (color) out = out.filter((p) => p.color === color);
  if (kw) out = out.filter((p) => p.name.includes(kw) || p.code.includes(kw));
  return out;
}

function monthToDate(value) {
  const t = cellText(value);
  if (!t) return '';
  const m = t.match(/^(\d{4})[.\-/年](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-01`;
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  return t.slice(0, 10);
}

function mapLedgerStatus(row) {
  const st = String(row.projectStatus || '');
  if (/终止|中止/.test(st)) return '已终止';
  if (/已验收|验收完成/.test(st)) return '已验收';
  if (/完成|结题/.test(st)) return '已验收';
  if (/验收/.test(st)) return '验收中';
  if (/立项/.test(st)) return '立项中';
  if (/申报/.test(st)) return '申报中';
  if (/延期|逾期|执行|实施|进行/.test(st)) return '实施中';
  return st || '实施中';
}

function mapLedgerColor(row, status) {
  const st = String(row.projectStatus || '');
  if (/延期|逾期/.test(st)) return 'red';
  if (status === '已验收' || status === '已终止') return 'green';
  const end = String(row.endMonth || '').slice(0, 7);
  if (end && end < TODAY().slice(0, 7) && status === '实施中') return 'red';
  if (row.validation && row.validation.ok === false) return 'yellow';
  return 'blue';
}

function resolveUnitIdByName(name) {
  const n = cellText(name);
  if (!n) return null;
  const units = db.prepare('SELECT * FROM units').all();
  const hit = units.find((u) => (u.short && n.includes(u.short)) || (u.name && n.includes(u.name)) || (u.short && u.short.includes(n)) || (u.name && u.name.includes(n)));
  return hit ? hit.id : null;
}

function resolveChannelIdByLedger(row) {
  const type = transitionProjectType(row);
  const ch = cellText(row.sourceChannel);
  const rows = db.prepare('SELECT * FROM channels').all();
  return (rows.find((c) => c.name === type)
    || rows.find((c) => c.source_channel === ch && c.name === type)
    || rows.find((c) => c.source_channel === ch)
    || {}).id || null;
}

function packagesFromTransitionRow(row) {
  const packs = [];
  const items = pairResultItems(row);
  items.forEach((it, i) => {
    const done = Boolean(cellText(it.convertedName) || cellText(it.convertedMonth));
    const model = cellText(it.convertedModel);
    packs.push({
      id: `${row.id}-R${i + 1}`,
      project_id: row.id,
      code: `${row.serial || row.code || row.id}-R${i + 1}`,
      name: it.resultName || it.convertedName || `成果${i + 1}`,
      pname: row.name || '',
      pcode: row.code || row.serial || '',
      mode: model ? '向型号转化' : '向市场转化',
      status: done ? '已完成' : '洽谈中',
      plan_date: it.convertedMonth || row.endMonth || '',
      actual_date: done ? (it.convertedMonth || row.endMonth || '') : null,
      form: model || '',
      brief: model ? `向型号转化：${model}` : '',
      detail: model ? `应用对象：${model}` : '应用对象：待确认',
      unit_id: resolveUnitIdByName(row.responsibleUnit),
    });
  });
  splitResultLines(row.reserveNames).forEach((name, i) => {
    packs.push({
      id: `${row.id}-S${i + 1}`,
      project_id: row.id,
      code: `${row.serial || row.code || row.id}-S${i + 1}`,
      name,
      pname: row.name || '',
      pcode: row.code || row.serial || '',
      mode: '向市场转化',
      status: '未启动',
      plan_date: splitResultLines(row.reserveYear)[i] || '',
      actual_date: null,
      form: '技术储备',
      brief: '技术储备成果',
      detail: '应用对象：技术储备',
      unit_id: resolveUnitIdByName(row.responsibleUnit),
    });
  });
  return packs;
}

const TEAM_DISPLAY_SLOTS = [
  ['contact', '项目联系人'],
  ['owner', '项目负责人'],
  ['tech', '技术负责人'],
  ['pm', '项目主管'],
  ['chief1', '一级总师'],
  ['chief2', '二级总师'],
  ['hqHead', '总部处室处长'],
  ['hqStaff', '总部处室主管'],
  ['unitDeptHead', '单位科技部长'],
  ['unitStaff', '单位科技主管'],
  ['finHq', '总部财务主管'],
  ['finHead', '单位财务部长'],
  ['finStaff', '单位财务主管'],
];

function linkedProjectByLedger(row) {
  const name = String(row?.name || '').trim();
  const code = String(row?.code || row?.serial || '').trim();
  if (name) {
    const byName = db.prepare('SELECT * FROM projects WHERE name=?').get(name);
    if (byName) return byName;
  }
  if (code) {
    const byCode = db.prepare('SELECT * FROM projects WHERE code=? OR wbs=?').get(code, code);
    if (byCode) return byCode;
  }
  return null;
}

function completeDisplayTeam(team, unitId) {
  const t = { ...(team || {}) };
  const used = new Set(Object.values(t).filter(Boolean).map(String));
  const takeUnused = (rows) => {
    const hit = (rows || []).find((x) => x.name && !used.has(x.name)) || (rows || []).find((x) => x.name);
    if (!hit?.name) return '';
    used.add(hit.name);
    return hit.name;
  };
  const uid = unitId || -1;
  const unitTeam = db.prepare("SELECT name FROM users WHERE role IN ('team','contact') AND unit_id=? AND status='在岗' ORDER BY CASE role WHEN 'contact' THEN 0 ELSE 1 END, id").all(uid);
  const chiefs = db.prepare("SELECT name FROM users WHERE role='chief' AND status='在岗' ORDER BY id").all();
  const hqMgmt = db.prepare("SELECT name FROM users WHERE role='mgmt' AND scope='hq' AND status='在岗' ORDER BY id").all();
  const unitMgmt = db.prepare("SELECT name FROM users WHERE role='mgmt' AND scope='unit' AND unit_id=? AND status='在岗' ORDER BY id").all(uid);
  const unitFin = db.prepare("SELECT name FROM users WHERE role='finance' AND unit_id=? AND status='在岗' ORDER BY id").all(uid);
  const hqFin = db.prepare("SELECT name FROM users WHERE role='finance' AND scope='hq' AND status='在岗' ORDER BY id").all();
  if (!t.owner) t.owner = takeUnused(unitTeam);
  if (!t.contact) t.contact = takeUnused(unitTeam) || t.owner;
  if (!t.tech) t.tech = takeUnused(unitTeam) || t.owner;
  if (!t.pm) t.pm = takeUnused(unitTeam) || t.owner;
  if (!t.chief1) t.chief1 = takeUnused(chiefs);
  if (!t.chief2) t.chief2 = takeUnused(chiefs) || t.chief1;
  if (!t.hqHead) t.hqHead = hqMgmt[0]?.name || '';
  if (!t.hqStaff) t.hqStaff = takeUnused(hqMgmt) || t.hqHead;
  if (!t.unitDeptHead) t.unitDeptHead = takeUnused(unitMgmt);
  if (!t.unitStaff) t.unitStaff = takeUnused(unitMgmt) || t.unitDeptHead;
  if (!t.finStaff) t.finStaff = takeUnused(unitFin);
  if (!t.finHead) t.finHead = takeUnused(unitFin) || t.finStaff;
  if (!t.finHq) t.finHq = takeUnused(hqFin) || t.hqHead;
  return t;
}

function teamMembersPayload(team) {
  return TEAM_DISPLAY_SLOTS.map(([key, label]) => {
    const name = team?.[key] || '';
    const u = name ? userByName(name) : null;
    return { key, label, name, empNo: u?.emp_no || '', title: u?.title || '', vacant: !name };
  });
}

function projectFromTransitionRow(row, today) {
  const status = mapLedgerStatus(row);
  const total = cellNumber(row.totalBudget) || 0;
  const grant = cellNumber(row.centralGrant) || 0;
  const self = cellNumber(row.selfFund) || 0;
  const spent = cellNumber(row.spent) || 0;
  const start = monthToDate(row.startMonth || row.approvalMonth);
  const end = monthToDate(row.endMonth);
  const results = cellNumber(row.resultCount) || splitResultLines(row.resultNames).length;
  const converted = cellNumber(row.convertedCount) || splitResultLines(row.convertedNames).length;
  const pkgs = packagesFromTransitionRow(row);
  const unitId = resolveUnitIdByName(row.responsibleUnit);
  const linked = linkedProjectByLedger(row);
  const linkedTeam = linked ? J(linked.team_json, {}) : {};
  const team = completeDisplayTeam({
    ...linkedTeam,
    owner: linkedTeam.owner || row.owner || '',
  }, unitId || linked?.lead_unit_id);
  return {
    id: row.id,
    code: String(row.code || row.serial || row.id),
    name: row.name || '未命名项目',
    level: row.level || '',
    status,
    start,
    end,
    total_budget: total,
    lead_unit_id: resolveUnitIdByName(row.responsibleUnit),
    channel_id: resolveChannelIdByLedger(row),
    goal: row.remarks || transitionTransformSummary(row),
    year_goal: cellText(row.yearGoal || row.year_goal) || '',
    partners: [],
    transform_status: transitionTransformSummary(row),
    team,
    teamMembers: teamMembersPayload(team),
    tags: ['表单台账'],
    ledgerSource: true,
    sourceChannel: row.sourceChannel || '',
    projectType: transitionProjectType(row),
    orgOffice: row.orgOffice || '',
    v19: {
      major1: row.major1 || '',
      major2: row.major2 || '',
      launchMonth: row.approvalMonth || row.startMonth || '',
      endMonth: row.endMonth || '',
      projectMonths: row.duration || monthDiff(row.startMonth, row.endMonth),
      managerUnit: row.demandUnit || '',
      demandUnit: row.demandUnit || '',
      responsibleUnit: row.responsibleUnit || '',
      leadWork: row.leadWork || [row.responsibleUnit, row.demandUnit].filter(Boolean).join(' / '),
      plannedPartners: '',
      centralGrant: grant,
      selfFund: self,
      internalFund: (cellNumber(row.internalGrant) || 0) + (cellNumber(row.internalSelfFund) || 0),
      cumulativeSpent: spent,
      closingActual: cellNumber(row.closedActualBudget),
      executionRate: total ? Math.round((spent / total) * 100) : 0,
      deliverableSummary: results ? `${results} 项成果` : '暂无',
      collaboratorSummary: '—',
      transformCount: pkgs.length,
      transformSummary: transitionTransformSummary(row),
    },
    color: mapLedgerColor(row, status),
    msTotal: 0,
    msDone: 0,
    progress: status === '已验收' ? 100 : (status === '实施中' ? 50 : 0),
    nextMilestone: end && status === '实施中' ? { title: '计划结束', due: end, daysLeft: daysLeft(end, today) } : null,
    spentAll: spent,
    yearBudget: cellNumber(row.budget2026) || 0,
    yearSpent: cellNumber(row.budget2026Actual) || 0,
    delivered: converted,
    delivTotal: results,
    packages: pkgs,
    collaborators: [],
  };
}

function scopeLedgerRows(user, rows) {
  if (!user) return [];
  if (user.role === 'admin' || user.scope === 'hq' || user.role === 'leader') return rows;
  if (user.scope === 'unit') {
    return filterTransitionRowsForUser({ ...user, form_access: 1, form_scope: 'unit' }, rows);
  }
  return filterTransitionRowsForUser({ ...user, form_access: 1, form_scope: 'self' }, rows);
}

function listDisplayProjects(user, today, query = {}) {
  const realRows = scopeProjects(user, db.prepare('SELECT * FROM projects ORDER BY id DESC').all())
    .map((p) => enrichProject(p, today));
  const ledger = getTransitionRows();
  if (!ledger.length) {
    return { list: applyCascadeProjectFilters(realRows, query), source: 'projects' };
  }
  const occupied = new Set();
  for (const p of realRows) {
    occupied.add(String(p.id));
    if (p.code) occupied.add(String(p.code));
  }
  const extra = scopeLedgerRows(user, ledger)
    .map((row) => projectFromTransitionRow(row, today))
    .filter((row) => {
      const keys = [row.id, row.code].map((x) => String(x || '')).filter(Boolean);
      return !keys.some((k) => occupied.has(k));
    });
  const list = applyCascadeProjectFilters([...realRows, ...extra], query);
  const source = realRows.length && extra.length ? 'mixed' : (realRows.length ? 'projects' : 'form-ledger');
  return { list, source };
}

// ---------- 项目台账 ----------
r.get('/projects', (req, res) => {
  const user = currentUser(req);
  const today = TODAY();
  const { list } = listDisplayProjects(user, today, req.query);
  res.json(list);
});

r.get('/projects.xlsx', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (user.role === 'leader') return res.status(403).json({ error: '领导角色为只读查看权限，暂不开放全量导出' });
  const today = TODAY();
  const { list } = listDisplayProjects(user, today);
  const units = Object.fromEntries(db.prepare('SELECT id,short FROM units').all().map((u) => [u.id, u.short]));
  const chs = Object.fromEntries(db.prepare('SELECT id,name FROM channels').all().map((c) => [c.id, c.name]));
  const cmap = { red: '红·逾期', yellow: '黄·临期', blue: '蓝·推进', green: '绿·完成' };
  const rows = list.map((p) => ({
    项目编号: p.code, 项目名称: p.name, 项目级别: p.level, 项目渠道: p.projectType || chs[p.channel_id],
    一级专业: p.v19.major1, 二级专业: p.v19.major2, 管理单位: p.v19.managerUnit, 需求单位: p.v19.demandUnit, 责任单位: p.v19.responsibleUnit,
    立项年月: p.v19.launchMonth, 结束年月: p.v19.endMonth, 项目周期月: p.v19.projectMonths, 项目状态: p.status, 预警: cmap[p.color],
    牵头单位与主要工作: p.v19.leadWork, 参研单位: p.partners.map((x) => x.name).join('、'),
    '总经费(万元)': p.total_budget, '国拨经费(万元)': p.v19.centralGrant, '自筹经费(万元)': p.v19.selfFund, '商飞内部单位经费(万元)': p.v19.internalFund,
    '累计支出(万元)': p.v19.cumulativeSpent, '年度预算(万元)': p.yearBudget, '年度支出(万元)': p.yearSpent, '结题实际执行经费(万元)': p.v19.closingActual || '',
    执行率: `${p.v19.executionRate}%`,
    里程碑进度: `${p.msDone}/${p.msTotal}`, 交付物: `${p.delivered}/${p.delivTotal}`,
    协作单位评价: p.v19.collaboratorSummary, 成果转化情况: p.v19.transformSummary,
    项目负责人: p.team.owner, 技术负责人: p.team.tech, 一级总师: p.team.chief1, 二级总师: p.team.chief2, 项目目标: p.goal,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(10, Math.min(34, k.length + 8)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'V19项目台账总表');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TRANSITION_FIELDS), 'V19字段口径');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="projects-${today}.xlsx"`);
  res.send(buf);
});

r.get('/projects.csv', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (user.role === 'leader') return res.status(403).json({ error: '领导角色为只读查看权限，暂不开放全量导出' });
  const today = TODAY();
  const { list } = listDisplayProjects(user, today);
  const units = Object.fromEntries(db.prepare('SELECT id,short FROM units').all().map((u) => [u.id, u.short]));
  const chs = Object.fromEntries(db.prepare('SELECT id,name FROM channels').all().map((c) => [c.id, c.name]));
  const head = '项目编号,名称,层级,渠道类别,牵头单位,开始时间,结束时间,项目状态,预警,总经费(万元),历年支出(万元),年度预算,年度支出,里程碑进度,项目负责人';
  const cmap = { red: '红', yellow: '黄', blue: '蓝', green: '绿' };
  const lines = list.map((p) => [p.code, p.name, p.level, p.projectType || chs[p.channel_id], p.v19?.responsibleUnit || units[p.lead_unit_id], p.start, p.end, p.status, cmap[p.color], p.total_budget, p.spentAll, p.yearBudget, p.yearSpent, `${p.msDone}/${p.msTotal}`, p.team.owner].join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
  res.send('﻿' + head + '\n' + lines.join('\n'));
});

function findLedgerRowByParam(id) {
  const rows = getTransitionRows();
  const exact = rows.find((x) => String(x.id) === String(id));
  if (exact) return exact;
  if (db.prepare('SELECT id FROM projects WHERE id=?').get(id)) return null;
  return rows.find((x) => String(x.serial) === String(id) || String(x.code) === String(id)) || null;
}

r.get('/projects/:id', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const today = TODAY();
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (p) {
    if (!canAccessProject(user, p)) return res.status(403).json({ error: '无权查看该项目' });
    const proj = enrichProject(p, today);
    const milestones = db.prepare('SELECT * FROM milestones WHERE project_id=? ORDER BY due').all(p.id)
      .map((m) => ({ ...m, color: statusColor(m.due, m.done_at, today), daysLeft: daysLeft(m.due, today) }));
    const plans = db.prepare('SELECT * FROM plans WHERE project_id=? ORDER BY due').all(p.id)
      .map((x) => ({ ...x, color: statusColor(x.due, x.done_at, today) }));
    const funds = db.prepare('SELECT * FROM funds WHERE project_id=? ORDER BY year').all(p.id)
      .map((f) => ({ ...f, writeoffs: J(f.writeoffs_json, []) }));
    const deliverables = db.prepare('SELECT * FROM deliverables WHERE project_id=?').all(p.id)
      .map((x) => ({ ...x, color: statusColor(x.due, x.delivered_at, today) }));
    const packages = db.prepare('SELECT * FROM packages WHERE project_id=?').all(p.id)
      .map((k) => ({ ...k, color: k.status === '已完成' ? 'green' : statusColor(k.plan_date, k.actual_date, today), deliverableCount: db.prepare('SELECT COUNT(*) n FROM deliverables WHERE package_id=?').get(k.id).n }));
    const collaborators = db.prepare('SELECT * FROM collaborators WHERE project_id=?').all(p.id).map((c) => ({ ...c, scores: J(c.scores_json) }));
    const approvals = db.prepare('SELECT * FROM approvals WHERE project_id=? ORDER BY created_at DESC').all(p.id).map((a) => ({ ...a, steps: J(a.steps_json, []), payload: J(a.payload_json, {}) }));
    const changes = db.prepare('SELECT * FROM changes WHERE project_id=? ORDER BY created_at DESC').all(p.id);
    const documents = db.prepare("SELECT * FROM documents WHERE project_id=? AND phase<>'后评价' ORDER BY uploaded_at").all(p.id);
    const postEval = null;
    const channel = db.prepare('SELECT * FROM channels WHERE id=?').get(p.channel_id) || {};
    const unit = db.prepare('SELECT * FROM units WHERE id=?').get(p.lead_unit_id) || {};
    const lifecycle = buildLifecycleStages(p);
    return res.json({
      ...proj,
      channelName: channel.name || '',
      sourceChannel: channel.source_channel || '',
      orgOffice: channel.org_office || channel.org || '',
      projectType: channel.name || '',
      channelFlow: J(channel.flow_json, []), channelFiling: J(channel.filing_json, []), channelAssess: J(channel.assess_json, []), unitName: unit.name || '', unitShort: unit.short || '',
      milestones, plans, funds, deliverables, packages, collaborators, approvals, changes, documents,
      postEval,
      lifecycleStages: lifecycle,
      membersEditable: canEditProjectMembers(user, p),
      ...projectAuthPayload(user, p),
    });
  }
  const ledgerRow = findLedgerRowByParam(req.params.id);
  if (ledgerRow) {
    const proj = projectFromTransitionRow(ledgerRow, today);
    const unit = proj.lead_unit_id ? db.prepare('SELECT * FROM units WHERE id=?').get(proj.lead_unit_id) : null;
    const channel = proj.channel_id ? db.prepare('SELECT * FROM channels WHERE id=?').get(proj.channel_id) : {};
    const synthetic = {
      id: proj.id,
      lead_unit_id: proj.lead_unit_id,
      channel_id: proj.channel_id,
      status: proj.status,
      team_json: JSON.stringify(proj.team || {}),
    };
    return res.json({
      ...proj,
      channelName: proj.projectType,
      sourceChannel: proj.sourceChannel,
      orgOffice: proj.orgOffice,
      projectType: proj.projectType,
      channelFlow: J(channel.flow_json, []),
      channelFiling: J(channel.filing_json, []),
      channelAssess: J(channel.assess_json, []),
      unitName: unit?.name || proj.v19.responsibleUnit || '',
      unitShort: unit?.short || proj.v19.responsibleUnit || '',
      milestones: [], plans: [], funds: [],
      deliverables: [], packages: proj.packages || [],
      collaborators: [], approvals: [], changes: [], documents: [],
      postEval: null,
      lifecycleStages: buildLifecycleStages(synthetic),
      readonly: true,
      ledgerHint: '本条来自表单维护台账，编辑请到「管控闭环 → 表单维护」',
      ...projectAuthPayload(user, proj, { readonly: true }),
    });
  }
  return res.status(404).json({ error: 'not found' });
});

function requireProjectRow(req, res, user) {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) {
    res.status(404).json({ error: 'not found' });
    return null;
  }
  if (!canAccessProject(user, p)) {
    res.status(403).json({ error: '无权查看该项目' });
    return null;
  }
  return p;
}

r.get('/roster', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  res.json({ people: rosterPeople(), duties: PROJECT_DUTY_DEFS });
});

r.get('/inbox', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const items = [];
  const approvals = db.prepare("SELECT * FROM approvals WHERE status='审批中' AND type<>'post_eval' ORDER BY created_at DESC").all();
  for (const raw of approvals) {
    const a = mapApproval(raw);
    const step = a.steps[a.current_step];
    if (!step) continue;
    if (!(user.role === 'admin' || isCurrentStepAssignee(user, step))) continue;
    items.push({
      kind: 'approval',
      id: `appr-${a.id}`,
      approvalId: a.id,
      projectId: a.project_id,
      projectName: a.projectName || '',
      projectCode: a.projectCode || '',
      title: a.title,
      stepTitle: step.title,
      href: '/approvals',
      slot: step.slot || slotForStepTitle(step.title) || '',
    });
  }
  const seen = new Set(items.filter((it) => it.approvalId).map((it) => String(it.approvalId)));
  const related = db.prepare("SELECT * FROM approvals WHERE type<>'post_eval' ORDER BY created_at DESC").all().map(mapApproval);
  for (const a of related) {
    if (seen.has(String(a.id))) continue;
    if (!(participatedApproval(user, a) || a.initiator === user.name)) continue;
    const steps = a.steps || [];
    const done = steps.filter((s) => s.status === 'approved').length;
    items.push({
      kind: 'track',
      id: `track-${a.id}`,
      approvalId: a.id,
      projectId: a.project_id,
      projectName: a.projectName || '',
      projectCode: a.projectCode || '',
      title: a.title,
      stepTitle: a.status === '审批中' ? `已办 · 当前 ${steps[a.current_step]?.title || ''}` : a.status,
      href: '#',
      progress: `${done}/${steps.length}`,
    });
    seen.add(String(a.id));
    if (items.filter((it) => it.kind === 'track').length >= 8) break;
  }
  for (const p of scopeProjects(user, db.prepare('SELECT * FROM projects').all())) {
    if (p.status === '已终止') continue;
    const duties = projectDutiesOf(user, p);
    if (!duties.length) continue;
    const lc = buildLifecycleStages(p);
    const hasApprovalInbox = items.some((it) => (it.kind === 'approval' || it.kind === 'track') && String(it.projectId) === String(p.id));
    if (p.status === '申报中') {
      const core = duties.filter((d) => ['contact', 'owner', 'tech'].includes(d));
      if (!core.length || hasApprovalInbox) continue;
      items.push({
        kind: 'fill',
        id: `assign-${p.id}`,
        projectId: p.id,
        projectName: p.name,
        projectCode: p.code,
        title: `「${p.name}」已指定您为${core.map(dutyLabelOf).join('、')}`,
        stepTitle: '打开项目档案跟踪审签',
        href: `/projects/${p.id}`,
        slot: core[0],
      });
      continue;
    }
    if (lc.currentMacro === 'declare') continue;
    if (lc.approval && lc.approval.current) continue;
    const ownerKey = MACRO_OWNER_SLOT[lc.currentMacro] || 'owner';
    if (!duties.includes(ownerKey)) continue;
    const cur = (lc.macro || []).find((m) => m.id === lc.currentMacro);
    items.push({
      kind: 'fill',
      id: `fill-${p.id}-${lc.currentMacro}`,
      projectId: p.id,
      projectName: p.name,
      projectCode: p.code,
      title: `${cur?.name || lc.currentMacro} 待填报`,
      stepTitle: cur?.filler || dutyLabelOf(ownerKey),
      href: `/projects/${p.id}`,
      slot: ownerKey,
      vacant: !cur?.owner?.name,
    });
  }
  res.json({ items, count: items.length });
});

r.get('/projects/:id/members', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const p = requireProjectRow(req, res, user);
  if (!p) return;
  const team = assignedTeamOf(p.id);
  res.json({
    team,
    members: teamMembersPayload(team),
    duties: PROJECT_DUTY_DEFS,
    people: rosterPeople(),
    editable: canEditProjectMembers(user, p),
  });
});

r.put('/projects/:id/members', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!canEditProjectMembers(user, p)) return res.status(403).json({ error: '无权指定本项目岗位' });
  const slots = req.body?.slots || req.body?.team || {};
  const team = {};
  for (const d of PROJECT_DUTY_DEFS) team[d.key] = slots[d.key] ?? '';
  const next = writeProjectMembers(p.id, team, user.name);
  let reassigned = 0;
  for (const d of PROJECT_DUTY_DEFS) {
    const person = resolvePerson(next[d.key]);
    if (person) reassigned += reassignOpenSteps(p.id, d.key, person);
  }
  audit(user.name, '指定项目岗位', p.name, PROJECT_DUTY_DEFS.map((d) => `${d.label}=${next[d.key] || '待指定'}`).join('；'));
  res.json({ ok: true, team: next, members: teamMembersPayload(next), reassigned });
});

r.post('/projects/:id/members/transfer', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!canEditProjectMembers(user, p)) return res.status(403).json({ error: '无权转办本项目岗位' });
  const slot = String(req.body?.slot || '');
  if (!PROJECT_DUTY_DEFS.some((d) => d.key === slot)) return res.status(400).json({ error: '无效岗位' });
  const person = resolvePerson(req.body?.empNo || req.body?.emp_no || req.body?.name);
  if (!person) return res.status(400).json({ error: '未找到在岗人员' });
  const team = assignedTeamOf(p.id);
  team[slot] = person.emp_no || person.name;
  writeProjectMembers(p.id, team, user.name);
  const n = reassignOpenSteps(p.id, slot, person);
  audit(user.name, '岗位转办', p.name, `${dutyLabelOf(slot)} → ${person.name}（${person.emp_no || person.id}），已改派在途节点 ${n} 个`);
  res.json({
    ok: true,
    slot,
    person: { name: person.name, empNo: person.emp_no || person.id },
    reassigned: n,
    members: teamMembersPayload(assignedTeamOf(p.id)),
  });
});

/** 项目生命周期阶段（部门 + 负责人 + 详情） */
r.get('/projects/:id/lifecycle-stages', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const today = TODAY();
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (p) {
    if (!canAccessProject(user, p)) return res.status(403).json({ error: '无权查看该项目' });
    return res.json(buildLifecycleStages(p));
  }
  const ledgerRow = findLedgerRowByParam(req.params.id);
  if (!ledgerRow) return res.status(404).json({ error: 'not found' });
  const proj = projectFromTransitionRow(ledgerRow, today);
  res.json(buildLifecycleStages({
    id: proj.id,
    lead_unit_id: proj.lead_unit_id,
    channel_id: proj.channel_id,
    status: proj.status,
    level: proj.level,
    team_json: JSON.stringify(proj.team || {}),
  }));
});

// ---------- 驾驶舱 ----------
r.get('/dashboard', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (String(req.query.screen || '') === 'pre-research' && !canAccessPreResearch(user)) {
    return res.status(403).json({ error: '当前角色无权访问科研预研信息管理大屏（仅领导 / 总部管理）' });
  }
  try {
  const today = TODAY();
  const thisYear = Number(today.slice(0, 4));
  const {
    unit, level, year, channel, sourceChannel, orgOffice, projectType, major1, major2,
  } = req.query;
  const displayed = listDisplayProjects(user, today, {
    unit, level, channel, sourceChannel, orgOffice, projectType, major1, major2,
  });
  let projects = displayed.list;
  if (year) {
    const y = Number(year);
    projects = projects.filter((p) => {
      const s = p.start ? Number(String(p.start).slice(0, 4)) : null;
      const e = p.end ? Number(String(p.end).slice(0, 4)) : null;
      if (s == null || e == null || Number.isNaN(s) || Number.isNaN(e)) return false;
      return s <= y && e >= y;
    });
  }
  const liveProjects = projects.filter((p) => !p.ledgerSource);
  const ledgerMode = liveProjects.length === 0;

  const ids = new Set(liveProjects.map((p) => p.id));
  let blacklistScoped = 0;
  let pendingScoped = 0;
  if (!ledgerMode) {
    blacklistScoped = db.prepare('SELECT c.project_id FROM collaborators c WHERE c.blacklisted=1').all()
      .filter((c) => ids.has(c.project_id)).length;
    pendingScoped = db.prepare("SELECT project_id, unit_id FROM approvals WHERE status='审批中'").all()
      .filter((a) => (a.project_id && ids.has(a.project_id)) || (user.scope === 'hq' || user.role === 'admin') || a.unit_id === user.unit_id).length;
    if (user.scope === 'hq' || user.role === 'admin') {
      blacklistScoped = db.prepare('SELECT COUNT(*) n FROM collaborators WHERE blacklisted=1').get().n;
      pendingScoped = db.prepare("SELECT COUNT(*) n FROM approvals WHERE status='审批中'").get().n;
    }
  }
  const units = db.prepare("SELECT * FROM units WHERE kind='unit'").all();
  const channels = db.prepare('SELECT * FROM channels').all();

  const active = projects.filter((p) => ['实施中', '验收中', '进行中'].includes(p.status));
  const yearBudget = projects.reduce((s, p) => s + (Number(p.yearBudget) || 0), 0);
  const yearSpent = projects.reduce((s, p) => s + (Number(p.yearSpent) || 0), 0);

  let msAll = [];
  let delAll = [];
  let pkgs = [];
  let plans = [];
  if (ledgerMode) {
    pkgs = projects.flatMap((p) => p.packages || []);
  } else {
    msAll = db.prepare('SELECT * FROM milestones').all().filter((m) => ids.has(m.project_id));
    delAll = db.prepare('SELECT * FROM deliverables').all().filter((d) => ids.has(d.project_id));
    pkgs = db.prepare('SELECT * FROM packages').all().filter((k) => ids.has(k.project_id));
    plans = db.prepare('SELECT * FROM plans').all().filter((p) => ids.has(p.project_id));
  }
  const msColors = { red: 0, yellow: 0, blue: 0, green: 0 };
  msAll.forEach((m) => msColors[statusColor(m.due, m.done_at, today)]++);
  projects.forEach((p) => { if (ledgerMode) msColors[p.color] = (msColors[p.color] || 0) + 1; });
  const totalBudgetRaw = projects.reduce((s, p) => s + (Number(p.total_budget) || 0), 0);
  const activeBudgetRaw = active.reduce((s, p) => s + (Number(p.total_budget) || 0), 0);
  const totalGrant = projects.reduce((s, p) => s + Number(p.v19?.centralGrant || 0), 0);
  const totalSelf = projects.reduce((s, p) => s + Number(p.v19?.selfFund || 0), 0);
  const totalInternal = projects.reduce((s, p) => s + Number(p.v19?.internalFund || 0), 0);
  const activeGrant = active.reduce((s, p) => s + Number(p.v19?.centralGrant || 0), 0);
  const activeSelf = active.reduce((s, p) => s + Number(p.v19?.selfFund || 0), 0);
  const spentAll = projects.reduce((s, p) => s + Number(p.v19?.cumulativeSpent || 0), 0);

  const kpis = {
    total: projects.length,
    active: active.length,
    totalBudget: Math.round(totalBudgetRaw / 100) / 100, // 亿元
    yearBudget: Math.round(yearBudget), yearSpent: Math.round(yearSpent),
    execRate: yearBudget ? Math.round((yearSpent / yearBudget) * 100) : 0,
    totalExecRate: totalBudgetRaw ? Math.round((spentAll / totalBudgetRaw) * 100) : 0,
    red: projects.filter((p) => p.color === 'red').length,
    yellow: projects.filter((p) => p.color === 'yellow').length,
    deliverables: ledgerMode ? projects.reduce((s, p) => s + (Number(p.delivered) || 0), 0) : delAll.filter((d) => d.delivered_at).length,
    packagesDone: pkgs.filter((k) => k.status === '已完成').length,
    blacklist: blacklistScoped,
    pendingApprovals: pendingScoped,
  };

  const byLevel = ['国家级', '地方级', '公司级'].map((lv) => ({
    level: lv,
    count: projects.filter((p) => p.level === lv).length,
    budget: Math.round(projects.filter((p) => p.level === lv).reduce((s, p) => s + p.total_budget, 0)),
  }));

  const byUnit = ledgerMode
    ? [...new Set(projects.map((p) => p.v19?.responsibleUnit || '未填单位').filter(Boolean))].map((name) => {
      const ps = projects.filter((p) => (p.v19?.responsibleUnit || '未填单位') === name);
      const short = name.length > 8 ? `${name.slice(0, 8)}…` : name;
      return {
        unit: short, count: ps.length,
        budget: Math.round(ps.reduce((s, p) => s + p.total_budget, 0)),
        red: ps.filter((p) => p.color === 'red').length,
        yellow: ps.filter((p) => p.color === 'yellow').length,
        blue: ps.filter((p) => p.color === 'blue').length,
        green: ps.filter((p) => p.color === 'green').length,
      };
    })
    : units.map((u) => {
      const ps = projects.filter((p) => p.lead_unit_id === u.id);
      return {
        unit: u.short, count: ps.length,
        budget: Math.round(ps.reduce((s, p) => s + p.total_budget, 0)),
        red: ps.filter((p) => p.color === 'red').length,
        yellow: ps.filter((p) => p.color === 'yellow').length,
        blue: ps.filter((p) => p.color === 'blue').length,
        green: ps.filter((p) => p.color === 'green').length,
      };
    });

  const unitLevelMatrix = (ledgerMode
    ? [...new Set(projects.map((p) => p.v19?.responsibleUnit || '未填单位'))].map((name) => {
      const ps = projects.filter((p) => (p.v19?.responsibleUnit || '未填单位') === name);
      const short = name.length > 8 ? `${name.slice(0, 8)}…` : name;
      return {
        unit: short,
        国家级: ps.filter((p) => p.level === '国家级').length,
        地方级: ps.filter((p) => p.level === '地方级').length,
        公司级: ps.filter((p) => p.level === '公司级').length,
        active: ps.filter((p) => ['实施中', '验收中'].includes(p.status)).length,
        accepted: ps.filter((p) => p.status === '已验收').length,
      };
    })
    : units.map((u) => {
      const ps = projects.filter((p) => p.lead_unit_id === u.id);
      return {
        unit: u.short,
        国家级: ps.filter((p) => p.level === '国家级').length,
        地方级: ps.filter((p) => p.level === '地方级').length,
        公司级: ps.filter((p) => p.level === '公司级').length,
        active: ps.filter((p) => ['实施中', '验收中'].includes(p.status)).length,
        accepted: ps.filter((p) => p.status === '已验收').length,
      };
    })
  ).filter((x) => LEVELS.some((lv) => x[lv] > 0));

  const byChannel = ledgerMode
    ? Object.values(projects.reduce((acc, p) => {
      const source = p.sourceChannel || '其他';
      const type = p.projectType || '未分类';
      const key = `${source}/${type}`;
      const row = acc[key] || { channel: key, key, level: p.level || '', source_channel: source, count: 0 };
      row.count += 1;
      acc[key] = row;
      return acc;
    }, {})).sort((a, b) => b.count - a.count)
    : channels.map((c) => ({
      channel: c.source_channel ? `${c.source_channel}/${c.name}` : c.name,
      key: c.key,
      level: c.level,
      source_channel: c.source_channel || '',
      count: projects.filter((p) => p.channel_id === c.id).length,
    })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

  const years = [thisYear - 4, thisYear - 3, thisYear - 2, thisYear - 1, thisYear];
  const fundsTrend = years.map((y) => {
    if (ledgerMode) {
      if (y === thisYear || y === 2026) {
        return { year: y, budget: Math.round(yearBudget), spent: Math.round(yearSpent) };
      }
      return { year: y, budget: 0, spent: 0 };
    }
    const rowsY = db.prepare('SELECT * FROM funds WHERE year=?').all(y).filter((f) => ids.has(f.project_id));
    return { year: y, budget: Math.round(rowsY.reduce((s, f) => s + f.budget, 0)), spent: Math.round(rowsY.reduce((s, f) => s + f.spent, 0)) };
  });

  const statusDist = STATUS_FLOW.map((s) => ({
    status: s,
    count: projects.filter((p) => dashboardStatusOf(p) === s).length,
  }));
  const byMajor1 = buildMajorDist(projects);
  const byMajor2 = Object.values(projects.reduce((acc, p) => {
    const m1 = dashboardMajor1Of(p);
    const m2 = dashboardMajor2Of(p) || '未填二级专业';
    const key = `${m1}/${m2}`;
    const row = acc[key] || { major1: m1, major2: m2, count: 0 };
    row.count += 1;
    acc[key] = row;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);

  const delTypes = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果'];
  let delivByType = delTypes.map((t) => ({
    type: t,
    delivered: delAll.filter((d) => d.type === t && d.delivered_at).length,
    pending: delAll.filter((d) => d.type === t && !d.delivered_at).length,
  }));
  if (ledgerMode && delivByType.every((x) => !x.delivered && !x.pending)) {
    delivByType = [
      { type: '向型号转化', delivered: pkgs.filter((k) => k.mode === '向型号转化' && k.status === '已完成').length, pending: pkgs.filter((k) => k.mode === '向型号转化' && k.status !== '已完成').length },
      { type: '向市场转化', delivered: pkgs.filter((k) => k.mode === '向市场转化' && k.status === '已完成').length, pending: pkgs.filter((k) => k.mode === '向市场转化' && k.status !== '已完成').length },
    ].filter((x) => x.delivered + x.pending > 0);
  }

  const transform = ['未启动', '洽谈中', '已签协议', '已完成'].map((s) => ({ stage: s, count: pkgs.filter((k) => k.status === s).length }));
  const transformSummary = {
    total: pkgs.length,
    done: pkgs.filter((k) => k.status === '已完成').length,
    running: pkgs.filter((k) => ['洽谈中', '已签协议'].includes(k.status)).length,
    notStarted: pkgs.filter((k) => k.status === '未启动').length,
    overdue: pkgs.filter((k) => packageColor(k, today) === 'red').length,
  };

  const modelMap = new Map();
  for (const k of pkgs.filter((x) => x.mode === '向型号转化')) {
    const key = transformationTarget(k);
    const row = modelMap.get(key) || { model: key, count: 0, done: 0, running: 0, overdue: 0 };
    row.count += 1;
    if (k.status === '已完成') row.done += 1;
    else row.running += 1;
    if (packageColor(k, today) === 'red') row.overdue += 1;
    modelMap.set(key, row);
  }

  const planColors = { red: 0, yellow: 0, blue: 0, green: 0 };
  for (const pRow of plans) planColors[statusColor(pRow.due, pRow.done_at, today)]++;
  const cmosSync = db.prepare('SELECT value FROM kv WHERE key=?').get('sync.cmos')?.value || null;
  const planStats = {
    total: plans.length,
    todo: plans.filter((p) => p.status !== '已完成').length,
    done: plans.filter((p) => p.status === '已完成').length,
    finishRate: plans.length ? Math.round((plans.filter((p) => p.status === '已完成').length / plans.length) * 100) : 0,
    colors: planColors,
    cmosSync,
  };

  const fundStructure = {
    total: Math.round(totalBudgetRaw),
    centralGrant: Math.round(totalGrant),
    selfFund: Math.round(totalSelf),
    internalFund: Math.round(totalInternal),
    activeTotal: Math.round(activeBudgetRaw),
    activeCentralGrant: Math.round(activeGrant),
    activeSelfFund: Math.round(activeSelf),
    totalExecRate: totalBudgetRaw ? Math.round((spentAll / totalBudgetRaw) * 100) : 0,
  };

  const risks = [];
  for (const m of msAll) {
    const c = statusColor(m.due, m.done_at, today);
    if (c === 'red' || c === 'yellow') {
      const p = projects.find((x) => x.id === m.project_id);
      risks.push({ kind: '里程碑', color: c, project: p?.name, projectId: m.project_id, title: m.title, due: m.due, days: daysLeft(m.due, today), unit: units.find((u) => u.id === p?.lead_unit_id)?.short });
    }
  }
  for (const dRow of delAll) {
    const c = statusColor(dRow.due, dRow.delivered_at, today);
    if (c === 'red') {
      const p = projects.find((x) => x.id === dRow.project_id);
      risks.push({ kind: '交付物', color: c, project: p?.name, projectId: dRow.project_id, title: dRow.name, due: dRow.due, days: daysLeft(dRow.due, today), unit: units.find((u) => u.id === p?.lead_unit_id)?.short });
    }
  }
  if (ledgerMode) {
    for (const p of projects) {
      if (p.color === 'red' || p.color === 'yellow') {
        risks.push({
          kind: '台账预警', color: p.color, project: p.name, projectId: p.id,
          title: p.color === 'red' ? '逾期' : '临期', due: p.end,
          days: daysLeft(p.end, today), unit: p.v19?.responsibleUnit || '',
        });
      }
    }
  }
  risks.sort((a, b) => (a.color === b.color ? a.days - b.days : a.color === 'red' ? -1 : 1));

  const colorDist = ['red', 'yellow', 'blue', 'green'].map((c) => ({ color: c, count: projects.filter((p) => p.color === c).length }));

  res.json({
    today, kpis, byLevel, byUnit, unitLevelMatrix, byChannel, fundsTrend, statusDist, byMajor1, byMajor2,
    delivByType, transform, transformSummary, modelTransform: Array.from(modelMap.values()).sort((a, b) => b.count - a.count),
    planStats, fundStructure, risks: risks.slice(0, 12), colorDist, msColors,
  });
  } catch (err) {
    console.error('dashboard failed', err);
    res.status(500).json({ error: '驾驶舱数据计算失败', detail: String(err?.message || err) });
  }
});

// ---------- 预警 ----------
function queueAlertNotifications(alert) {
  if (!alert?.id || Number(alert.id) < 1) return;
  const p = alert.project_id ? db.prepare('SELECT team_json FROM projects WHERE id=?').get(alert.project_id) : null;
  const team = J(p?.team_json, {}); const recipients = [...new Set([team.contact, team.owner, team.tech, team.pm, team.unitDeptHead, team.unitStaff].filter(Boolean))];
  const insert = db.prepare('INSERT INTO notification_outbox (alert_id,channel,recipient,subject,status,attempts,last_error,created_at) VALUES (?,?,?,?,?,0,?,?)');
  for (const recipient of recipients) for (const channel of ['站内','邮箱','蓝信']) {
    const exists = db.prepare('SELECT id FROM notification_outbox WHERE alert_id=? AND channel=? AND recipient=?').get(alert.id, channel, recipient);
    if (!exists) insert.run(alert.id, channel, recipient, alert.title, channel === '站内' ? '已送达' : '待配置', channel === '站内' ? null : `${channel}接口参数尚未配置`, TODAY());
  }
}

r.get('/alerts', (req, res) => {
  const user = currentUser(req);
  const today = TODAY();
  let rows = db.prepare("SELECT a.*, p.name pname, p.code pcode, p.lead_unit_id FROM alerts a LEFT JOIN projects p ON p.id=a.project_id WHERE a.kind<>'后评价' ORDER BY a.level, a.due").all();
  // 协作单位评价 30 日倒计时（动态计算，验收办结触发）
  const pendEval = db.prepare('SELECT c.name cname, c.ctype, p.id pid, p.name pname, p.code pcode, p.lead_unit_id, p.accepted_at FROM collaborators c JOIN projects p ON p.id=c.project_id WHERE c.total IS NULL AND p.accepted_at IS NOT NULL').all();
  let vid = -1;
  for (const e of pendEval) {
    const deadline = addDays(e.accepted_at, 30);
    const left = daysLeft(deadline, today);
    if (left <= 30) {
      rows.push({
        id: vid--, project_id: e.pid, kind: '协作评价', level: left < 0 ? 'red' : 'yellow',
        title: `【${left < 0 ? '逾期告警' : '临期预警'}】${e.pname}：${e.ctype}单位「${e.cname}」须于验收后30日内完成五维评价${left >= 0 ? `（剩余 ${left} 天）` : `（已超期 ${-left} 天）`}`,
        due: deadline, created_at: e.accepted_at, channels: '站内,邮箱,蓝信', recipients: '项目团队、对应管理团队', read: 0,
        pname: e.pname, pcode: e.pcode, lead_unit_id: e.lead_unit_id,
      });
    }
  }
  rows.sort((a, b) => (a.level === b.level ? String(a.due).localeCompare(String(b.due)) : a.level === 'red' ? -1 : 1));
  rows.forEach(queueAlertNotifications);
  if (user.scope !== 'hq' && user.role !== 'admin') {
    const visible = new Set(scopeProjects(user, db.prepare('SELECT * FROM projects').all()).map((p) => p.id));
    rows = rows.filter((a) => a.project_id && visible.has(a.project_id));
  }
  res.json(rows);
});

r.get('/notifications/outbox', (req, res) => {
  const user=currentUser(req); if(!['admin','mgmt'].includes(user.role)) return res.status(403).json({error:'仅管理人员可查看通知发送状态'});
  res.json(db.prepare('SELECT * FROM notification_outbox ORDER BY id DESC LIMIT 500').all());
});

/** 正式上线前历史数据完整性扫描，不伪造业务数据，只登记待治理项。 */
function scanDataQuality() {
  const projects=db.prepare('SELECT * FROM projects').all(); const upsert=db.prepare("INSERT INTO data_quality_issues (project_id,issue_code,detail,status,detected_at) VALUES (?,?,?,'待治理',?) ON CONFLICT(project_id,issue_code) DO UPDATE SET detail=excluded.detail,detected_at=excluded.detected_at");
  for(const p of projects){const issues=[];if(!String(p.goal||'').trim())issues.push(['MISSING_GOAL','项目目标为空']);if(!db.prepare('SELECT 1 FROM milestones WHERE project_id=? LIMIT 1').get(p.id))issues.push(['NO_MILESTONE','未建立里程碑']);if(!db.prepare('SELECT 1 FROM deliverables WHERE project_id=? LIMIT 1').get(p.id))issues.push(['NO_DELIVERABLE','未建立交付物']);const team=J(p.team_json,{});for(const [key,label] of [['contact','项目联系人'],['owner','项目负责人'],['tech','技术负责人'],['pm','项目主管']])if(!team[key]||!userByName(team[key]))issues.push([`TEAM_${key.toUpperCase()}`,`${label}未绑定有效工号`]);for(const [code,detail] of issues)upsert.run(p.id,code,detail,TODAY());}
  return db.prepare("SELECT q.*,p.code,p.name FROM data_quality_issues q JOIN projects p ON p.id=q.project_id WHERE q.status='待治理' ORDER BY p.code,q.issue_code").all();
}

r.get('/data-quality', (req,res)=>{const user=currentUser(req);if(!['admin','mgmt'].includes(user.role))return res.status(403).json({error:'仅管理人员可查看历史数据治理清单'});res.json(scanDataQuality());});

r.post('/data-quality/:id/resolve',(req,res)=>{const user=currentUser(req);if(user.role!=='admin')return res.status(403).json({error:'仅系统管理员可确认治理完成'});const q=db.prepare('SELECT * FROM data_quality_issues WHERE id=?').get(req.params.id);if(!q)return res.status(404).json({error:'not found'});db.prepare("UPDATE data_quality_issues SET status='已治理',resolved_at=? WHERE id=?").run(TODAY(),q.id);audit(user.name,'数据治理完成',String(q.project_id),q.detail);res.json({ok:true});});

r.post('/notifications/:id/retry', (req,res) => {
  const user=currentUser(req); if(user.role!=='admin') return res.status(403).json({error:'仅系统管理员可重试外部通知'}); const n=db.prepare('SELECT * FROM notification_outbox WHERE id=?').get(req.params.id); if(!n)return res.status(404).json({error:'not found'});
  const configured=n.channel==='邮箱'?Boolean(process.env.SMTP_URL):n.channel==='蓝信'?Boolean(process.env.LANXIN_API_URL):true;
  if(!configured){db.prepare("UPDATE notification_outbox SET attempts=attempts+1,status='待配置',last_error=? WHERE id=?").run(`${n.channel}接口参数尚未配置`,n.id);return res.status(503).json({error:`${n.channel}接口尚未配置，已保留待发送记录`});}
  if(n.channel==='站内'){db.prepare("UPDATE notification_outbox SET status='已送达',attempts=attempts+1,sent_at=?,last_error=NULL WHERE id=?").run(TODAY(),n.id);return res.json({ok:true});}
  db.prepare("UPDATE notification_outbox SET attempts=attempts+1,status='待发送',last_error=? WHERE id=?").run('已配置接口地址，仍需按内网接口规范完成适配',n.id);res.status(501).json({error:'接口地址已配置，发送适配器待联调'});
});

// ---------- 审批 ----------
function mapApproval(a) {
  const p = a.project_id ? db.prepare('SELECT name, code FROM projects WHERE id=?').get(a.project_id) : null;
  const acceptanceGate = a.type === 'acceptance' && a.project_id ? acceptPrecheck(a.project_id) : null;
  return { ...a, steps: J(a.steps_json, []), payload: J(a.payload_json, {}), projectName: p?.name, projectCode: p?.code, acceptanceGate };
}


/** V19：阶段节点部门 + 负责人映射 */
function deptForStepTitle(title, unitName) {
  const u = unitName || '责任单位';
  if (/总部.*财务|总部财务/.test(title)) return '总部财务';
  if (/单位财务|财务部门|财务部/.test(title)) return `${u}·财务部`;
  if (/一级总师/.test(title)) return '公司·一级责任总师';
  if (/二级|三级.*总师|责任总师|学术委员会|专委会/.test(title)) return `${u}·责任总师`;
  if (/总部|科研项目处|科技发展处|科技管理部|上报GXB|归档/.test(title)) return '总部·科研项目处';
  if (/分管领导|分管科技/.test(title)) return `${u}·分管领导`;
  if (/单位科技|单位管理|承担部门|科技管理部|科技部/.test(title)) return `${u}·科技管理部`;
  if (/联盟|理事会/.test(title)) return '联盟/理事会秘书处';
  if (/联系人|团队|项目组|上传|发起|填写|编制/.test(title)) return `${u}·项目团队`;
  if (/项目负责人/.test(title)) return `${u}·项目团队`;
  return u;
}

function buildLifecycleStages(p) {
  const unit = db.prepare('SELECT name,short FROM units WHERE id=?').get(p.lead_unit_id) || {};
  const unitName = unit.name || unit.short || '责任单位';
  const realRow = p?.id != null ? db.prepare('SELECT 1 FROM projects WHERE id=?').get(p.id) : null;
  const team = realRow ? assignedTeamOf(p.id) : completeDisplayTeam(J(p.team_json, {}), p.lead_unit_id);
  const channel = db.prepare('SELECT * FROM channels WHERE id=?').get(p.channel_id) || {};
  const flow = J(channel.flow_json, []);
  const approvals = db.prepare('SELECT * FROM approvals WHERE project_id=? ORDER BY created_at DESC').all(p.id)
    .map((a) => ({ ...a, steps: J(a.steps_json, []), payload: J(a.payload_json, {}) }));
  const active = approvals.find((a) => a.status === '审批中') || null;
  const latest = approvals[0] || null;

  const person = (name) => {
    const u = userByName(name);
    return {
      name: name || '',
      empNo: u?.emp_no || '',
      title: u?.title || '',
      label: name ? (u?.emp_no ? `${name}（${u.emp_no}）` : name) : '待指定',
    };
  };

  const macroDefs = [
    { id: 'declare', name: '立项·申报', filler: '项目联系人', ownerKey: 'contact', match: ['草稿', '申报中'] },
    { id: 'filing', name: '立项·备案', filler: '项目联系人', ownerKey: 'contact', match: ['待立项确认', '立项中'] },
    { id: 'baseinfo', name: '实施·基本信息', filler: '项目团队', ownerKey: 'pm', match: [] },
    { id: 'milestone', name: '实施·里程碑', filler: '项目团队', ownerKey: 'tech', match: [] },
    { id: 'plan', name: '实施·计划', filler: '项目团队', ownerKey: 'pm', match: [] },
    { id: 'finance', name: '实施·经费', filler: '财务团队', ownerKey: 'finStaff', match: [] },
    { id: 'assess', name: '实施·评估检查', filler: '项目团队', ownerKey: 'owner', match: [] },
    { id: 'change', name: '实施·变更', filler: '项目团队', ownerKey: 'owner', match: [] },
    { id: 'accept', name: '验收', filler: '项目团队', ownerKey: 'owner', match: ['验收中', '已验收'] },
    { id: 'transform', name: '成果转化', filler: '项目团队', ownerKey: 'owner', match: [] },
  ];

  const status = p.status || '';
  let currentMacro = 'declare';
  if (['待立项确认', '立项中'].includes(status)) currentMacro = 'filing';
  else if (status === '实施中') currentMacro = 'milestone';
  else if (status === '验收中') currentMacro = 'accept';
  else if (status === '已验收') currentMacro = 'transform';
  else if (status === '申报中') currentMacro = 'declare';

  // 若有在途基本信息/验收等审批，高亮对应宏阶段
  if (active) {
    if (active.type === 'baseinfo') currentMacro = 'baseinfo';
    else if (active.type === 'filing' || active.type === 'declaration') currentMacro = active.type === 'filing' ? 'filing' : 'declare';
    else if (active.type === 'acceptance') currentMacro = 'accept';
    else if (active.type === 'assessment') currentMacro = 'assess';
    else if (active.type === 'change' || active.type === 'data_change') currentMacro = 'change';
    else if (active.type === 'milestone_close' || active.type === 'milestone_plan') currentMacro = 'milestone';
    else if (active.type === 'plan_finish') currentMacro = 'plan';
    else if (active.type === 'funding' || active.type === 'budget') currentMacro = 'finance';
    else if (active.type === 'package') currentMacro = 'transform';
  }

  const macro = macroDefs.map((d) => {
    const ownerName = team[d.ownerKey] || team.owner || '';
    const pe = person(ownerName);
    let st = 'pending';
    const ord = macroDefs.findIndex((x) => x.id === d.id);
    const cur = macroDefs.findIndex((x) => x.id === currentMacro);
    if (d.id === currentMacro) st = 'current';
    else if (ord < cur) st = 'done';
    return {
      id: d.id,
      name: d.name,
      filler: d.filler,
      dept: d.filler === '财务团队' ? `${unitName}·财务部` : `${unitName}·项目团队`,
      owner: pe,
      status: st,
      detail: {
        summary: `${d.name}：由${d.filler}负责填报/推进`,
        projectStatus: status,
        channel: channel.name || '',
        channelFlow: flow,
      },
    };
  });

  const enrichSteps = (steps, initiator) => (steps || []).map((s, i) => {
    const assigned = s.assignee || stepAssignee(p, s.title, initiator || '').assignee;
    const pe = person(assigned);
    const slot = s.slot || slotForStepTitle(s.title) || '';
    return {
      index: i,
      title: s.title,
      slot,
      dept: deptForStepTitle(s.title, unitName),
      owner: pe,
      status: s.status || 'pending',
      at: s.at || null,
      comment: s.comment || null,
      actor: s.actor || null,
    };
  });

  const nodes = active
    ? enrichSteps(active.steps, active.initiator)
    : (latest ? enrichSteps(latest.steps, latest.initiator) : []);

  const designedFlow = (titles, initiator) => {
    const init = initiator || team.contact || team.owner || '';
    return (titles || []).map((title, i) => {
      const asg = i === 0
        ? { assignee: init, slot: slotForStepTitle(title) || 'contact' }
        : stepAssignee(p, title, init);
      return {
        index: i,
        title,
        slot: asg.slot || slotForStepTitle(title) || '',
        dept: deptForStepTitle(title, unitName),
        owner: person(asg.assignee || ''),
        status: 'pending',
        at: null,
        comment: null,
        actor: null,
      };
    });
  };
  const pickLive = (types) => {
    const rows = approvals.filter((a) => types.includes(a.type));
    return rows.find((a) => a.status === '审批中') || rows[0] || null;
  };
  const acceptTitles = (() => {
    const t = ['项目团队提交验收申请', '二级单位管理团队初审'];
    if (String(p.level || channel.level || '') === '国家级') t.push('责任总师技术复核');
    t.push('总部管理团队终审');
    return t;
  })();
  let visIdx = 0;
  if (['待立项确认', '立项中'].includes(status) || currentMacro === 'filing') visIdx = 1;
  else if (currentMacro === 'accept' || status === '验收中') visIdx = 3;
  else if (currentMacro === 'transform' || status === '已验收') visIdx = 4;
  else if (status === '实施中' || ['baseinfo', 'milestone', 'plan', 'finance', 'assess', 'change'].includes(currentMacro)) visIdx = 2;
  else visIdx = 0;

  const visual = [
    { id: 'declare', name: '项目申报', ownerKey: 'contact', titles: effectiveDeclarationChain(channel), types: ['declaration'] },
    { id: 'filing', name: '立项备案', ownerKey: 'contact', titles: ['项目团队上传立项材料', '单位科技管理部审核', '总部科研项目处备案'], types: ['filing'] },
    { id: 'implement', name: '实施阶段', ownerKey: 'owner', titles: ['项目团队填写', '项目负责人审核', '项目主管', '技术负责人', '单位财务主管'], types: ['baseinfo', 'milestone_plan', 'milestone_close', 'plan_finish', 'funding', 'budget', 'assessment', 'change', 'data_change'] },
    { id: 'accept', name: '项目验收', ownerKey: 'owner', titles: acceptTitles, types: ['acceptance'] },
    { id: 'transform', name: '成果转化', ownerKey: 'owner', titles: ['项目团队填报转化信息', '二级单位管理团队审核', '总部管理团队备案'], types: ['package'] },
  ].map((d, i) => {
    const live = pickLive(d.types);
    const flow = live ? enrichSteps(live.steps, live.initiator) : designedFlow(d.titles, team.contact || team.owner);
    const ownerName = team[d.ownerKey] || team.contact || team.owner || '';
    let st = 'pending';
    if (i < visIdx) st = 'done';
    if (i === visIdx) st = 'current';
    const curNode = flow.find((n) => n.status === 'current') || null;
    const pendingNode = flow.find((n) => n.status === 'pending' || n.status === 'current') || null;
    let flowNode = null;
    if (st === 'current') flowNode = curNode || pendingNode || flow[1] || flow[0] || null;
    else if (st === 'pending') flowNode = flow[1] || flow[0] || null;
    return {
      id: d.id,
      name: d.name,
      ownerSlot: d.ownerKey,
      ownerSlotLabel: dutyLabelOf(d.ownerKey),
      owner: person(ownerName),
      status: st,
      flow,
      liveApproval: live ? { id: live.id, title: live.title, status: live.status, type: live.type } : null,
      flowTo: flowNode ? { title: flowNode.title, owner: flowNode.owner, slotLabel: flowNode.slot ? dutyLabelOf(flowNode.slot) : '' } : { title: '已办结', owner: null, slotLabel: '' },
    };
  });

  return {
    projectId: p.id,
    code: p.code,
    name: p.name,
    status,
    unitName,
    currentMacro,
    macro,
    visual,
    approval: active || latest ? {
      id: (active || latest).id,
      type: (active || latest).type,
      title: (active || latest).title,
      status: (active || latest).status,
      initiator: (active || latest).initiator,
      createdAt: (active || latest).created_at,
      current: active ? true : false,
      nodes,
    } : null,
    fillHints: [
      { stage: '立项·申报', filler: '项目团队', fields: '级别/渠道、名称、目标、周期、经费、负责人·技术负责人、申报材料' },
      { stage: '实施·基本信息', filler: '项目团队', fields: '主管/总师/管理财务等岗位；缺失台账字段；审过回写' },
      { stage: '系统生成', filler: '系统', fields: '项目编号、预警色、成果转化状态' },
    ],
  };
}


function userByName(name) {
  return name ? db.prepare('SELECT id,emp_no,name,role,scope,unit_id,title,status FROM users WHERE name=? AND status=?').get(name, '在岗') : null;
}

function stepAssignee(project, title, initiator) {
  const pid = project?.id || project?.project_id;
  const team = pid ? assignedTeamOf(pid) : J(project?.team_json, {});
  const slot = slotForStepTitle(title);
  let name = slot ? (team[slot] || '') : '';
  if (!name && slot === 'contact') name = initiator || '';
  if (!name && /联系人|团队填|团队提交|项目组/.test(String(title || ''))) name = team.contact || initiator || '';
  const u = resolvePerson(name);
  return { assignee: u?.name || '', assigneeId: u?.emp_no || u?.id || '', slot: slot || undefined };
}

function approvalSteps(project, initiator, stepTitles) {
  return stepTitles.map((title, i) => ({
    title, ...(i === 0 ? { assignee: initiator, assigneeId: userByName(initiator)?.emp_no || userByName(initiator)?.id || '' } : stepAssignee(project, title, initiator)),
    status: i === 0 ? 'approved' : i === 1 ? 'current' : 'pending',
    at: i === 0 ? TODAY() : null,
    comment: i === 0 ? '提交发起。' : null,
  }));
}

function assertApprovalAssignments(steps) {
  const missing = steps.slice(1).filter((x) => !x.assignee).map((x) => x.title);
  if (missing.length) { const err = new Error(`审批节点尚未绑定具体人员和工号：${missing.join('、')}`); err.status = 409; throw err; }
}

function effectiveDeclarationChain(ch) {
  if (ch.key === 'XX25') return ['项目联系人','项目负责人','项目承担部门负责人','二级总师','单位科技部门负责人','单位分管领导','一级总师','总部科研项目处'];
  if (ch.key === 'CLLM') return ['项目团队提交申请书','联盟专委会审查','联盟理事会审查','总部科研项目处报批'];
  if (String(ch.key).startsWith('DFY_')) return ['建设单位提交项目建议书','研究院学术委员会评审','形成拟立项清单','研究院理事会审议'];
  return J(ch.approve_chain_json, []);
}
r.get('/approvals', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  let rows = db.prepare("SELECT * FROM approvals WHERE type<>'post_eval' ORDER BY created_at DESC").all().map(mapApproval);
  const { mine, status, projectId } = req.query;
  if (status) rows = rows.filter((a) => a.status === status);
  if (projectId) rows = rows.filter((a) => String(a.project_id) === String(projectId));
  if (mine === '1') {
    rows = rows.filter((a) => {
      if (a.status !== '审批中') return false;
      const step = a.steps[a.current_step];
      if (!step) return false;
      if (user.role === 'admin') return true;
      return isCurrentStepAssignee(user, step);
    });
  } else {
    rows = rows.filter((a) => canSeeApproval(user, a));
  }
  res.json(rows.map((a) => withApprovalAuth(user, a)));
});

r.get('/approvals/:id', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  const mapped = mapApproval(a);
  if (!canSeeApproval(user, mapped)) return res.status(403).json({ error: '无权查看该流程' });
  res.json(withApprovalAuth(user, mapped));
});

r.post('/approvals/:id/act', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const { action, comment } = req.body || {};
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '流程已办结' });
  if (a.type === 'acceptance' && action === 'approve') {
    const gate = acceptPrecheck(a.project_id);
    if (!gate.ok) {
      return res.status(409).json({ error: '验收前置条件已发生变化，当前审批已锁定，请退回整改', checks: gate.checks });
    }
  }
  const steps = J(a.steps_json, []);
  const idx = a.current_step;
  if (!canActApprovalStep(user, a, steps[idx])) return res.status(403).json({ error: '当前节点不在您的审批权限内' });
  const now = TODAY();
  if (action === 'approve') {
    steps[idx] = { ...steps[idx], status: 'approved', at: now, comment: comment || '同意。', actor: user.name };
    let newStatus = a.status, newIdx = idx + 1;
    if (newIdx >= steps.length) {
      newStatus = '已通过';
      newIdx = steps.length - 1;
      applyApprovalEffect(a, user);
    } else {
      const project = a.project_id ? db.prepare('SELECT * FROM projects WHERE id=?').get(a.project_id) : null;
      const assigned = stepAssignee(project, steps[newIdx].title, a.initiator);
      steps[newIdx] = { ...steps[newIdx], ...assigned, status: 'current' };
      if (!steps[newIdx].assignee) return res.status(409).json({ error: `下一节点「${steps[newIdx].title}」尚未绑定具体人员和工号，请先完善项目团队` });
    }
    db.prepare('UPDATE approvals SET steps_json=?, current_step=?, status=? WHERE id=?').run(JSON.stringify(steps), newIdx, newStatus, a.id);
    audit(user.name, newStatus === '已通过' ? '审批办结' : '审批通过', a.title, `节点「${steps[idx].title}」${comment || '同意'}`);
  } else if (action === 'reject') {
    steps[idx] = { ...steps[idx], status: 'rejected', at: now, comment: comment || '退回修改。', actor: user.name };
    db.prepare('UPDATE approvals SET steps_json=?, status=? WHERE id=?').run(JSON.stringify(steps), '已驳回', a.id);
    audit(user.name, '审批驳回', a.title, comment || '退回修改');
  } else {
    return res.status(400).json({ error: 'bad action' });
  }
  res.json(withApprovalAuth(user, db.prepare('SELECT * FROM approvals WHERE id=?').get(a.id)));
});


/** V19 填表阶段字段元数据：立项申报 / 实施基本信息 / 系统生成 */
const STAGE_FIELD_META = [
  { code: 'code', label: '项目编号', stage: 'system', filler: '系统', required: false },
  { code: 'level', label: '级别', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'channel', label: '项目渠道', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'major1', label: '一级专业', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'major2', label: '二级专业', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'name', label: '项目名称', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'goal', label: '项目目标', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'start', label: '开始日期', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'end', label: '结束日期', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'budget', label: '总经费', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'partners', label: '参研单位与分工', stage: 'declaration', filler: '项目团队', required: false },
  { code: 'contact', label: '项目联系人', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'owner', label: '项目负责人', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'tech', label: '技术负责人', stage: 'declaration', filler: '项目团队', required: true },
  { code: 'yearGoal', label: '年度目标', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'pm', label: '项目主管', stage: 'baseinfo', filler: '项目团队', required: true },
  { code: 'chief1', label: '一级总师', stage: 'baseinfo', filler: '项目团队', required: true },
  { code: 'chief2', label: '二级总师', stage: 'baseinfo', filler: '项目团队', required: true },
  { code: 'hqHead', label: '总部处室处长', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'hqStaff', label: '总部处室主管', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'unitDeptHead', label: '单位科技部长', stage: 'baseinfo', filler: '项目团队', required: true },
  { code: 'unitStaff', label: '单位科技主管', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'finHq', label: '总部财务主管', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'finHead', label: '单位财务部长', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'finStaff', label: '单位财务主管', stage: 'baseinfo', filler: '项目团队', required: false },
  { code: 'warning', label: '预警', stage: 'system', filler: '系统', required: false },
  { code: 'transform', label: '成果转化状态', stage: 'system', filler: '系统', required: false },
];

function applyApprovalEffect(a, user) {
  const payload = J(a.payload_json, {});
  if (a.type === 'funding' && payload.requestId) {
    const q = db.prepare('SELECT * FROM funding_requests WHERE id=?').get(Number(payload.requestId));
    if (q) {
      db.prepare("UPDATE funding_requests SET status='已拨付', decided_at=? WHERE id=?").run(TODAY(), q.id);
      db.prepare('UPDATE funding_quota SET paid=paid+? WHERE year=? AND unit_id=?').run(q.amount, q.year, q.unit_id);
      audit(user.name, '总部经费双审拨付', `${q.amount}万元`, q.purpose);
    }
    return;
  }
  if (!a.project_id) return;
  if (a.type === 'declaration') {
    db.prepare("UPDATE projects SET status='待立项确认' WHERE id=? AND status='申报中'").run(a.project_id);
  } else if (a.type === 'filing') {
    db.prepare("UPDATE projects SET status='实施中' WHERE id=? AND status IN ('申报中','立项中')").run(a.project_id);
  } else if (a.type === 'acceptance') {
    // 验收办结：状态流转 + 记录办结日期（协作评价 30 日倒计时锚点）
    db.prepare("UPDATE projects SET status='已验收', accepted_at=? WHERE id=?").run(TODAY(), a.project_id);
  } else if (a.type === 'baseinfo' && payload.fields) {
    const f = payload.fields;
    const allowed = ['name','goal','level','channel_id','lead_unit_id','start','end','total_budget'];
    for (const key of allowed) if (f[key] != null) db.prepare(`UPDATE projects SET ${key}=? WHERE id=?`).run(f[key], a.project_id);
    if (f.yearGoal != null) db.prepare('UPDATE projects SET year_goal=? WHERE id=?').run(String(f.yearGoal).slice(0, 500), a.project_id);
    if (Array.isArray(f.partners)) db.prepare('UPDATE projects SET partners_json=? WHERE id=?').run(JSON.stringify(f.partners), a.project_id);
    if (f.team && typeof f.team === 'object') writeProjectMembers(a.project_id, f.team, user.name);
    if (f.finance && typeof f.finance === 'object') {
      db.prepare(`INSERT INTO project_finance_profile (project_id,central_grant,internal_grant,self_fund,internal_self_fund,source,approved_at,approved_by)
        VALUES (?,?,?,?,?,'基本信息审批',?,?) ON CONFLICT(project_id) DO UPDATE SET central_grant=excluded.central_grant,internal_grant=excluded.internal_grant,self_fund=excluded.self_fund,internal_self_fund=excluded.internal_self_fund,source=excluded.source,approved_at=excluded.approved_at,approved_by=excluded.approved_by`)
        .run(a.project_id, Number(f.finance.centralGrant || 0), Number(f.finance.internalGrant || 0), Number(f.finance.selfFund || 0), Number(f.finance.internalSelfFund || 0), TODAY(), user.name);
    }
  } else if (a.type === 'milestone_close' && payload.milestone) {
    db.prepare('UPDATE milestones SET done_at=?, evidence=? WHERE project_id=? AND title=?').run(TODAY(), payload.evidenceFile || '真实佐证材料已归档', a.project_id, payload.milestone);
  } else if (a.type === 'plan_finish' && payload.plan) {
    db.prepare("UPDATE plans SET status='已完成', done_at=? WHERE project_id=? AND title=?").run(TODAY(), a.project_id, payload.plan);
  } else if (a.type === 'change') {
    const v = payload.proposed || {};
    if (payload.category === '延期' && v.milestoneId && v.newDue) db.prepare('UPDATE milestones SET due=?,delay_reason=? WHERE id=? AND project_id=?').run(v.newDue, payload.reason || '', Number(v.milestoneId), a.project_id);
    else if (payload.category === '整体周期' && v.newEnd) db.prepare('UPDATE projects SET end=? WHERE id=?').run(v.newEnd, a.project_id);
    else if (payload.category === '经费' && v.totalBudget != null) db.prepare('UPDATE projects SET total_budget=? WHERE id=?').run(Number(v.totalBudget), a.project_id);
    else if (payload.category === '核心指标' && v.goal != null) db.prepare('UPDATE projects SET goal=? WHERE id=?').run(String(v.goal).slice(0, 500), a.project_id);
    else if (payload.category === '基础信息' && v.field && ['name','start','end'].includes(v.field)) db.prepare(`UPDATE projects SET ${v.field}=? WHERE id=?`).run(String(v.value), a.project_id);
    else if (payload.category === '外协方' && v.collaboratorId && v.name) db.prepare('UPDATE collaborators SET name=? WHERE id=? AND project_id=?').run(String(v.name), Number(v.collaboratorId), a.project_id);
    else if (payload.category === '交付物' && v.deliverableId && v.due) db.prepare('UPDATE deliverables SET due=? WHERE id=? AND project_id=?').run(v.due, Number(v.deliverableId), a.project_id);
    else if (payload.category === '付款节点' && v.contractId && Array.isArray(v.paymentNodes)) db.prepare('UPDATE external_contracts SET payment_nodes_json=? WHERE id=? AND project_id=?').run(JSON.stringify(v.paymentNodes), Number(v.contractId), a.project_id);
    db.prepare("UPDATE changes SET status='已通过' WHERE id=(SELECT id FROM changes WHERE project_id=? AND kind='项目变更' AND status='审批中' ORDER BY id DESC LIMIT 1)").run(a.project_id);
  } else if (a.type === 'data_change') {
    const v = payload.proposed || {};
    if (v.field && ['goal','year_goal','name','start','end'].includes(v.field)) db.prepare(`UPDATE projects SET ${v.field}=? WHERE id=?`).run(String(v.value ?? ''), a.project_id);
    db.prepare("UPDATE changes SET status='已通过' WHERE project_id=? AND kind='数据变更' AND status='审批中'").run(a.project_id);
  } else if (a.type === 'budget' && payload.year && payload.budget != null) {
    const f = db.prepare('SELECT * FROM funds WHERE project_id=? AND year=?').get(a.project_id, Number(payload.year));
    if (f) db.prepare('UPDATE funds SET budget=? WHERE id=?').run(Number(payload.budget), f.id);
    else db.prepare('INSERT INTO funds (project_id,year,budget,spent,writeoffs_json) VALUES (?,?,?,0,?)')
      .run(a.project_id, Number(payload.year), Number(payload.budget), '[]');
    audit(user.name, '预算审批生效', a.title, `绑定里程碑：${payload.milestoneTitle || '未指定'}`);
  } else if (a.type === 'milestone_plan' && Array.isArray(payload.milestones)) {
    db.prepare('UPDATE projects SET year_goal=? WHERE id=?').run(String(payload.yearGoal || '').slice(0, 500), a.project_id);
    const exists = db.prepare('SELECT id FROM milestones WHERE project_id=? AND title=? AND due=?');
    const insert = db.prepare('INSERT INTO milestones (project_id,year,seq,title,due,done_at,evidence) VALUES (?,?,?,?,?,NULL,NULL)');
    let seq = Number(db.prepare('SELECT COALESCE(MAX(seq),0) n FROM milestones WHERE project_id=?').get(a.project_id)?.n || 0);
    for (const item of payload.milestones) {
      if (!exists.get(a.project_id, item.title, item.due)) insert.run(a.project_id, Number(payload.year), ++seq, item.title, item.due);
    }
    audit(user.name, '年度里程碑计划生效', a.title, `${payload.year}年度，共 ${payload.milestones.length} 个节点`);
  } else if (a.type === 'blacklist' && payload.collaboratorId) {
    db.prepare('UPDATE collaborators SET blacklisted=1 WHERE id=?').run(Number(payload.collaboratorId));
    audit(user.name, '协作单位黑名单生效', a.title, '管理、法务合规及总部审批通过后生效');
  } else if (a.type === 'package' && payload.package) {
    db.prepare("UPDATE packages SET status=CASE WHEN status='待审批' THEN '未启动' ELSE status END WHERE code=?").run(payload.package);
  } else if (a.type === 'deliverable' && payload.deliverableId) {
    db.prepare('UPDATE deliverables SET delivered_at=? WHERE id=?').run(TODAY(), Number(payload.deliverableId));
  } else if (a.type === 'evaluation' && payload.collaboratorId) {
    db.prepare('UPDATE collaborators SET scores_json=?,total=?,grade=?,eval_date=?,evaluator=?,blacklisted=0 WHERE id=?')
      .run(JSON.stringify(payload.scores || {}), Number(payload.total), payload.grade, TODAY(), a.initiator, Number(payload.collaboratorId));
    if (payload.grade === '不合格') newApproval({ type: 'blacklist', title: `「${payload.collaboratorName}」协作单位黑名单认定`, project: db.prepare('SELECT * FROM projects WHERE id=?').get(a.project_id), initiator: user.name, stepTitles: ['管理团队提交不合格评价', '二级单位主管部门复核', '法务合规审核', '总部管理部门确认'], payload: { collaboratorId: payload.collaboratorId, total: payload.total, grade: payload.grade, materialUploads: payload.materialUploads } });
  }
}

// ---------- 审批流程生命周期：撤销 / 重新提交 / 转办 / 附件 ----------
r.post('/approvals/:id/withdraw', (req, res) => {
  const user = currentUser(req);
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '仅在途流程可撤销' });
  if (a.initiator !== user.name) return res.status(403).json({ error: '仅填报人可发起撤销' });
  db.prepare("UPDATE approvals SET status='已撤销' WHERE id=?").run(a.id);
  if (a.type === 'declaration' && a.project_id) {
    db.prepare("UPDATE projects SET status='草稿' WHERE id=? AND status='申报中'").run(a.project_id);
  }
  audit(user.name, '流程撤销', a.title, '撤销后回归草稿状态，撤销记录永久留存');
  res.json({ ok: true });
});

r.post('/approvals/:id/resubmit', (req, res) => {
  const user = currentUser(req);
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (!['已驳回', '已撤销'].includes(a.status)) return res.status(400).json({ error: '仅驳回/撤销的流程可重新提交' });
  if (a.initiator !== user.name) return res.status(403).json({ error: '仅填报人可重新提交' });
  const steps = J(a.steps_json, []).map((s, i) => ({
    ...s,
    status: i === 0 ? 'approved' : i === 1 ? 'current' : 'pending',
    at: i === 0 ? TODAY() : null,
    comment: i === 0 ? '修改完善后重新提交。' : null,
  }));
  db.prepare("UPDATE approvals SET status='审批中', current_step=?, steps_json=? WHERE id=?").run(Math.min(1, steps.length - 1), JSON.stringify(steps), a.id);
  if (a.type === 'declaration' && a.project_id) {
    db.prepare("UPDATE projects SET status='申报中' WHERE id=? AND status='草稿'").run(a.project_id);
  }
  audit(user.name, '重新提交', a.title, '驳回/撤销后修改再提交，流程自初始节点重新流转');
  res.json({ ok: true });
});

r.post('/approvals/:id/delegate', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const { to } = req.body || {};
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '仅在途流程可转办' });
  if (!to || !String(to).trim()) return res.status(400).json({ error: '请填写转办对象' });
  const steps = J(a.steps_json, []);
  if (!canActApprovalStep(user, a, steps[a.current_step])) return res.status(403).json({ error: '仅当前节点处理人可转办' });
  const from = steps[a.current_step]?.assignee || '';
  steps[a.current_step] = { ...steps[a.current_step], assignee: String(to).trim(), delegatedFrom: from };
  db.prepare('UPDATE approvals SET steps_json=? WHERE id=?').run(JSON.stringify(steps), a.id);
  audit(user.name, '转办', a.title, `节点「${steps[a.current_step].title}」由 ${from || '未指派'} 转办至 ${to}`);
  res.json({ ok: true });
});

r.post('/approvals/:id/attach', (req, res) => {
  const user = currentUser(req);
  const { uploadId } = req.body || {};
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '仅在途流程可更改附件' });
  const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
  if (!up) return res.status(400).json({ error: '附件不存在，请先上传' });
  const payload = J(a.payload_json, {});
  payload.attachments = [...(payload.attachments || []), { name: up.orig_name, uploadId: up.id, by: user.name, at: TODAY() }];
  db.prepare('UPDATE approvals SET payload_json=? WHERE id=?').run(JSON.stringify(payload), a.id);
  if (a.project_id) {
    db.prepare('UPDATE uploads SET project_id=? WHERE id=?').run(a.project_id, up.id);
    db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb,file_path) VALUES (?,?,?,?,?,?,?)')
      .run(a.project_id, '申报', up.orig_name, TODAY(), user.name, up.size_kb, up.stored_name);
  }
  audit(user.name, '附件更改', a.title, `流程中替换/补充附件「${up.orig_name}」`);
  res.json({ ok: true });
});


/** 将材料清单与真实 uploadId 归档到 documents（可下载）；缺文件则报错 */
function archiveMaterialUploads({ pid, phase, requiredNames, materialUploads, userName, allowEmpty = false }) {
  const required = (requiredNames || []).map((x) => String(x));
  const uploads = Array.isArray(materialUploads) ? materialUploads : [];
  const byName = new Map();
  for (const row of uploads) {
    const name = String(row?.name || '').trim();
    const uploadId = Number(row?.uploadId);
    if (!name || !uploadId) continue;
    byName.set(name, uploadId);
  }
  if (!allowEmpty && required.length) {
    const missing = required.filter((n) => !byName.has(n));
    if (missing.length) {
      const err = new Error(`尚有申报/佐证材料未上传：${missing.join('、')}`);
      err.status = 400;
      throw err;
    }
  }
  const linked = [];
  for (const [label, uploadId] of byName) {
    const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
    if (!up) {
      const err = new Error(`材料「${label}」对应文件不存在，请重新上传`);
      err.status = 400;
      throw err;
    }
    db.prepare('UPDATE uploads SET project_id=? WHERE id=?').run(pid, up.id);
    const docName = up.orig_name?.includes(label) ? up.orig_name : `${label}-${up.orig_name}`;
    db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb,file_path) VALUES (?,?,?,?,?,?,?)')
      .run(pid, phase, docName, up.uploaded_at || TODAY(), up.uploader || userName, up.size_kb, up.stored_name);
    linked.push({ name: label, uploadId: up.id, file: up.orig_name });
  }
  return linked;
}

// ---------- 申报 ----------
r.post('/declarations', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const { name, channelId, goal, budget, start, end, partners, materials, materialUploads, uploadId, milestones, deliverables, yearGoal, team: submittedTeam = {}, major1, major2, demandUnit, leadWork, leadUnitId, finance } = req.body || {};
  if (!name || !channelId) return res.status(400).json({ error: '缺少项目名称或渠道' });
  if (!String(goal || '').trim()) return res.status(400).json({ error: '立项申报须填写项目目标' });
  if (!start || !end) return res.status(400).json({ error: '立项申报须填写项目起止日期' });
  if (!(Number(budget) > 0)) return res.status(400).json({ error: '立项申报须填写总经费（万元）' });
  const maj = validateMajorPair(major1, major2);
  if (!maj.ok) return res.status(400).json({ error: maj.error || '立项申报须选择附件1口径的一级/二级专业' });
  if (!String(leadWork || '').trim()) return res.status(400).json({ error: '立项申报须填写牵头单位主要工作内容' });
  if (!resolvePerson(submittedTeam.owner)) return res.status(400).json({ error: '立项申报须指定项目负责人（在岗账号）' });
  if (!resolvePerson(submittedTeam.tech)) return res.status(400).json({ error: '立项申报须指定技术负责人（在岗账号）' });
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(channelId);
  if (!ch) return res.status(400).json({ error: '渠道不存在' });
  const requiredMats = materials || J(ch.declare_json, []);
  if (requiredMats.length) {
    const probe = Array.isArray(materialUploads) ? materialUploads : [];
    const have = new Set(probe.map((x) => String(x?.name || '').trim()).filter(Boolean));
    const missing = requiredMats.filter((n) => !have.has(String(n)));
    if (missing.length) return res.status(400).json({ error: `尚有申报材料未上传：${missing.join('、')}` });
    for (const row of probe) {
      if (!db.prepare('SELECT id FROM uploads WHERE id=?').get(Number(row?.uploadId))) {
        return res.status(400).json({ error: `材料「${row?.name}」文件不存在，请重新上传` });
      }
    }
  }
  const year = Number(TODAY().slice(0, 4));
  const n = db.prepare('SELECT COUNT(*) n FROM projects WHERE code LIKE ?').get(`KY-${year}-%`).n;
  const code = `KY-${year}-${String(n + 1).padStart(3, '0')}`;
  const chainDefaults = { pm: '吴思远', chief1: '陈铁军', chief2: '蔡文渊', hqHead: '王建国', hqStaff: '何雨桐', unitDeptHead: '方致远', unitStaff: '田念慈', finHq: '', finHead: '毕仲文', finStaff: '龚雪君' };
  const ownerPerson = resolvePerson(submittedTeam.owner);
  const techPerson = resolvePerson(submittedTeam.tech);
  const team = {
    ...chainDefaults,
    ...submittedTeam,
    contact: submittedTeam.contact || user.name,
    owner: ownerPerson.name,
    tech: techPerson.name,
  };
  for (const [k, v] of Object.entries(chainDefaults)) {
    if (!String(team[k] || '').trim()) team[k] = v;
  }
  const partnerRows = (Array.isArray(partners) ? partners : []).map((x) => {
    if (x && typeof x === 'object') return { name: String(x.name || '').trim(), work: String(x.work || '').trim() };
    return { name: String(x || '').trim(), work: '' };
  }).filter((x) => x.name);
  const unitId = Number(leadUnitId) || resolveUnitIdByName(req.body?.responsibleUnit) || user.unit_id || 1;
  const info = db.prepare(`INSERT INTO projects (code,wbs,name,goal,level,channel_id,lead_unit_id,partners_json,team_json,start,end,status,total_budget,tags_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(code, null, name, goal || '', ch.level, ch.id, unitId, JSON.stringify(partnerRows), JSON.stringify(team), start || TODAY(), end || `${year + 2}-12-31`, '申报中', Number(budget) || 0, JSON.stringify([ch.name]));
  const pid = info.lastInsertRowid;
  db.prepare('UPDATE projects SET major1=?, major2=?, demand_unit=?, lead_work=? WHERE id=?')
    .run(maj.major1, maj.major2, String(demandUnit || '').slice(0, 80), String(leadWork || '').slice(0, 500), pid);
  const writtenTeam = writeProjectMembers(pid, team, user.name);
  let linkedMats = [];
  try {
    linkedMats = archiveMaterialUploads({
      pid, phase: '申报', requiredNames: requiredMats, materialUploads, userName: user.name,
    });
  } catch (e) {
    db.prepare('DELETE FROM project_members WHERE project_id=?').run(pid);
    db.prepare('DELETE FROM projects WHERE id=?').run(pid);
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  const chain = effectiveDeclarationChain(ch);
  const steps = approvalSteps({ id: pid, lead_unit_id: user.unit_id || 1, team_json: JSON.stringify(writtenTeam) }, user.name, chain);
  try { assertApprovalAssignments(steps); } catch (e) {
    db.prepare('DELETE FROM project_members WHERE project_id=?').run(pid);
    db.prepare('DELETE FROM projects WHERE id=?').run(pid);
    return res.status(e.status || 409).json({ error: e.message });
  }
  const isFiling = ch.declare_mode === '报备';
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('declaration', `「${name}」${ch.name} ${isFiling ? '报备申签' : '申报审签'}`, pid, user.name, user.unit_id || 1, TODAY(), '审批中', 1, JSON.stringify(steps), JSON.stringify({ materials: requiredMats, materialUploads: linkedMats, declareMode: ch.declare_mode }));
  // AI 识读预填的里程碑 / 交付物（用户已核对修改）
  const endDate = end || `${year + 2}-12-31`;
  if (Array.isArray(milestones)) {
    milestones.filter((m) => m && m.title).forEach((m, i) => {
      const due = m.due || endDate;
      db.prepare('INSERT INTO milestones (project_id,year,seq,title,due,done_at,evidence,delay_reason) VALUES (?,?,?,?,?,NULL,NULL,NULL)')
        .run(pid, Number(String(due).slice(0, 4)) || year, i + 1, String(m.title).slice(0, 80), due);
    });
  }
  if (Array.isArray(deliverables)) {
    for (const dRow of deliverables.filter((x) => x && x.name)) {
      db.prepare('INSERT INTO deliverables (project_id,name,type,due,delivered_at,owner,package_id) VALUES (?,?,?,?,NULL,?,NULL)')
        .run(pid, String(dRow.name).slice(0, 80), DELIV_TYPES.includes(dRow.type) ? dRow.type : '成套技术成果', endDate, '公司');
    }
  }
  if (yearGoal) db.prepare('UPDATE projects SET year_goal=? WHERE id=?').run(String(yearGoal).slice(0, 120), pid);
  if (finance && typeof finance === 'object') {
    db.prepare(`INSERT INTO project_finance_profile (project_id,central_grant,internal_grant,self_fund,internal_self_fund,source,approved_at,approved_by)
      VALUES (?,?,?,?,?,'立项申报',?,?) ON CONFLICT(project_id) DO UPDATE SET central_grant=excluded.central_grant,internal_grant=excluded.internal_grant,self_fund=excluded.self_fund,internal_self_fund=excluded.internal_self_fund,source=excluded.source,approved_at=excluded.approved_at,approved_by=excluded.approved_by`)
      .run(pid, Number(finance.centralGrant || 0), Number(finance.internalGrant || 0), Number(finance.selfFund || 0), Number(finance.internalSelfFund || 0), TODAY(), user.name);
  }
  if (uploadId) {
    const already = linkedMats.some((x) => Number(x.uploadId) === Number(uploadId));
    const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
    if (up && !already) {
      db.prepare('UPDATE uploads SET project_id=? WHERE id=?').run(pid, up.id);
      db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb,file_path) VALUES (?,?,?,?,?,?,?)')
        .run(pid, '申报', up.orig_name, up.uploaded_at, up.uploader || user.name, up.size_kb, up.stored_name);
    }
  }
  audit(user.name, '发起申报', name, `渠道：${ch.name}，在线提交申报审签流程（材料 ${linkedMats.length} 份真文件归档${uploadId ? ' + AI 识读原件' : ''}）`);
  const roleBits = [['contact', '项目联系人'], ['owner', '项目负责人'], ['tech', '技术负责人']]
    .filter(([k]) => writtenTeam[k])
    .map(([, lab]) => lab);
  db.prepare('INSERT INTO alerts (project_id,kind,level,title,due,created_at,channels,recipients,read) VALUES (?,?,?,?,?,?,?,?,0)')
    .run(
      pid,
      '岗位流转',
      'blue',
      `【申报流转】「${name}」已提交审签，已下发至${roleBits.join('、')}工作台`,
      TODAY(),
      TODAY(),
      '站内,邮箱,蓝信',
      [writtenTeam.contact, writtenTeam.owner, writtenTeam.tech].filter(Boolean).join('、'),
    );
  const alertRow = db.prepare('SELECT * FROM alerts WHERE project_id=? ORDER BY id DESC LIMIT 1').get(pid);
  if (alertRow) queueAlertNotifications(alertRow);
  res.json({ ok: true, projectId: pid, code });
});

const DELIV_TYPES = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果'];

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function overlapScore(a, b) {
  const aa = new Set([...normalizeText(a)]);
  const bb = new Set([...normalizeText(b)]);
  if (!aa.size || !bb.size) return 0;
  let n = 0;
  for (const x of aa) if (bb.has(x)) n += 1;
  return n / Math.max(aa.size, bb.size);
}

/** V19 新增：立项阶段项目查重入口（基础字段查重，后续可接相似度/知识库算法） */
r.post('/project-duplicates', (req, res) => {
  const user = currentUser(req);
  const { name, code, channelId, level, leadUnitId, owner, keywords } = req.body || {};
  if (!name && !code) return res.status(400).json({ error: '请至少填写项目名称或项目编号后再查重' });
  const today = TODAY();
  const projects = db.prepare('SELECT * FROM projects').all().map((p) => enrichProject(p, today));
  const matches = projects.map((p) => {
    let score = 0;
    const hitFields = [];
    if (code && normalizeText(p.code) === normalizeText(code)) { score += 55; hitFields.push('项目编号'); }
    const ns = overlapScore(name, p.name);
    if (name && ns >= 0.35) { score += Math.round(ns * 40); hitFields.push('项目名称'); }
    if (channelId && String(p.channel_id) === String(channelId)) { score += 8; hitFields.push('项目渠道'); }
    if (level && p.level === level) { score += 6; hitFields.push('项目级别'); }
    if (leadUnitId && String(p.lead_unit_id) === String(leadUnitId)) { score += 8; hitFields.push('责任单位'); }
    if (owner && [p.team.contact, p.team.owner, p.team.tech, p.team.pm].some((x) => normalizeText(x) === normalizeText(owner))) { score += 8; hitFields.push('项目联系人/负责人/团队'); }
    if (keywords) {
      const kScore = String(keywords).split(/[，,、\s]+/).filter(Boolean).some((k) => normalizeText(p.name + p.goal).includes(normalizeText(k)));
      if (kScore) { score += 8; hitFields.push('关键词'); }
    }
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      level: p.level,
      channelId: p.channel_id,
      unitId: p.lead_unit_id,
      status: p.status,
      owner: p.team.owner,
      similarity: Math.min(99, score),
      hitFields,
      suggestion: score >= 70 ? '高度疑似重复，建议退回核实或补充差异说明' : score >= 45 ? '存在相似项目，建议提交前补充查重说明' : '低相似，可继续提交并留痕',
    };
  }).filter((x) => x.similarity >= 35).sort((a, b) => b.similarity - a.similarity).slice(0, 8);
  audit(user.name, '项目查重', name || code, `命中 ${matches.length} 条疑似项目，基础字段查重入口已留痕`);
  res.json({ checkedAt: new Date().toISOString(), matches, algorithm: '基础字段相似度（预留高级算法接口）' });
});

/** V19 新增：成果转化独立台账（有表单台账时从台账拆成果包，不再读演示 packages） */
r.get('/transformations', (req, res) => {
  const user = currentUser(req);
  const today = TODAY();
  const { status, mode, unit, kw } = req.query;
  const displayed = listDisplayProjects(user, today);
  const live = displayed.list.filter((p) => !p.ledgerSource);
  const ledgers = displayed.list.filter((p) => p.ledgerSource);
  let rows = [];
  if (ledgers.length) {
    rows = ledgers.flatMap((p) => (p.packages || []).map((k) => ({
      ...k,
      color: packageColor(k, today),
      deliverableCount: 0,
      deliverables: [],
      target: transformationTarget(k),
      unitShort: p.v19?.responsibleUnit || '',
      pname: k.pname || p.name,
      pcode: k.pcode || p.code,
      level: p.level,
      pstatus: p.status,
    })));
  }
  if (live.length) {
    const visible = new Set(live.map((p) => p.id));
    const sqlRows = db.prepare(`SELECT k.*, p.name pname, p.code pcode, p.level, p.status pstatus, u.short unitShort
      FROM packages k JOIN projects p ON p.id=k.project_id JOIN units u ON u.id=k.unit_id ORDER BY k.plan_date`).all()
      .filter((k) => visible.has(k.project_id))
      .map((k) => ({
        ...k,
        color: packageColor(k, today),
        deliverableCount: db.prepare('SELECT COUNT(*) n FROM deliverables WHERE package_id=?').get(k.id).n,
        deliverables: db.prepare('SELECT name,type,delivered_at FROM deliverables WHERE package_id=?').all(k.id),
        target: transformationTarget(k),
      }));
    rows = rows.concat(sqlRows);
  }
  if (status) rows = rows.filter((k) => k.status === status);
  if (mode) rows = rows.filter((k) => k.mode === mode);
  if (unit) rows = rows.filter((k) => String(k.unit_id) === String(unit));
  if (kw) rows = rows.filter((k) => `${k.name}${k.pname}${k.code}`.includes(kw));
  const stats = {
    total: rows.length,
    model: rows.filter((k) => k.mode === '向型号转化').length,
    market: rows.filter((k) => k.mode === '向市场转化').length,
    done: rows.filter((k) => k.status === '已完成').length,
    overdue: rows.filter((k) => k.color === 'red').length,
  };
  res.json({ rows, stats, readonly: user.role === 'leader' });
});

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, ' ').trim();
}

function cellRawText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\r\n/g, '\n').trim();
}

function cellNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cellText(value).replace(/,/g, '').replace(/万元/g, '').replace(/%$/, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(value) {
  return cellText(value).replace(/\s+/g, '').toLowerCase();
}

function normalizeHeaderLabel(value) {
  return cellText(value).replace(/\s+/g, '').replace(/[()]/g, (m) => (m === '(' ? '（' : '）'));
}

function transitionFieldLabels(field) {
  return [field.label, ...(field.aliases || [])].map((x) => normalizeHeaderLabel(x));
}

function buildTransitionHeaderMap(headerLine, subHeaderLine = [], groupLine = []) {
  const colByLabel = new Map();
  const maxCols = Math.max(headerLine.length, subHeaderLine.length, groupLine.length, TRANSITION_FIELDS.length);
  for (let c = 0; c < maxCols; c += 1) {
    const labels = [headerLine[c], subHeaderLine[c], groupLine[c]].map((x) => normalizeHeaderLabel(x)).filter(Boolean);
    for (const label of labels) if (!colByLabel.has(label)) colByLabel.set(label, c);
  }
  const map = new Map();
  const missing = [];
  for (const field of TRANSITION_FIELDS) {
    const col = transitionFieldLabels(field).map((label) => colByLabel.get(label)).find((x) => x != null);
    if (col == null) {
      if (field.required) missing.push(field.label);
      continue;
    }
    map.set(field.code, col);
  }
  const orgOfficeAliases = ['司局/处室', '司局／处室', '司局处室', '管理司局/处室'];
  const orgOfficeCol = orgOfficeAliases
    .map((label) => colByLabel.get(normalizeHeaderLabel(label)))
    .find((x) => x != null);
  if (orgOfficeCol != null) map.set('orgOffice', orgOfficeCol);
  return { map, missing };
}

function transitionProjectType(row) {
  return cellText(row.projectType || row.sourceSheet || row.sourceType) || '未分类';
}

function transitionTransformSummary(row) {
  if (row.transformSummary) return row.transformSummary;
  const parts = [];
  if (row.resultCount != null && row.resultCount !== '') parts.push(`成果 ${row.resultCount} 项`);
  if (row.convertedCount != null && row.convertedCount !== '') parts.push(`已转化 ${row.convertedCount} 项`);
  if (row.reserveCount != null && row.reserveCount !== '') parts.push(`储备 ${row.reserveCount} 项`);
  return parts.join('；') || row.resultNames || row.convertedNames || row.reserveNames || '暂无';
}

function normalizeTransitionRow(row) {
  const projectType = transitionProjectType(row);
  const sourceChannel = cellText(row.sourceChannel || row.channel);
  const path = liveResolveOffice(projectType);
  const orgOffice = cellText(row.orgOffice) || path?.office || '';
  const resultPack = normalizeResultFields(row);
  const next = {
    ...row,
    ...resultPack,
    id: row.id || `TR-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
    sourceType: projectType,
    sourceSheet: projectType,
    projectType,
    code: row.code || row.serial || '',
    channel: sourceChannel || path?.source || '',
    sourceChannel: sourceChannel || path?.source || '',
    orgOffice,
    level: cellText(row.level) || path?.level || row.level || '',
    leadWork: row.leadWork || [row.responsibleUnit, row.demandUnit].filter(Boolean).join(' / '),
    transformSummary: transitionTransformSummary({ ...row, ...resultPack }),
    closedExecutionRate: row.closedExecutionRate || row.executionRate || '',
    budget2026Actual: row.budget2026Actual ?? '',
    budget2026Rate: row.budget2026Rate || '',
    updatedBy: row.updatedBy || '汇总表维护人',
    updatedAt: row.updatedAt || TODAY(),
  };
  delete next.center;
  return next;
}

function defaultTransitionRows() {
  const projects = db.prepare('SELECT p.*, c.name cname, c.source_channel, c.org_office, c.org FROM projects p JOIN channels c ON c.id=p.channel_id ORDER BY p.id LIMIT 10').all().map((p) => enrichProject(p, TODAY()));
  return projects.map((p, i) => {
    const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(p.channel_id) || {};
    return normalizeTransitionRow({
    id: `TR-${String(i + 1).padStart(3, '0')}`,
    serial: String(i + 1),
    code: p.code,
    level: p.level,
    sourceChannel: ch.source_channel || '',
    orgOffice: ch.org_office || ch.org || '',
    projectType: ch.name || `${p.v19.major1 || '科技创新'}专项`,
    major1: p.v19.major1,
    major2: p.v19.major2,
    name: p.name,
    center: '上飞院',
    demandUnit: p.v19.demandUnit,
    responsibleUnit: p.v19.responsibleUnit,
    projectStatus: p.status,
    acceptanceStatus: p.status === '已验收' ? '已验收' : '未验收',
    owner: p.team?.owner || '',
    approvalMonth: p.v19.launchMonth,
    startMonth: p.v19.launchMonth,
    endMonth: p.v19.endMonth,
    duration: p.v19.projectMonths,
    totalBudget: p.total_budget,
    centralGrant: p.v19.centralGrant,
    selfFund: p.v19.selfFund,
    spent: p.v19.cumulativeSpent,
    budget2026: p.yearBudget,
    budget2026Actual: p.yearSpent,
    budget2026Rate: p.yearBudget ? `${Math.round((p.yearSpent / p.yearBudget) * 100)}%` : '',
    closedActualBudget: p.v19.closingActual,
    closedExecutionRate: `${p.v19.executionRate}%`,
    resultCount: p.v19.transformCount,
    resultNames: p.v19.transformSummary,
    updatedBy: i % 2 ? '总部项目类型主管' : '汇总表维护人',
    updatedAt: TODAY(),
  });
  });
}

const transitionKey = 'transition.records.v19';
function getTransitionRows() {
  const raw = db.prepare('SELECT value FROM kv WHERE key=?').get(transitionKey)?.value;
  return raw ? J(raw, []).map((x) => normalizeTransitionRow(x)) : [];
}
function setTransitionRows(rows) {
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(transitionKey, JSON.stringify(rows.map((x) => normalizeTransitionRow(x))));
}
function validateTransitionRow(input) {
  const row = normalizeTransitionRow(input);
  const missing = TRANSITION_FIELDS.filter((f) => f.required && !cellText(row[f.code])).map((f) => f.label);
  const warnings = [];
  const total = cellNumber(row.totalBudget);
  const grant = cellNumber(row.centralGrant) || 0;
  const self = cellNumber(row.selfFund) || 0;
  if (row.totalBudget !== '' && row.totalBudget != null && total == null) warnings.push('总经费需填写为数字');
  if (total != null && total <= 0) warnings.push('总经费需大于 0');
  if (total != null && grant + self > total + 0.01) warnings.push('国拨经费与自筹经费合计大于总经费');
  if (row.level && !LEVELS.includes(row.level)) warnings.push('级别不在国家级/地方级/公司级内');
  if (row.startMonth && row.endMonth && String(row.startMonth).slice(0, 7) > String(row.endMonth).slice(0, 7)) warnings.push('项目开始年月晚于结束年月');
  if (row.budget2026 && row.budget2026Actual && Number(row.budget2026) > 0 && !row.budget2026Rate) warnings.push('建议补充 2026年预算执行率');
  if (row.level && row.sourceChannel && row.projectType) {
    const hit = liveFindPath({
      level: row.level,
      sourceChannel: row.sourceChannel,
      orgOffice: row.orgOffice,
      projectType: row.projectType,
    });
    if (!hit) warnings.push('层级/渠道/司局/项目类型组合不在合法路径表内');
  } else if (row.projectType && !liveResolveOffice(row.projectType)) {
    warnings.push('项目类型未配置司局路径');
  }
  if (row.major1 || row.major2) {
    const maj = validateMajorPair(row.major1, row.major2);
    if (!maj.ok) warnings.push(maj.error);
  }
  return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}

function transitionIdentity(input) {
  const row = normalizeTransitionRow(input);
  if (cellText(row.serial)) return `serial:${normalizeKey(row.serial)}`;
  const name = normalizeKey(row.name);
  if (!name) return '';
  return `project:${[name, normalizeKey(row.sourceChannel), normalizeKey(row.responsibleUnit)].join('|')}`;
}

function transitionSubtables(rows) {
  const map = new Map();
  for (const row of rows) {
    const name = transitionProjectType(row);
    const info = map.get(name) || { name, count: 0, totalBudget: 0, invalid: 0 };
    info.count += 1;
    info.totalBudget += cellNumber(row.totalBudget) || 0;
    if (!validateTransitionRow(row).ok) info.invalid += 1;
    map.set(name, info);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

function transitionDuplicates(rows) {
  const seen = new Map();
  const dup = [];
  for (const row of rows) {
    const key = transitionIdentity(row);
    if (!key) continue;
    if (seen.has(key)) dup.push(row.name || row.serial || row.id);
    else seen.set(key, row.id);
  }
  return [...new Set(dup)];
}

function transitionTemplatePath() {
  const candidates = [
    join(__dirname, '..', 'templates', TRANSITION_TEMPLATE_FILE),
    join(__dirname, '..', 'data', 'templates', TRANSITION_TEMPLATE_FILE),
    join(__dirname, '..', '..', '..', '需求跟进材料', TRANSITION_TEMPLATE_FILE),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function colName(idx) {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const r1 = (n - 1) % 26;
    s = String.fromCharCode(65 + r1) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xmlEscape(value) {
  return cellRawText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlAttrEscape(value) {
  return xmlEscape(value).replace(/'/g, '&apos;');
}

function mergeTouchesDataRows(ref) {
  const nums = String(ref).match(/\d+/g)?.map(Number) || [];
  return nums.some((n) => n >= 6);
}

function refreshMergeCells(sheetXml, hasData) {
  if (!hasData) return sheetXml;
  return sheetXml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, (block) => {
    const refs = [...block.matchAll(/<mergeCell ref="([^"]+)"\/>/g)]
      .map((m) => m[1])
      .filter((ref) => !mergeTouchesDataRows(ref));
    if (!refs.length) return '';
    return `<mergeCells count="${refs.length}">${refs.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  });
}

function templateRowStyle(sheetXml) {
  const rowMatch = sheetXml.match(/<row\b[^>]*\br="6"[^>]*>[\s\S]*?<\/row>/);
  const rowOpen = rowMatch?.[0].match(/^<row\b([^>]*)>/)?.[1] || ' spans="1:39" ht="25" customHeight="1"';
  const rowAttrs = rowOpen
    .replace(/\sr="6"/, '')
    .replace(/\sspans="[^"]*"/, ' spans="1:39"')
    .trim();
  const styles = {};
  if (rowMatch) {
    for (const m of rowMatch[0].matchAll(/<c\b([^>]*)\br="([A-Z]+)6"([^>]*)/g)) {
      const attrs = `${m[1]} ${m[3]}`;
      const s = attrs.match(/\bs="([^"]+)"/)?.[1];
      styles[m[2]] = s || '';
    }
  }
  return { rowAttrs, styles };
}

function cellXml(rowNumber, field, row) {
  const col = colName(field.index);
  const value = exportTransitionValue(row || {}, field);
  const ref = `${col}${rowNumber}`;
  const style = field._style ? ` s="${field._style}"` : '';
  if (field.number && value !== '' && Number.isFinite(Number(value))) {
    return `<c r="${ref}"${style}><v>${Number(value)}</v></c>`;
  }
  if (value === '') return `<c r="${ref}"${style}/>`;
  const escaped = xmlEscape(value);
  const space = /\s/.test(String(value)[0] || '') || /\s$/.test(String(value)) || String(value).includes('\n') ? ' xml:space="preserve"' : '';
  return `<c r="${ref}"${style} t="inlineStr"><is><t${space}>${escaped}</t></is></c>`;
}

function transitionRowXml(rowNumber, row, rowAttrs, styleByCol) {
  const fields = TRANSITION_FIELDS.map((f) => ({ ...f, _style: styleByCol[colName(f.index)] || '' }));
  const cells = fields.map((f) => cellXml(rowNumber, f, row)).join('');
  return `<row r="${rowNumber}" ${rowAttrs}>${cells}</row>`;
}

function updateTemplateValidations(sheetXml, lastRow) {
  if (lastRow <= 6) return sheetXml;
  return sheetXml.replace(/sqref="([BCDEF])6"/g, (_, col) => `sqref="${col}6:${col}${lastRow}"`);
}

function replaceTemplateSheetData(sheetXml, rows) {
  if (!rows.length) return sheetXml;
  const lastRow = Math.max(6, rows.length + 5);
  const { rowAttrs, styles } = templateRowStyle(sheetXml);
  const headerRows = [...sheetXml.matchAll(/<row\b[^>]*\br="([1-5])"[^>]*>[\s\S]*?<\/row>/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => m[0])
    .join('');
  const dataRows = rows.map((row, i) => transitionRowXml(i + 6, row, rowAttrs, styles)).join('');
  let next = sheetXml.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:AM${lastRow}"/>`);
  next = next.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRows}${dataRows}</sheetData>`);
  next = next.replace(/<autoFilter\b([^>]*)\bref="[^"]+"/, `<autoFilter$1ref="A4:AM${lastRow}"`);
  next = refreshMergeCells(next, true);
  next = updateTemplateValidations(next, lastRow);
  return next;
}

function nextRelationshipId(relsXml) {
  const ids = [...relsXml.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]));
  return Math.max(0, ...ids) + 1;
}

function nextSheetId(workbookXml) {
  const ids = [...workbookXml.matchAll(/\bsheetId="(\d+)"/g)].map((m) => Number(m[1]));
  return Math.max(0, ...ids) + 1;
}

function buildTransitionHeaderMatrix(fields) {
  const top = Array(fields.length).fill('');
  const mid = Array(fields.length).fill('');
  const leaf = Array(fields.length).fill('');
  const merges = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field.headerBanner) {
      top[i] = field.label;
      merges.push({ s: { r: 1, c: i }, e: { r: 3, c: i } });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < fields.length && fields[j].group === field.group && !fields[j].headerBanner) j += 1;
    top[i] = field.group;
    if (j - i > 1) merges.push({ s: { r: 1, c: i }, e: { r: 1, c: j - 1 } });
    i = j;
  }
  i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field.headerBanner) {
      i += 1;
      continue;
    }
    if (!field.subGroup) {
      mid[i] = field.label;
      merges.push({ s: { r: 2, c: i }, e: { r: 3, c: i } });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < fields.length && fields[j].subGroup === field.subGroup && !fields[j].headerBanner) j += 1;
    mid[i] = field.subGroup;
    if (j - i > 1) merges.push({ s: { r: 2, c: i }, e: { r: 2, c: j - 1 } });
    for (let k = i; k < j; k += 1) leaf[k] = fields[k].label;
    i = j;
  }
  return { top, mid, leaf, merges };
}

function makeSimpleTransitionWorkbook(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeTransitionSheet(rows, '预先研究项目信息'), '预先研究项目信息');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function makeTransitionTemplateWorkbook(rows) {
  const fields = ledgerTransitionFields();
  try {
    return await buildStyledTransitionWorkbookBuffer(
      rows,
      '预先研究项目信息',
      fields,
      normalizeTransitionRow,
      buildTransitionHeaderMatrix,
    );
  } catch {
    return makeSimpleTransitionWorkbook(rows);
  }
}

function isTransitionDataRow(cells, columnMap = null) {
  if (normalizeHeaderLabel(cells[0]) === '填写说明') return false;
  return TRANSITION_FIELDS.some((f) => {
    const idx = columnMap?.get(f.code) ?? f.index;
    return cellText(cells[idx]);
  });
}

function transitionRowFromCells(cells, rowNumber, sourceFile, sourceSheet, userName, columnMap = null) {
  const row = {
    id: `TR-${Date.now().toString(36)}-${rowNumber}-${randomBytes(2).toString('hex')}`,
    sourceFile,
    sourceExcelSheet: sourceSheet,
    sourceRow: rowNumber,
    updatedBy: userName,
    updatedAt: TODAY(),
    raw: {},
  };
  for (const f of TRANSITION_FIELDS) {
    const columnIndex = columnMap ? columnMap.get(f.code) : f.index;
    const raw = columnIndex == null ? undefined : cells[columnIndex];
    row[f.code] = f.number ? cellNumber(raw) : cellRawText(raw);
    row.raw[f.label] = cellRawText(raw);
  }
  const orgOfficeColumn = columnMap?.get('orgOffice');
  if (orgOfficeColumn != null) {
    row.orgOffice = cellRawText(cells[orgOfficeColumn]);
    row.raw['司局/处室'] = row.orgOffice;
  }
  return normalizeTransitionRow(row);
}

function parseTransitionWorkbook(storedPath, sourceFile, userName) {
  const wb = XLSX.read(readFileSync(storedPath), { type: 'buffer', cellDates: false });
  if (wb.SheetNames.length > 100) throw new Error('工作表数量超过 100 个，请拆分文件后重新上传');
  const parsedSheets = [];
  const issues = [];
  let totalCells = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    if (range) {
      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;
      if (rowCount > 20000 || columnCount > 120) throw new Error(`工作表「${sheetName}」规模过大（最多 20000 行、120 列）`);
      totalCells += rowCount * columnCount;
      if (totalCells > 800000) throw new Error('工作簿单元格规模超过 80 万，请拆分文件后重新上传');
    }
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
    const headerIndex = aoa.findIndex((line) => line.some((x) => cellText(x) === '项目类型') && line.some((x) => cellText(x) === '项目名称'));
    if (headerIndex < 0) {
      if (!['Sheet2', 'Sheet3'].includes(sheetName)) issues.push({ sheet: sheetName, row: 0, issue: '未识别到“项目类型/项目名称”表头，已跳过该工作表' });
      continue;
    }
    const sheetRows = [];
    const subHeaderLine = aoa[headerIndex + 1] || [];
    const groupHeaderLine = headerIndex > 0 ? (aoa[headerIndex - 1] || []) : [];
    const { map: columnMap, missing } = buildTransitionHeaderMap(aoa[headerIndex] || [], subHeaderLine, groupHeaderLine);
    if (missing.length) {
      issues.push({ sheet: sheetName, row: headerIndex + 1, issue: `表头缺少必要字段：${missing.join('、')}；该工作表已拒绝导入` });
      continue;
    }
    const nextLineIsData = ['projectType', 'name'].every((code) => {
      const col = columnMap.get(code);
      return col != null && cellText(subHeaderLine[col]);
    });
    const dataStart = headerIndex + (nextLineIsData ? 1 : 2);
    for (let i = dataStart; i < aoa.length; i += 1) {
      const cells = aoa[i] || [];
      if (!isTransitionDataRow(cells, columnMap)) continue;
      sheetRows.push(transitionRowFromCells(cells, i + 1, sourceFile, sheetName, userName, columnMap));
    }
    parsedSheets.push({ sheetName, rows: sheetRows });
  }
  const selectedSheets = selectPrimaryImportSheet(parsedSheets, wb.SheetNames);
  const selectedNames = new Set(selectedSheets.map((sheet) => sheet.sheetName));
  return {
    rows: selectedSheets.flatMap((sheet) => sheet.rows),
    issues: issues.filter((issue) => !selectedNames.size || selectedNames.has(issue.sheet)),
  };
}

function mergeTransitionRows(existingRows, incomingRows, userName, mode = 'merge') {
  const rows = mode === 'replace' ? [] : existingRows.map((x) => normalizeTransitionRow(x));
  const index = new Map();
  rows.forEach((row, i) => {
    const key = transitionIdentity(row);
    if (key) index.set(key, i);
  });
  const batch = new Set();
  const errors = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const incoming of incomingRows) {
    const key = transitionIdentity(incoming);
    if (!key) {
      skipped += 1;
      errors.push({ row: incoming.sourceRow || '', name: incoming.name || '', issue: '缺少序号或项目名称，无法合并' });
      continue;
    }
    if (batch.has(key)) {
      skipped += 1;
      errors.push({ row: incoming.sourceRow || '', name: incoming.name || incoming.serial || '', issue: '同一批次内重复，保留首次记录' });
      continue;
    }
    batch.add(key);
    const next = normalizeTransitionRow({ ...incoming, updatedBy: userName, updatedAt: TODAY() });
    if (index.has(key)) {
      const idx = index.get(key);
      rows[idx] = { ...rows[idx], ...next, id: rows[idx].id };
      updated += 1;
    } else {
      rows.push(next);
      index.set(key, rows.length - 1);
      added += 1;
    }
  }
  return {
    rows,
    report: {
      imported: incomingRows.length,
      added,
      updated,
      skipped,
      errors,
      subtables: transitionSubtables(rows),
    },
  };
}

function exportTransitionValue(row, field) {
  return exportTransitionFieldValue(row, field, normalizeTransitionRow) ?? '';
}

function makeTransitionSheet(rows, title) {
  const fields = ledgerTransitionFields();
  const { top, mid, leaf, merges } = buildTransitionHeaderMatrix(fields);
  const body = rows.map((row) => fields.map((f) => exportTransitionValue(row, f)));
  const ws = XLSX.utils.aoa_to_sheet([[title], top, mid, leaf, ...body]);
  ws['!cols'] = fields.map((f) => ({ wch: f.width || 14 }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, fields.length - 1) } },
    ...merges,
  ];
  ws['!autofilter'] = { ref: `A4:${colName(fields.length - 1)}${Math.max(5, rows.length + 4)}` };
  return ws;
}

function safeSheetName(name) {
  const text = cellText(name).replace(/[\[\]\*\?\/\\:]/g, '').slice(0, 28) || '未分类';
  return text || '未分类';
}

function uniqueSheetName(name, used) {
  const base = safeSheetName(name).slice(0, 31) || '未分类';
  let next = base;
  let i = 1;
  while (used.has(next)) {
    const suffix = `-${i}`;
    next = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  used.add(next);
  return next;
}

/** V19 二次反馈：表单维护 */
r.get('/transition-tool', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权访问表单维护' });
  const allRows = getTransitionRows();
  const rows = filterTransitionRowsForUser(user, allRows);
  const enriched = rows.map((x) => ({ ...x, validation: validateTransitionRow(x) }));
  const invalid = enriched.filter((x) => !x.validation.ok).length;
  const access = formAccessMeta(user);
  res.json({
    fields: ledgerTransitionFields(),
    cascade: cascadePayload(),
    rows: enriched,
    subtables: transitionSubtables(rows),
    access,
    summary: {
      total: rows.length,
      valid: rows.length - invalid,
      invalid,
      duplicates: transitionDuplicates(rows),
      lastUpdated: rows.map((x) => x.updatedAt).sort().pop() || null,
      totalBudget: Math.round(rows.reduce((s, x) => s + (cellNumber(x.totalBudget) || 0), 0) * 100) / 100,
      centralGrant: Math.round(rows.reduce((s, x) => s + (cellNumber(x.centralGrant) || 0), 0) * 100) / 100,
      selfFund: Math.round(rows.reduce((s, x) => s + (cellNumber(x.selfFund) || 0), 0) * 100) / 100,
    },
    pending: ['分表模板锁定和下拉选项最终口径', '内网机 IP/端口/安装权限', '安全审查、病毒查杀和备份策略'],
  });
});

r.post('/transition-tool/records', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权维护表单，请联系系统管理员在成员管理中授权' });
  const rows = getTransitionRows();
  const row = normalizeTransitionRow(req.body || {});
  const id = row.id || `TR-${String(rows.length + 1).padStart(3, '0')}`;
  let next = normalizeTransitionRow({ ...row, id, updatedBy: user.name, updatedAt: TODAY() });
  if (next.projectType && !next.orgOffice) {
    const path = liveResolveOffice(next.projectType);
    if (path) next = normalizeTransitionRow({ ...next, level: next.level || path.level, sourceChannel: next.sourceChannel || path.source, orgOffice: path.office });
  }
  if (next.level && next.sourceChannel && next.projectType) {
    const hit = liveFindPath({
      level: next.level,
      sourceChannel: next.sourceChannel,
      orgOffice: next.orgOffice,
      projectType: next.projectType,
    });
    if (!hit) return res.status(400).json({ error: '层级/渠道/司局/项目类型组合不在合法路径表内' });
  }
  const idx = rows.findIndex((x) => x.id === id);
  if (idx >= 0 && !assertRowInScope(user, rows[idx])) return res.status(403).json({ error: '无权修改该条台账' });
  if (!assertRowInScope(user, next)) return res.status(403).json({ error: '保存后的数据超出您的表单维护范围' });
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  setTransitionRows(rows);
  audit(user.name, '表单维护', '分表维护', `保存 ${next.projectType || '专项分表'}：${next.name || next.code}${next.orgOffice ? `（司局/处室 ${next.orgOffice}）` : ''}`);
  res.json({ ok: true, row: { ...next, validation: validateTransitionRow(next) } });
});

r.post('/transition-tool/import-demo', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  return res.status(403).json({ error: '正式环境已关闭演示数据导入' });
  const rows = defaultTransitionRows();
  setTransitionRows(rows);
  audit(user.name, '表单维护', '批量导入', `按样例表字段口径导入演示数据 ${rows.length} 行`);
  res.json({ ok: true, imported: rows.length });
});

r.post('/transition-tool/import-upload', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权上传表单，请联系系统管理员在成员管理中授权' });
  const uploadId = req.body?.uploadId;
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  if (mode === 'replace' && !canReplaceAllTransition(user)) {
    return res.status(403).json({ error: '仅系统管理员或「总部（全部台账）」权限可覆盖导入总表，请改用上传分表（合并）' });
  }
  const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
  if (!up) return res.status(404).json({ error: '上传文件不存在，请重新上传' });
  const ext = extname(up.orig_name).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) return res.status(400).json({ error: '仅支持上传 .xlsx / .xls 表格文件' });
  const storedPath = join(UPLOAD_DIR, up.stored_name);
  if (!existsSync(storedPath)) return res.status(410).json({ error: '上传文件已被清理，请重新上传' });
  const parsed = parseTransitionWorkbook(storedPath, up.orig_name, user.name);
  const incoming = (parsed.rows || []).filter((row) => assertRowInScope(user, row));
  if (!incoming.length) return res.status(400).json({ error: parsed.issues[0]?.issue || '未解析到您权限范围内的有效项目记录' });
  const merged = mergeTransitionRows(getTransitionRows(), incoming, user.name, mode);
  setTransitionRows(merged.rows);
  audit(user.name, '表单维护', mode === 'replace' ? '重新导入总表' : '批量上传分表', `${up.orig_name}：解析 ${parsed.rows.length} 行，范围内 ${incoming.length} 行，新增 ${merged.report.added} 行，更新 ${merged.report.updated} 行，跳过 ${merged.report.skipped} 行`);
  res.json({ ok: true, file: up.orig_name, mode, issues: parsed.issues, scoped: incoming.length, ...merged.report });
});

r.post('/transition-tool/records/delete', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权删除表单记录' });
  const id = String(req.body?.id || '').trim();
  const rows = getTransitionRows();
  const hit = rows.find((x) => x.id === id);
  if (!hit) return res.status(404).json({ error: '记录不存在' });
  if (!assertRowInScope(user, hit)) return res.status(403).json({ error: '无权删除该条台账' });
  setTransitionRows(rows.filter((x) => x.id !== id));
  audit(user.name, '表单维护', '删除', hit.name || hit.serial || id);
  res.json({ ok: true, deleted: 1 });
});

r.post('/transition-tool/records/delete-bulk', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权删除表单记录' });
  if (req.body?.all) {
    if (!canReplaceAllTransition(user)) return res.status(403).json({ error: '仅系统管理员或总部全部台账权限可清空全部项目' });
    const n = getTransitionRows().length;
    setTransitionRows([]);
    audit(user.name, '表单维护', '清空', `清空 ${n} 条`);
    return res.json({ ok: true, deleted: n });
  }
  const ids = new Set((req.body?.ids || []).map((x) => String(x)));
  const rows = getTransitionRows();
  const keep = [];
  let deleted = 0;
  for (const row of rows) {
    if (ids.has(String(row.id)) && assertRowInScope(user, row)) {
      deleted += 1;
      continue;
    }
    keep.push(row);
  }
  setTransitionRows(keep);
  audit(user.name, '表单维护', '批量删除', `删除 ${deleted} 条`);
  res.json({ ok: true, deleted });
});

r.get('/transition-tool/export.xlsx', async (req, res, next) => {
  try {
    const user = req.user || requireUser(req, res);
    if (!user) return;
    if (!canAccessFormTool(user)) return res.status(403).json({ error: '无权导出表单维护数据' });
    const rows = filterTransitionRowsForUser(user, getTransitionRows());
    const buf = await makeTransitionTemplateWorkbook(rows);
    const filename = `预研项目总表.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="yuyan-zongbiao.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// ---------- 项目业务动作：基本信息补充 / 立项备案 / 验收 / 评估检查 ----------
function newApproval({ type, title, project, initiator, stepTitles, payload = {} }) {
  const steps = approvalSteps(project, initiator, stepTitles);
  assertApprovalAssignments(steps);
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(type, title, project.id, initiator, project.lead_unit_id, TODAY(), '审批中', Math.min(1, steps.length - 1), JSON.stringify(steps), JSON.stringify(payload));
}

/** 项目基本信息补充填报（审批通过后回写台账） */
r.post('/projects/:id/baseinfo', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'baseinfo_edit', '完善基本信息须由本项目负责人或项目主管发起')) return;
  const fields = req.body?.fields || req.body || {};
  const team = fields.team || J(p.team_json, {});
  // 基本信息建档只硬性校验本流程实际需要的技术/管理责任人。财务责任人由预算、
  // 核销流程在进入对应节点时校验，避免尚未配置总部财务账号时卡死项目建档。
  // V19：实施·基本信息硬性齐套岗位；总部处室/财务可暂空，有值须绑定有效账号
  if (!String(team.contact || '').trim()) team.contact = user.name;
  const requiredPeople = [['contact','项目联系人'],['owner','项目负责人'],['tech','技术负责人'],['pm','项目主管'],['chief1','一级总师'],['chief2','二级总师'],['unitDeptHead','单位科技部长']];
  const optionalPeople = [['hqHead','总部处室处长'],['hqStaff','总部处室主管'],['unitStaff','单位科技主管'],['finHq','总部财务主管'],['finHead','单位财务部长'],['finStaff','单位财务主管']];
  const missing = requiredPeople.filter(([k]) => !String(team[k] || '').trim()).map(([, label]) => label);
  if (missing.length) return res.status(400).json({ error: `实施阶段基本信息未齐套：${missing.join('、')}` });
  for (const [key, label] of requiredPeople) if (!userByName(team[key])) return res.status(400).json({ error: `${label}「${team[key]}」未关联有效在岗账号及工号` });
  for (const [key, label] of optionalPeople) {
    if (team[key] && !userByName(team[key])) return res.status(400).json({ error: `${label}「${team[key]}」未关联有效在岗账号及工号；可暂留空` });
  }
  const writtenTeam = writeProjectMembers(p.id, team, user.name);
  try {
    newApproval({
      type: 'baseinfo', title: `「${p.name}」项目基本信息补充建档`, project: { ...p, team_json: JSON.stringify(writtenTeam) }, initiator: user.name,
      stepTitles: ['项目团队填写', '项目负责人审核', '单位科技管理部审核', '单位分管领导复核', '总部科研项目处'],
      payload: { fields: { ...fields, team: writtenTeam } },
    });
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  audit(user.name, '基本信息填报', p.name, '按 V19 实施阶段补全团队等字段，提交单位内部审签');
  res.json({ ok: true });
});

/** V19 阶段字段元数据（申报 / 实施补全 / 系统生成） */
r.get('/meta/stage-fields', (_req, res) => {
  let majors = { major1: [], major2ByMajor1: {} };
  try { majors = majorPayload(); } catch (_) {}
  res.json({
    stages: [
      { id: 'declaration', name: '立项·申报', filler: '项目联系人', note: '级别/渠道、名称、目标、周期、总经费、专业、牵头分工、联系人·负责人·技术负责人及渠道材料' },
      { id: 'baseinfo', name: '实施·基本信息', filler: '项目团队', note: '补全主管/总师/管理财务等；审过回写台账' },
      { id: 'system', name: '系统生成', filler: '系统', note: '项目编号、预警、成果转化状态' },
    ],
    fields: STAGE_FIELD_META,
    major1: majors.major1 || [],
    major2ByMajor1: majors.major2ByMajor1 || {},
  });
});

/** 可选人员名录（基本信息岗位绑定用） */
r.get('/meta/people', (req, res) => {
  const user = currentUser(req);
  res.json({ me: user?.name, people: rosterPeople() });
});

/** 单项目填表齐套检查 */
r.get('/projects/:id/field-checklist', (req, res) => {
  currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const ep = enrichProject(p, TODAY());
  const team = ep.team || {};
  const declMiss = [];
  if (!ep.name) declMiss.push('项目名称');
  if (!String(ep.goal || '').trim()) declMiss.push('项目目标');
  if (!ep.start || !ep.end) declMiss.push('项目周期');
  if (!(Number(ep.total_budget) > 0)) declMiss.push('总经费');
  if (!team.contact) declMiss.push('项目联系人');
  if (!team.owner) declMiss.push('项目负责人');
  if (!team.tech) declMiss.push('技术负责人');
  const baseMiss = [];
  for (const [k, lab] of [['pm','项目主管'],['chief1','一级总师'],['chief2','二级总师'],['unitDeptHead','单位科技部长']]) {
    if (!team[k]) baseMiss.push(lab);
  }
  res.json({
    projectId: p.id, status: p.status,
    declaration: { complete: declMiss.length === 0, missing: declMiss },
    baseinfo: { complete: baseMiss.length === 0, missing: baseMiss },
    system: { code: ep.code, warning: ep.color, transform: ep.transform_status || ep.v19?.transformSummary },
  });
});

/** 立项备案（上传盖章版立项佐证，提交总部归档；通过后项目转实施中） */
r.post('/projects/:id/filing', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT p.*, c.filing_json, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id WHERE p.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (p.status !== '立项中') return res.status(400).json({ error: '仅「立项中」项目可提交立项备案' });
  if (!requireProjectPerm(user, res, p, 'filing_upload', '立项备案须由本项目联系人发起')) return;
  const materials = req.body?.materials || J(p.filing_json, []);
  const materialUploads = req.body?.materialUploads || [];
  let linkedMats = [];
  try {
    linkedMats = archiveMaterialUploads({
      pid: p.id, phase: '立项', requiredNames: materials, materialUploads, userName: user.name,
    });
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  newApproval({
    type: 'filing', title: `「${p.name}」立项备案`, project: p, initiator: user.name,
    stepTitles: ['项目团队上传立项材料', '单位科技管理部审核', '总部科研项目处备案'],
    payload: { materials, materialUploads: linkedMats },
  });
  audit(user.name, '立项备案', p.name, `上传 ${linkedMats.length} 项立项佐证真文件，提交总部备案归档`);
  res.json({ ok: true });
});


/** 验收前置强校验：里程碑闭环 / 交付物已交付 / 经费核销 */
function acceptPrecheck(pid) {
  const openMs = db.prepare('SELECT title FROM milestones WHERE project_id=? AND done_at IS NULL').all(pid);
  const openDel = db.prepare('SELECT name FROM deliverables WHERE project_id=? AND delivered_at IS NULL').all(pid);
  const funds = db.prepare('SELECT * FROM funds WHERE project_id=?').all(pid);
  const unsettled = funds.filter((f) => f.spent > J(f.writeoffs_json, []).reduce((s, w) => s + Number(w.amount || 0), 0));
  const failedAssessments = db.prepare("SELECT title FROM approvals WHERE project_id=? AND type='assessment' AND status IN ('审批中','已驳回') AND json_extract(payload_json,'$.result')='不合格'").all(pid);
  return {
    ok: openMs.length === 0 && openDel.length === 0 && unsettled.length === 0 && failedAssessments.length === 0,
    checks: [
      { label: '全部里程碑闭环销项', pass: openMs.length === 0, detail: openMs.length ? `${openMs.length} 个节点未闭环：${openMs.map((m) => m.title).slice(0, 3).join('、')}${openMs.length > 3 ? '…' : ''}` : '已全部闭环' },
      { label: '核心交付物全部交付', pass: openDel.length === 0, detail: openDel.length ? `${openDel.length} 项未交付：${openDel.map((d) => d.name).slice(0, 3).join('、')}${openDel.length > 3 ? '…' : ''}` : '已全部交付' },
      { label: '节点经费匹配核销完毕', pass: unsettled.length === 0, detail: unsettled.length ? `${unsettled.map((f) => f.year).join('、')} 年度支出未上传付款凭证核销` : '历年支出均有核销凭证' },
      { label: '不合格评估整改已闭环', pass: failedAssessments.length === 0, detail: failedAssessments.length ? `${failedAssessments.length} 项不合格评估尚未完成整改销项` : '无未闭环整改' },
    ],
  };
}
r.get('/projects/:id/accept-precheck', (req, res) => res.json(acceptPrecheck(Number(req.params.id))));

r.post('/projects/:id/accept-request', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!['实施中', '验收中'].includes(p.status)) return res.status(400).json({ error: '当前状态不可发起验收' });
  if (!requireProjectPerm(user, res, p, 'accept_apply', '验收申请须由本项目负责人发起')) return;
  const pre = acceptPrecheck(p.id);
  if (!pre.ok) return res.status(400).json({ error: '前置条件未满足，无法提交验收申请', checks: pre.checks });
  const stepTitles = ['项目团队提交验收申请', '二级单位管理团队初审'];
  if (p.level === '国家级') stepTitles.push('责任总师技术复核');
  stepTitles.push('总部管理团队终审');
  const tiers = req.body?.tiers || [];
  const materialUploads = req.body?.materialUploads || [];
  const requiredTiers = p.level === '国家级' ? ['单位级验收材料','公司级验收材料','国家级验收材料'] : p.level === '地方级' ? ['单位级验收材料','属地主管部门验收材料'] : ['单位级验收材料','公司级验收材料'];
  const byName = new Set(materialUploads.map((x) => x?.name || x?.key));
  const missingTiers = requiredTiers.filter((x) => !byName.has(x));
  if (missingTiers.length) return res.status(400).json({ error: `尚缺验收材料：${missingTiers.join('、')}` });
  let linkedMats = [];
  try {
    linkedMats = archiveMaterialUploads({ pid: p.id, phase: '验收', requiredNames: requiredTiers, materialUploads: materialUploads.map((x) => ({ name: x.name || x.key, uploadId: x.uploadId })), userName: user.name });
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  newApproval({
    type: 'acceptance', title: `「${p.name}」${p.level === '公司级' ? '公司级' : p.level === '地方级' ? '属地' : '国家级'}验收申请`, project: p, initiator: user.name,
    stepTitles, payload: { level: p.level, tiers, materialUploads: linkedMats },
  });
  db.prepare("UPDATE projects SET status='验收中' WHERE id=?").run(p.id);
  audit(user.name, '发起验收', p.name, linkedMats.length
    ? `前置校验通过，归档验收材料 ${linkedMats.length} 份，进入${p.level}分级验收流程`
    : `前置校验通过，进入${p.level}分级验收流程`);
  res.json({ ok: true });
});


/** 评估检查：按渠道类型发起线上申请，结论材料归档 */
r.post('/projects/:id/assessments', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT p.*, c.assess_json, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id WHERE p.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'assess_submit', '评估检查须由本项目负责人发起')) return;
  const types = J(p.assess_json, []);
  const { atype, stage = '申请', result = '', note = '', uploadId } = req.body || {};
  if (!types.includes(atype)) return res.status(400).json({ error: '评估检查类型必须来自该渠道配置' });
  if (!['申请', '结论', '整改'].includes(stage)) return res.status(400).json({ error: '无效的评估阶段' });
  if (!uploadId) return res.status(400).json({ error: '必须上传真实评估/检查材料' });
  let linked;
  try {
    linked = archiveMaterialUploads({ pid: p.id, phase: '实施', requiredNames: [`${atype}${stage}材料`], materialUploads: [{ name: `${atype}${stage}材料`, uploadId }], userName: user.name });
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  let stepTitles = stage === '结论'
    ? ['项目团队上传正式结论', '二级单位主管部门确认', '总部管理部门备案']
    : stage === '整改'
      ? ['项目团队提交整改闭环', '二级单位主管部门复核', '总部管理部门销项']
      : ['项目团队填报评估材料', '二级单位主管部门初审', '总部管理部门终审'];
  const channelKey = db.prepare('SELECT key FROM channels WHERE id=?').get(p.channel_id)?.key;
  if (channelKey === 'KJZ') return res.status(400).json({ error: '科技周渠道按V19不设置评估检查流程' });
  if (['CLLM','BOEING'].includes(channelKey)) stepTitles = stage === '整改' ? ['项目团队提交整改闭环', '二级单位审查确认'] : ['项目团队填报评估材料', '二级单位主管部门初审', '二级单位审查确认'];
  if (String(channelKey).startsWith('DFY_') && !req.body?.majorProject) return res.status(400).json({ error: '大飞机研究院仅重大项目适用中期检查，请勾选重大项目并上传认定依据' });
  newApproval({
    type: 'assessment', title: `「${p.name}」${atype}${stage}`, project: p, initiator: user.name,
    stepTitles,
    payload: { atype, stage, result, note, materialUploads: linked },
  });
  if (stage === '结论' && result === '不合格') {
    const due = addDays(TODAY(), 30);
    db.prepare('INSERT INTO alerts (project_id,kind,level,title,due,created_at,channels,recipients,read) VALUES (?,?,?,?,?,?,?,?,0)')
      .run(p.id, '评估整改', 'yellow', `【整改预警】${p.name}：${atype}结论不合格，须提交整改闭环`, due, TODAY(), '站内,邮箱,蓝信', '项目团队、对应管理团队');
  }
  audit(user.name, '评估检查申请', p.name, `${p.cname} · ${atype} · ${stage}${result ? ` · ${result}` : ''}`);
  res.json({ ok: true });
});

// ---------- 科研外协合同 ----------
r.get('/projects/:id/contracts', (req, res) => {
  const user = currentUser(req); const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' }); if (!canAccessProject(user, p)) return res.status(403).json({ error: '无权查看该项目合同' });
  res.json(db.prepare('SELECT * FROM external_contracts WHERE project_id=? ORDER BY id DESC').all(p.id).map((x) => ({ ...x, paymentNodes: J(x.payment_nodes_json, []), invoices: J(x.invoice_json, []) })));
});

r.post('/projects/:id/contracts', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'contract_register', '外协合同须由本项目主管登记')) return;
  const { contractNo, supplierName, amount, startDate, endDate, paymentNodes = [], uploadId } = req.body || {};
  if (!contractNo || !supplierName || !uploadId) return res.status(400).json({ error: '合同编号、外协单位和真实合同文件均为必填项' });
  let linked; try { linked = archiveMaterialUploads({ pid: p.id, phase: '实施', requiredNames: ['科研外协合同'], materialUploads: [{ name: '科研外协合同', uploadId }], userName: user.name }); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  let c = db.prepare("SELECT * FROM collaborators WHERE project_id=? AND name=? AND ctype='外协'").get(p.id, supplierName);
  if (!c) { const x = db.prepare("INSERT INTO collaborators (project_id,name,ctype,blacklisted) VALUES (?,?,'外协',0)").run(p.id, supplierName); c = { id: x.lastInsertRowid }; }
  try { db.prepare('INSERT INTO external_contracts (project_id,collaborator_id,contract_no,supplier_name,amount,start_date,end_date,status,payment_nodes_json,created_at,created_by) VALUES (?,?,?,?,?,?,?,\'履行中\',?,?,?)').run(p.id, c.id, contractNo, supplierName, Number(amount || 0), startDate || null, endDate || null, JSON.stringify(paymentNodes), TODAY(), user.name); }
  catch { return res.status(409).json({ error: '合同编号已存在，禁止重复登记' }); }
  audit(user.name, '外协合同入库', p.name, `${contractNo} / ${supplierName} / ${linked[0]?.file}`); res.json({ ok: true });
});

r.post('/contracts/:id/accept', (req, res) => {
  const user = currentUser(req);
  const c = db.prepare('SELECT c.*,p.name pname,p.lead_unit_id,p.team_json FROM external_contracts c JOIN projects p ON p.id=c.project_id WHERE c.id=?').get(req.params.id); if (!c) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, c, 'contract_register', '外协合同验收须由本项目主管登记')) return;
  const uploadId = Number(req.body?.uploadId); if (!uploadId) return res.status(400).json({ error: '必须上传合同验收结论' });
  try { archiveMaterialUploads({ pid: c.project_id, phase: '验收', requiredNames: ['外协合同验收结论'], materialUploads: [{ name: '外协合同验收结论', uploadId }], userName: user.name }); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  db.prepare("UPDATE external_contracts SET acceptance_date=?,status='已验收' WHERE id=?").run(TODAY(), c.id);
  audit(user.name, '外协合同验收', c.pname, `${c.contract_no}，协作评价30日倒计时启动`); res.json({ ok: true, evaluationDeadline: addDays(TODAY(), 30) });
});

/** 申报审签结束后的立项/不立项正式决策。 */
r.post('/projects/:id/decision', (req, res) => {
  const user = currentUser(req);
  if (!requireRoles(user, res, ['admin'], '仅超级管理员可依据正式文件登记立项决策')) return;
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (p.status !== '待立项确认') return res.status(400).json({ error: '仅申报审签通过、待确认项目可登记决策' });
  const { decision, reason = '', uploadId } = req.body || {};
  if (!['已立项', '不立项'].includes(decision)) return res.status(400).json({ error: '决策必须为已立项或不立项' });
  if (!uploadId) return res.status(400).json({ error: '必须上传正式立项/不立项决策文件' });
  let linked;
  try { linked = archiveMaterialUploads({ pid: p.id, phase: '立项', requiredNames: ['立项决策文件'], materialUploads: [{ name: '立项决策文件', uploadId }], userName: user.name }); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  db.transaction(() => {
    db.prepare('INSERT INTO project_decisions (project_id,decision,reason,decided_at,decided_by,upload_id) VALUES (?,?,?,?,?,?)').run(p.id, decision, reason, TODAY(), user.name, Number(uploadId));
    db.prepare('UPDATE projects SET status=? WHERE id=?').run(decision === '已立项' ? '立项中' : '不立项', p.id);
  })();
  audit(user.name, '立项决策', p.name, `${decision}；${reason || '正式决策文件已归档'}；${linked[0]?.file || ''}`);
  res.json({ ok: true, status: decision === '已立项' ? '立项中' : '不立项' });
});
const ri1200 = () => 800 + Math.floor(Math.random() * 4000);

/** 年度目标和里程碑计划：团队提交，审批通过后才写入项目台账。 */
r.post('/projects/:id/milestone-plan', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'milestone_plan', '里程碑计划须由本项目技术负责人编制')) return;
  const year = Number(req.body?.year);
  const yearGoal = String(req.body?.yearGoal || '').trim();
  const milestones = Array.isArray(req.body?.milestones) ? req.body.milestones.map((m) => ({ title: String(m?.title || '').trim(), due: String(m?.due || '') })).filter((m) => m.title && /^\d{4}-\d{2}-\d{2}$/.test(m.due)) : [];
  if (!year || !yearGoal || !milestones.length) return res.status(400).json({ error: '年度、年度目标和至少一个有效里程碑均为必填项' });
  if (milestones.some((m) => Number(m.due.slice(0, 4)) !== year)) return res.status(400).json({ error: '里程碑日期必须属于所填年度' });
  if (p.start && milestones.some((m) => m.due < p.start) || p.end && milestones.some((m) => m.due > p.end)) return res.status(400).json({ error: '里程碑日期必须位于项目周期内' });
  const duplicate = db.prepare("SELECT id FROM approvals WHERE type='milestone_plan' AND project_id=? AND status='审批中'").get(p.id);
  if (duplicate) return res.status(409).json({ error: '该项目已有在途年度里程碑计划' });
  newApproval({
    type: 'milestone_plan', title: `「${p.name}」${year}年度目标及里程碑计划`, project: p, initiator: user.name,
    stepTitles: ['项目团队编制年度计划', '项目负责人审核', '单位科技管理部审批'],
    payload: { year, yearGoal, milestones },
  });
  audit(user.name, '年度里程碑计划提交', p.name, `${year}年度，共 ${milestones.length} 个节点`);
  res.json({ ok: true, pendingApproval: true });
});

/** 成果转化：新建成果包（仅「已交付」交付物可纳入，强校验） */
r.post('/projects/:id/packages', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { name, deliverableIds, mode, form, planDate, brief, detail = '', uploadId } = req.body || {};
  if (!name || !Array.isArray(deliverableIds) || deliverableIds.length === 0) return res.status(400).json({ error: '请填写成果包名称并选择交付物' });
  if (String(brief).length > 100) return res.status(400).json({ error: '成果简介不得超过100字' });
  const forms = mode === '向型号转化' ? ['装机','未装机'] : mode === '向市场转化' ? ['转让','许可','联合实施','作价投资','其他'] : [];
  if (!forms.includes(form)) return res.status(400).json({ error: '转化方式与转化形式不匹配' });
  if (!uploadId) return res.status(400).json({ error: '必须上传成果转化佐证材料' });
  if (mode === '向型号转化' && !/应用对象|应用单位|转化任务/.test(detail)) return res.status(400).json({ error: '向型号转化简介须包含转化任务、应用对象和应用单位' });
  if (mode === '向市场转化' && !/交易对象|合同金额|净收益/.test(detail)) return res.status(400).json({ error: '向市场转化简介须包含交易对象、合同金额和净收益' });
  const rows = deliverableIds.map((id) => db.prepare('SELECT * FROM deliverables WHERE id=? AND project_id=?').get(id, p.id)).filter(Boolean);
  const undelivered = rows.filter((dRow) => !dRow.delivered_at);
  if (undelivered.length) return res.status(400).json({ error: `仅「已交付」交付物可纳入成果包：${undelivered.map((x) => x.name).join('、')} 未交付` });
  const n = db.prepare('SELECT COUNT(*) n FROM packages').get().n;
  const code = `CG-${TODAY().slice(0, 4)}-${String(n + 1).padStart(3, '0')}`;
  try { archiveMaterialUploads({ pid: p.id, phase: '成果转化', requiredNames: ['成果转化佐证'], materialUploads: [{ name: '成果转化佐证', uploadId }], userName: user.name }); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const info = db.prepare('INSERT INTO packages (code,name,project_id,mode,form,plan_date,actual_date,status,brief,detail,unit_id) VALUES (?,?,?,?,?,?,NULL,?,?,?,?)')
    .run(code, name, p.id, mode, form, planDate || addDays(TODAY(), 180), '待审批', brief || '', detail, p.lead_unit_id);
  for (const id of deliverableIds) db.prepare('UPDATE deliverables SET package_id=? WHERE id=?').run(info.lastInsertRowid, id);
  newApproval({
    type: 'package', title: `「${name}」转化备案`, project: p, initiator: user.name,
    stepTitles: ['项目团队填报转化信息', '二级单位管理团队审核', '总部管理团队备案'],
    payload: { package: code },
  });
  audit(user.name, '新建成果包', name, `${code} 绑定 ${deliverableIds.length} 项已交付交付物，提交转化备案`);
  res.json({ ok: true, code });
});

// ---------- 里程碑 / 计划 ----------
r.post('/milestones/:id/complete', (req, res) => {
  const user = currentUser(req);
  const m = db.prepare('SELECT m.*, p.id AS project_pk, p.name pname, p.lead_unit_id, p.team_json FROM milestones m JOIN projects p ON p.id=m.project_id WHERE m.id=?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, m, 'milestone_close', '里程碑销项须由本项目技术负责人发起')) return;
  if (m.done_at) return res.status(409).json({ error: '该里程碑已完成销项' });
  const uploadId = Number(req.body?.uploadId);
  if (!uploadId) return res.status(400).json({ error: '必须上传真实完成佐证材料' });
  let linked;
  try { linked = archiveMaterialUploads({ pid: m.project_id, phase: '实施', requiredNames: ['里程碑完成佐证'], materialUploads: [{ name: '里程碑完成佐证', uploadId }], userName: user.name }); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  try {
    newApproval({ type: 'milestone_close', title: `「${m.pname}」里程碑销项材料核验（${m.title}）`, project: { ...m, id: m.project_pk }, initiator: user.name, stepTitles: ['项目团队提交里程碑佐证', '单位科技部门核验'], payload: { milestone: m.title, milestoneId: m.id, evidenceFile: linked[0]?.file, uploadId } });
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  audit(user.name, '里程碑销项申请', m.pname, `「${m.title}」真实佐证已归档，待单位科技部门核验`);
  res.json({ ok: true, pendingApproval: true });
});

r.post('/packages/:id/progress', (req, res) => {
  const user = currentUser(req); const k = db.prepare('SELECT k.*,p.name pname,p.team_json,p.lead_unit_id FROM packages k JOIN projects p ON p.id=k.project_id WHERE k.id=?').get(req.params.id);
  if (!k) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, k, 'transform_update', '成果转化进展须由本项目联系人或负责人更新')) return;
  const { status, actualDate, detail, uploadId } = req.body || {}; if (!['未启动','洽谈中','已签协议','已完成'].includes(status)) return res.status(400).json({ error: '无效转化状态' });
  if (status === '已完成' && (!actualDate || !uploadId)) return res.status(400).json({ error: '完成转化必须填写实际时间并上传成效佐证' });
  if (uploadId) try { archiveMaterialUploads({ pid: k.project_id, phase: '成果转化', requiredNames: ['转化进展佐证'], materialUploads: [{ name: '转化进展佐证', uploadId }], userName: user.name }); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  db.prepare('UPDATE packages SET status=?,actual_date=?,detail=? WHERE id=?').run(status, actualDate || k.actual_date, detail || k.detail, k.id); audit(user.name, '成果转化进展', k.pname, `${k.code} → ${status}`); res.json({ ok: true });
});

// ---------- 交付物正式维护与审核 ----------
r.post('/projects/:id/deliverables', (req, res) => {
  const user = currentUser(req); const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id); if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'deliverable_manage', '交付物须由本项目技术负责人维护')) return;
  const { name, type, due, owners = [] } = req.body || {}; if (!name || !DELIV_TYPES.includes(type) || !due || !owners.length) return res.status(400).json({ error: '名称、有效类型、到期时间和至少一个权属均为必填项' });
  const x = db.prepare('INSERT INTO deliverables (project_id,name,type,due,owner) VALUES (?,?,?,?,?)').run(p.id, name, type, due, JSON.stringify(owners)); audit(user.name, '交付物新增', p.name, `${name}/${type}`); res.json({ ok: true, id: x.lastInsertRowid });
});

r.post('/deliverables/:id/deliver', (req, res) => {
  const user = currentUser(req); const d = db.prepare('SELECT d.*,p.id AS project_pk,p.name pname,p.team_json,p.lead_unit_id FROM deliverables d JOIN projects p ON p.id=d.project_id WHERE d.id=?').get(req.params.id); if (!d) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, d, 'deliverable_manage', '交付物交付须由本项目技术负责人发起')) return; const uploadId=Number(req.body?.uploadId); if (!uploadId) return res.status(400).json({ error: '必须上传真实交付物及交付佐证' });
  let linked; try { linked=archiveMaterialUploads({ pid:d.project_id,phase:'验收',requiredNames:['交付物佐证'],materialUploads:[{name:'交付物佐证',uploadId}],userName:user.name }); } catch(e){return res.status(e.status||400).json({error:e.message});}
  try { newApproval({ type:'deliverable',title:`「${d.pname}」交付物审核（${d.name}）`,project:{...d,id:d.project_pk},initiator:user.name,stepTitles:['项目团队提交交付物','二级单位管理团队审核','总部管理团队确认'],payload:{deliverableId:d.id,evidenceFile:linked[0]?.file} }); } catch(e){return res.status(e.status||400).json({error:e.message});} res.json({ok:true,pendingApproval:true});
});

r.post('/plans/:id/finish', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT pl.*, pr.name pname, pr.lead_unit_id, pr.team_json FROM plans pl JOIN projects pr ON pr.id=pl.project_id WHERE pl.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'plan_manage', '计划办结须由本项目主管发起')) return;
  db.prepare("UPDATE plans SET status='办结审批中' WHERE id=?").run(p.id);
  const steps = [
    { title: '项目团队提交办结申请', assignee: user.name, status: 'approved', at: TODAY(), comment: '提交办结。' },
    { title: '二级单位管理团队终审', assignee: '', status: 'current', at: null, comment: null },
  ];
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('plan_finish', `「${p.pname}」计划办结申请（${p.title}）`, p.project_id, user.name, p.lead_unit_id, TODAY(), '审批中', 1, JSON.stringify(steps), JSON.stringify({ plan: p.title }));
  audit(user.name, '计划办结申请', p.pname, p.title);
  res.json({ ok: true });
});

// ---------- 变更 ----------
r.post('/changes', (req, res) => {
  const user = currentUser(req);
  const { projectId, kind = '项目变更', category, detail, reason, uploadId, proposed = {} } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  if (!requireProjectPerm(user, res, p, 'change_submit', '项目变更须由本项目负责人发起')) return;
  const allowedKinds = ['项目变更', '数据变更'];
  const allowedCategories = ['延期', '经费', '外协方', '付款节点', '核心指标', '整体周期', '基础信息', '交付物'];
  if (!allowedKinds.includes(kind) || !allowedCategories.includes(category)) return res.status(400).json({ error: '请选择有效的变更类型和类别' });
  if (!String(detail || '').trim() || !String(reason || '').trim()) return res.status(400).json({ error: '变更内容和变更原因均为必填项' });
  if (!proposed || typeof proposed !== 'object' || !Object.keys(proposed).length) return res.status(400).json({ error: '必须提交可执行的新值/新日期及目标记录，审批通过后用于自动回写' });
  if (!uploadId) return res.status(400).json({ error: '必须上传真实变更佐证材料' });
  let linked;
  try {
    linked = archiveMaterialUploads({ pid: p.id, phase: '实施', requiredNames: ['变更佐证材料'], materialUploads: [{ name: '变更佐证材料', uploadId }], userName: user.name });
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  db.prepare('INSERT INTO changes (project_id,kind,category,detail,reason,status,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, kind, category, detail, reason, '审批中', TODAY());
  const type = kind === '数据变更' ? 'data_change' : 'change';
  // 重大变更（外协单位更换/总经费调整/整体周期变更）强制联动法务部门审核
  const isMajor = type === 'change' && ['外协方', '经费', '整体周期'].includes(category);
  const ch = db.prepare('SELECT key FROM channels WHERE id=?').get(p.channel_id);
  let stepTitles = type === 'change'
    ? (isMajor ? ['项目团队填报', '二级单位主管部门初审', '法务部门合规审核', '总部管理部门终审'] : ['项目团队填报', '二级单位主管部门初审', '总部管理部门终审'])
    : ['项目团队填报', '二级单位内部审批', '总部科技主管确认'];
  if (['SHKC'].includes(ch?.key)) stepTitles = ['项目团队填报', '二级单位主管部门终审'];
  if (['CLLM','BOEING'].includes(ch?.key)) stepTitles = ['项目团队填报', '二级单位主管部门初审', '二级单位审查确认'];
  if (ch?.key === 'MJKY' && type === 'change') stepTitles.push('线下上报GXB并归档回执');
  const steps = approvalSteps(p, user.name, stepTitles);
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(type, `「${p.name}」${kind}（${category}）`, p.id, user.name, p.lead_unit_id, TODAY(), '审批中', 1, JSON.stringify(steps), JSON.stringify({ category, target: detail, reason, proposed, materialUploads: linked }));
  audit(user.name, '发起变更', p.name, `${kind}/${category}：${detail}`);
  res.json({ ok: true });
});

// ---------- 财务 ----------
r.get('/finance/:unitId', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const today = TODAY();
  const thisYear = Number(today.slice(0, 4));
  const uid = Number(req.params.unitId);
  if (user.scope !== 'hq' && user.role !== 'admin' && user.unit_id !== uid) {
    return res.status(403).json({ error: '无权查看其他单位经费台账' });
  }
  const unit = db.prepare('SELECT * FROM units WHERE id=?').get(uid);
  const projects = db.prepare('SELECT * FROM projects WHERE lead_unit_id=?').all(uid).map((p) => enrichProject(p, today));
  const rows = projects.map((p) => {
    const funds = db.prepare('SELECT * FROM funds WHERE project_id=? ORDER BY year').all(p.id).map((f) => ({ ...f, writeoffs: J(f.writeoffs_json, []) }));
    return { id: p.id, code: p.code, name: p.name, status: p.status, color: p.color, total: p.total_budget, funds };
  });
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const trend = years.map((y) => {
    const fs = db.prepare('SELECT f.* FROM funds f JOIN projects p ON p.id=f.project_id WHERE p.lead_unit_id=? AND f.year=?').all(uid, y);
    return { year: y, budget: Math.round(fs.reduce((s, f) => s + f.budget, 0)), spent: Math.round(fs.reduce((s, f) => s + f.spent, 0)) };
  });
  const quota = db.prepare('SELECT * FROM funding_quota WHERE year=? AND unit_id=?').get(thisYear, uid);
  res.json({ unit, rows, trend, quota });
});

/** 经费核销录入：追加付款凭证并更新支出，实时同步经费看板 */
r.post('/finance/writeoff', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  if (!requireRoles(user, res, ['finance', 'mgmt', 'admin'], '仅财务或管理角色可核销经费')) return;
  const { projectId, year, amount, note, milestoneId, uploadId } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  if (!canAccessProject(user, p)) return res.status(403).json({ error: '无权操作该项目经费' });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: '请填写有效核销金额' });
  if (!uploadId) return res.status(400).json({ error: '必须上传真实付款凭证后方可核销' });
  const milestone = db.prepare('SELECT * FROM milestones WHERE id=? AND project_id=?').get(Number(milestoneId), p.id);
  if (!milestone || !milestone.done_at) return res.status(400).json({ error: '核销必须绑定已闭环里程碑节点' });
  if (!['实施中', '验收中', '已验收'].includes(p.status)) {
    return res.status(400).json({ error: '申报或立项阶段项目不可办理经费核销' });
  }
  const y = Number(year) || Number(TODAY().slice(0, 4));
  let f = db.prepare('SELECT * FROM funds WHERE project_id=? AND year=?').get(p.id, y);
  if (!f) {
    return res.status(400).json({ error: '该年度预算尚未审批生效，不可核销' });
  }
  if (Number(f.spent) + amt > Number(f.budget)) return res.status(400).json({ error: '核销金额超过该年度剩余预算' });
  let voucherDoc;
  try {
    voucherDoc = archiveMaterialUploads({
      pid: p.id, phase: '经费', requiredNames: ['付款凭证'],
      materialUploads: [{ name: '付款凭证', uploadId }], userName: user.name,
    })[0];
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  const voucher = voucherDoc?.file || `付款凭证-${y}`;
  const wo = [...J(f.writeoffs_json, []), { date: TODAY(), amount: amt, voucher, note: note || '经费核销', milestoneId: milestone.id, milestone: milestone.title, uploadId: voucherDoc?.uploadId }];
  db.prepare('UPDATE funds SET spent=spent+?, writeoffs_json=? WHERE id=?').run(amt, JSON.stringify(wo), f.id);
  audit(user.name, '经费核销', p.name, `${y} 年度核销 ${amt} 万元，绑定里程碑「${milestone.title}」，凭证 ${voucher}`);
  res.json({ ok: true, voucher });
});

/** 年度预算填报（绑定里程碑节点） */
r.post('/finance/budget', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const { projectId, year, budget, milestone, milestoneId, note } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  if (!requireProjectPerm(user, res, p, 'funds_submit', '预算须由本项目财务岗位提报')) return;
  const b = Number(budget);
  if (b == null || b < 0) return res.status(400).json({ error: '请填写有效预算金额' });
  const y = Number(year) || Number(TODAY().slice(0, 4));
  const ms = db.prepare('SELECT * FROM milestones WHERE id=? AND project_id=?').get(Number(milestoneId), p.id);
  if (!ms) return res.status(400).json({ error: '请选择并绑定本项目里程碑节点' });
  const duplicate = db.prepare("SELECT id FROM approvals WHERE type='budget' AND project_id=? AND status='审批中'").get(p.id);
  if (duplicate) return res.status(409).json({ error: '该项目已有在途预算申请' });
  newApproval({
    type: 'budget', title: `「${p.name}」${y}年度预算填报`, project: p, initiator: user.name,
    stepTitles: ['项目团队提报', '二级单位财务部门审核', '总部财务团队复核备案'],
    payload: { year: y, budget: b, milestoneId: ms.id, milestoneTitle: ms.title, note: note || milestone || '' },
  });
  audit(user.name, '预算填报申请', p.name, `${y} 年度预算 ${b} 万元，绑定里程碑：${ms.title}`);
  res.json({ ok: true, pendingApproval: true });
});

r.get('/funding', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const thisYear = Number(TODAY().slice(0, 4));
  let pool = db.prepare('SELECT * FROM funding_pool ORDER BY year DESC').all();
  let quotas = db.prepare('SELECT q.*, u.short FROM funding_quota q JOIN units u ON u.id=q.unit_id WHERE q.year=?').all(thisYear);
  let requests = db.prepare('SELECT r.*, u.short FROM funding_requests r JOIN units u ON u.id=r.unit_id ORDER BY r.created_at DESC').all();
  if (user.scope !== 'hq' && user.role !== 'admin') {
    pool = [];
    quotas = quotas.filter((q) => q.unit_id === user.unit_id);
    requests = requests.filter((r0) => r0.unit_id === user.unit_id);
  }
  res.json({ pool, quotas, requests, year: thisYear });
});

r.post('/funding/requests', (req, res) => {
  const user = currentUser(req);
  const { amount, purpose } = req.body || {};
  if (!requireRoles(user, res, ['mgmt'], '拨付申请由二级单位管理团队发起')) return;
  const thisYear = Number(TODAY().slice(0, 4));
  const amt=Number(amount); if (!amt || amt<=0) return res.status(400).json({error:'请输入有效拨付金额'});
  const q=db.prepare('SELECT * FROM funding_quota WHERE year=? AND unit_id=?').get(thisYear,user.unit_id); if(!q || q.paid+amt>q.quota) return res.status(400).json({error:'申请金额超过本单位年度剩余额度'});
  const info=db.prepare('INSERT INTO funding_requests (year,unit_id,amount,purpose,status,created_at) VALUES (?,?,?,?,?,?)')
    .run(thisYear, user.unit_id || 2, Number(amount) || 0, purpose || '', '待审批', TODAY());
  const synthetic={id:null,lead_unit_id:user.unit_id,team_json:JSON.stringify({hqHead:'王建国',hqStaff:'何雨桐',finHq:'金世安'})};
  try { newApproval({type:'funding',title:`${thisYear}年度科研经费拨付申请（${amt}万元）`,project:synthetic,initiator:user.name,stepTitles:['二级单位提交拨付申请','总部科技部审核','总部财务部审核','总部管理层确认拨付'],payload:{requestId:info.lastInsertRowid}}); }
  catch(e){db.prepare('DELETE FROM funding_requests WHERE id=?').run(info.lastInsertRowid);return res.status(e.status||400).json({error:e.message});}
  audit(user.name, '拨付申请', `${amount}万元`, purpose);
  res.json({ ok: true });
});

r.post('/funding/requests/:id/act', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  if (!(user.role === 'admin' || (user.role === 'mgmt' && user.scope === 'hq'))) {
    return res.status(403).json({ error: '仅总部管理可审批拨付申请' });
  }
  const { action } = req.body || {};
  const q = db.prepare('SELECT * FROM funding_requests WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'not found' });
  if (action === 'approve') return res.status(409).json({ error: '拨付必须通过总部科技部、财务部和管理层审批流办理，不允许单点直接拨付' });
  else {
    db.prepare("UPDATE funding_requests SET status='已驳回', decided_at=? WHERE id=?").run(TODAY(), q.id);
    audit(user.name, '拨付驳回', `${q.amount}万元`, q.purpose);
  }
  res.json({ ok: true });
});

// ---------- 系统对接同步（CMOS / 经费系统） ----------
const kvGet = (k) => db.prepare('SELECT value FROM kv WHERE key=?').get(k)?.value || null;
const kvSet = (k, v) => db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);

r.get('/sync/status', (req, res) => {
  // FE 计划管理页把 cmos/funds 当时间戳字符串使用（.slice），必须保持字符串兼容
  const cmos = kvGet('sync.cmos');
  const funds = kvGet('sync.funds');
  res.json({
    cmos,
    funds,
    cmosMeta: {
      configured: Boolean(String(process.env.CMOS_API_URL || '').trim()) || Boolean(cmos),
      state: cmos ? '已同步' : '演示同步可用',
      lastSync: cmos,
    },
    fundsMeta: {
      configured: Boolean(String(process.env.FUNDS_API_URL || '').trim()) || Boolean(funds),
      state: funds ? '已同步' : '演示同步可用',
      lastSync: funds,
    },
  });
});

r.post('/sync/cmos', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  if (!(user.role === 'admin' || (user.role === 'mgmt' && user.scope === 'hq'))) {
    return res.status(403).json({ error: '仅总部管理可执行CMOS同步' });
  }
  // 演示环境：内置 CMOS 模拟源（未配置真实 CMOS_API_URL 时仍可同步）
  const active = db.prepare("SELECT id, name FROM projects WHERE status IN ('实施中','验收中') ORDER BY RANDOM() LIMIT 2").all();
  const TITLES = ['提交专项计划月度执行报告', '完成阶段试验数据归档备案', '组织设计评审会并出具纪要', '完成供应链风险排查专项计划'];
  let added = 0;
  for (const p of active) {
    db.prepare("INSERT INTO plans (project_id,title,source,due,done_at,status) VALUES (?,?,?,?,NULL,'待办')")
      .run(p.id, TITLES[Math.floor(Math.random() * TITLES.length)], 'CMOS', addDays(TODAY(), 30 + Math.floor(Math.random() * 90)));
    added += 1;
  }
  const closed = db.prepare("UPDATE plans SET status='已完成', done_at=? WHERE id IN (SELECT id FROM plans WHERE status='待办' AND due < ? ORDER BY due LIMIT 1)").run(TODAY(), TODAY()).changes;
  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  kvSet('sync.cmos', at);
  audit('系统', 'CMOS同步', '全平台', `拉取已发布计划 ${added} 条，回写完成状态 ${closed} 条`);
  res.json({ ok: true, added, closed, at });
});


r.post('/sync/funds', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  if (!(user.role === 'admin' || (user.role === 'mgmt' && user.scope === 'hq'))) {
    return res.status(403).json({ error: '仅总部管理可执行经费同步' });
  }
  const y = Number(TODAY().slice(0, 4));
  const rows = db.prepare('SELECT f.*, p.name pname FROM funds f JOIN projects p ON p.id=f.project_id WHERE f.year=? AND f.budget > f.spent ORDER BY RANDOM() LIMIT 3').all(y);
  let updated = 0;
  for (const f of rows) {
    const inc = Math.round(Math.min(f.budget - f.spent, f.budget * 0.03) * 10) / 10;
    if (inc <= 0) continue;
    const wo = [...J(f.writeoffs_json, []), { date: TODAY(), amount: inc, voucher: `ERP同步-${y}-${String(Math.floor(1000 + Math.random() * 9000))}`, note: '单位经费平台自动抓取' }];
    db.prepare('UPDATE funds SET spent=spent+?, writeoffs_json=? WHERE id=?').run(inc, JSON.stringify(wo), f.id);
    updated += 1;
  }
  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  kvSet('sync.funds', at);
  audit('系统', '经费抓取', '全平台', `从各单位经费管理平台实时抓取执行数据，更新 ${updated} 条`);
  res.json({ ok: true, updated, at });
});


// ---------- 评价 / 后评价 ----------
r.get('/evaluations', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  const today = TODAY();
  const visible = (user.scope === 'hq' || user.role === 'admin')
    ? null
    : new Set(scopeProjects(user, db.prepare('SELECT * FROM projects').all()).map((p) => p.id));
  const cols = db.prepare('SELECT c.*, p.name pname, p.code pcode, p.accepted_at FROM collaborators c JOIN projects p ON p.id=c.project_id ORDER BY c.eval_date DESC').all()
    .filter((c) => !visible || visible.has(c.project_id))
    .map((c) => {
      // 30 日评价倒计时：参研自项目验收办结、外协自合同验收（演示同锚点）
      const contractAcceptance = c.ctype === '外协' ? db.prepare("SELECT acceptance_date FROM external_contracts WHERE collaborator_id=? AND status='已验收' ORDER BY acceptance_date DESC LIMIT 1").get(c.id)?.acceptance_date : null;
      const anchor = c.ctype === '外协' ? contractAcceptance : c.accepted_at;
      const deadline = c.total == null && anchor ? addDays(anchor, 30) : null;
      return { ...c, scores: J(c.scores_json), deadline, daysLeft: deadline ? daysLeft(deadline, today) : null };
    });
  const pes = []; // V19 本轮暂缓/删除后评价，协作评价保留，后评价数据不再对前端开放。
  res.json({ collaborators: cols, postEvals: pes });
});

r.post('/collaborators/:id/evaluate', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!assertWritable(user, res)) return;
  const c = db.prepare('SELECT c.*, p.name pname FROM collaborators c JOIN projects p ON p.id=c.project_id WHERE c.id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(c.project_id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!requireProjectPerm(user, res, p, 'eval_collaborator', '协作评价须由本项目负责人发起')) return;
  const s = req.body?.scores || {};
  const uploadId = Number(req.body?.uploadId);
  if (!uploadId) return res.status(400).json({ error: '必须上传真实评价报告或佐证材料' });
  const vals = ['tech', 'quality', 'schedule', 'service', 'compliance'].map((k) => Number(s[k]) || 0);
  if (vals.some((v) => v < 0 || v > 100)) return res.status(400).json({ error: '五维评分须为0至100分' });
  let linked;
  try {
    linked = archiveMaterialUploads({ pid: c.project_id, phase: '验收', requiredNames: ['协作单位评价报告'], materialUploads: [{ name: '协作单位评价报告', uploadId }], userName: user.name });
  } catch (e) {
    return res.status(e.status || 400).json({ error: String(e.message || e) });
  }
  const total = Math.round(vals.reduce((a, b) => a + b, 0) / 5);
  const grade = evalGrade(total);
  newApproval({ type:'evaluation',title:`「${c.name}」协作单位评价确认`,project:p,initiator:user.name,stepTitles:['项目团队提交五维评分','二级单位管理团队确认','总部管理团队备案'],payload:{collaboratorId:c.id,collaboratorName:c.name,scores:s,total,grade,materialUploads:linked} });
  audit(user.name, '协作单位评价', c.name, `${c.pname}：${total}分（${grade}）`);
  res.json({ ok: true, total, grade, pendingApproval:true, blacklistAfterConfirmation: grade === '不合格' });
});

// ---------- 文档上传与 AI 识读 ----------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}${extname(file.originalname) || '.bin'}`),
});
const uploadMw = multer({ storage, limits: { fileSize: 40 * 1024 * 1024 } });

/** multer 的 originalname 按 latin1 解码，中文文件名需转回 UTF-8 */
const fixName = (s) => Buffer.from(s, 'latin1').toString('utf8');

r.get('/ai/status', (req, res) => res.json(aiStatus()));

r.post('/uploads', uploadMw.single('file'), (req, res) => {
  const user = currentUser(req);
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const orig = fixName(req.file.originalname);
  const info = db.prepare('INSERT INTO uploads (orig_name,stored_name,mime,size_kb,uploaded_at,uploader) VALUES (?,?,?,?,?,?)')
    .run(orig, req.file.filename, req.file.mimetype, Math.max(1, Math.round(req.file.size / 1024)), TODAY(), user.name);
  audit(user.name, '上传文档', orig, `${Math.round(req.file.size / 1024)}KB 已存档至平台文件库`);
  res.json({ id: info.lastInsertRowid, name: orig, sizeKb: Math.round(req.file.size / 1024) });
});

async function fileToText(storedPath, ext) {
  if (ext === '.pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(readFileSync(storedPath)) });
    try {
      const r1 = await parser.getText();
      return { text: r1.text || '', pdf: true };
    } finally { await parser.destroy().catch(() => {}); }
  }
  if (ext === '.docx') {
    const r1 = await mammoth.extractRawText({ path: storedPath });
    return { text: r1.value || '', pdf: false };
  }
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) {
    return { text: readFileSync(storedPath, 'utf8'), pdf: false };
  }
  throw new Error(`暂不支持 ${ext || '该'} 格式，请上传 PDF / DOCX / TXT（老式 .doc 请另存为 .docx）`);
}

r.post('/uploads/:id/extract', async (req, res) => {
  const user = currentUser(req);
  const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(req.params.id);
  if (!up) return res.status(404).json({ error: '文件不存在' });
  const storedPath = join(UPLOAD_DIR, up.stored_name);
  if (!existsSync(storedPath)) return res.status(410).json({ error: '文件已被清理，请重新上传' });
  try {
    const ext = extname(up.orig_name).toLowerCase();
    const { text, pdf } = await fileToText(storedPath, ext);
    const channels = db.prepare('SELECT name FROM channels').all().map((c) => c.name);
    // 文本过少（多为扫描件）且走 Anthropic 时，直接把 PDF 原件交给模型识读
    const usePdfNative = pdf && text.replace(/\s/g, '').length < 200 && aiStatus().provider === 'anthropic';
    const result = await extractProjectInfo({
      text,
      pdfBase64: usePdfNative ? readFileSync(storedPath).toString('base64') : null,
      channels,
    });
    db.prepare('UPDATE uploads SET text_chars=?, extracted_json=? WHERE id=?')
      .run(text.length, JSON.stringify(result.fields), up.id);
    audit(user.name, 'AI识读', up.orig_name, `供应商 ${result.provider}/${result.model}，抽取字段 ${Object.keys(result.fields).length} 项`);
    res.json({ fields: result.fields, provider: result.provider, model: result.model, textChars: text.length });
  } catch (e) {
    res.status(422).json({ error: String(e.message || e).slice(0, 400) });
  }
});

r.get('/documents/:id/file', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc || !doc.file_path) return res.status(404).json({ error: '该文档无真实文件（演示种子数据）' });
  const p = join(UPLOAD_DIR, doc.file_path);
  if (!existsSync(p)) return res.status(410).json({ error: '文件已被清理' });
  res.download(p, doc.name);
});

const CHANNEL_DICT_KV = 'channel.dict.extensions';
let ledgerCascadeCache = null;

function dictKvRead() {
  const raw = db.prepare('SELECT value FROM kv WHERE key=?').get(CHANNEL_DICT_KV)?.value;
  const parsed = J(raw, {}) || {};
  return {
    sourceChannels: Array.isArray(parsed.sourceChannels) ? parsed.sourceChannels.map(cellText).filter(Boolean) : [],
    channelMeta: parsed.channelMeta && typeof parsed.channelMeta === 'object' ? parsed.channelMeta : {},
    hiddenChannels: Array.isArray(parsed.hiddenChannels) ? parsed.hiddenChannels.map(cellText).filter(Boolean) : [],
  };
}

function dictKvWrite(next) {
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(CHANNEL_DICT_KV, JSON.stringify({
      sourceChannels: next.sourceChannels || [],
      channelMeta: next.channelMeta || {},
      hiddenChannels: next.hiddenChannels || [],
    }));
  ledgerCascadeCache = null;
}

function templateChannelKeys() {
  const keys = new Set();
  try {
    for (const p of getCascadeConfig().paths || []) {
      if (p?.level && p?.sourceChannel) keys.add(`${p.level}::${p.sourceChannel}`);
    }
  } catch { /* ignore */ }
  return keys;
}

function makeTypeKey(name) {
  const text = cellText(name);
  const ascii = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  let key = ascii.length >= 2 ? ascii : `X${createHash('md5').update(text).digest('hex').slice(0, 7).toUpperCase()}`;
  if (!/^[A-Z]/.test(key)) key = `X${key}`;
  let candidate = key;
  let n = 2;
  while (db.prepare('SELECT id FROM channels WHERE key=?').get(candidate)) {
    candidate = `${key}${n}`.slice(0, 16);
    n += 1;
  }
  return candidate;
}

function parseTypeList(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[、，,;；\n]+/);
  return [...new Set(list.map(cellText).filter(Boolean))];
}

function insertTypeRow({ name, level, sourceChannel, orgOffice }) {
  const office = cellText(orgOffice) || '相关处室';
  const exists = db.prepare('SELECT id FROM channels WHERE level=? AND source_channel=? AND name=?')
    .get(level, sourceChannel, name);
  if (exists) return exists.id;
  const internalDept = level === '公司级' ? office : '科研项目处';
  const info = db.prepare(`INSERT INTO channels (key,name,level,source_channel,org_office,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'审批','["阶段性检查"]',1)`)
    .run(
      makeTypeKey(name), name, level, sourceChannel, office, office, internalDept,
      JSON.stringify(['申报', '立项', '实施', '验收']),
      JSON.stringify([]), JSON.stringify([]),
      JSON.stringify(['项目联系人', '项目负责人', '项目承担部门负责人', '二级总师', '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处']),
    );
  return info.lastInsertRowid;
}

function channelRowsOf(level, name) {
  return db.prepare('SELECT * FROM channels WHERE level=? AND source_channel=? ORDER BY name').all(level, name);
}

function channelInUse(level, name, projectType) {
  let sql = 'SELECT COUNT(*) n FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.level=? AND c.source_channel=?';
  const args = [level, name];
  if (projectType) {
    sql += ' AND c.name=?';
    args.push(projectType);
  }
  return Number(db.prepare(sql).get(...args)?.n || 0);
}

function listLedgerChannels() {
  const ext = dictKvRead();
  const hidden = new Set(ext.hiddenChannels || []);
  const templateKeys = templateChannelKeys();
  const byKey = new Map();
  const rows = db.prepare('SELECT * FROM channels ORDER BY level, source_channel, name').all();
  for (const r of rows) {
    const name = cellText(r.source_channel);
    if (!name) continue;
    const key = `${r.level}::${name}`;
    if (hidden.has(key)) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        level: r.level,
        orgOffice: cellText(r.org_office || r.org) || '相关处室',
        projectTypes: [],
        origin: templateKeys.has(key) ? 'template' : 'extension',
      });
    }
    const g = byKey.get(key);
    if (r.name && !g.projectTypes.includes(r.name)) g.projectTypes.push(r.name);
    if (cellText(r.org_office || r.org)) g.orgOffice = cellText(r.org_office || r.org);
  }
  for (const [name, meta] of Object.entries(ext.channelMeta || {})) {
    const level = cellText(meta.level);
    const chName = cellText(name);
    if (!level || !chName) continue;
    const key = `${level}::${chName}`;
    if (hidden.has(key)) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name: chName,
        level,
        orgOffice: cellText(meta.orgOffice) || '相关处室',
        projectTypes: parseTypeList(meta.projectTypes),
        origin: templateKeys.has(key) ? 'template' : 'extension',
      });
      continue;
    }
    const hit = byKey.get(key);
    if (cellText(meta.orgOffice)) hit.orgOffice = cellText(meta.orgOffice);
    for (const t of parseTypeList(meta.projectTypes)) {
      if (!hit.projectTypes.includes(t)) hit.projectTypes.push(t);
    }
  }
  const order = new Map(LEVELS.map((lv, i) => [lv, i]));
  return [...byKey.values()].sort((a, b) => {
    const la = order.has(a.level) ? order.get(a.level) : 99;
    const lb = order.has(b.level) ? order.get(b.level) : 99;
    if (la !== lb) return la - lb;
    return String(a.name).localeCompare(String(b.name), 'zh-CN');
  });
}

function channelDictionaryGrouped() {
  const items = listLedgerChannels();
  const groups = LEVELS.map((level) => ({
    level,
    channels: items.filter((x) => x.level === level),
  }));
  const orphan = items.filter((x) => !LEVELS.includes(x.level));
  if (orphan.length) groups.push({ level: '未分级', channels: orphan });
  return {
    version: 'live',
    updated: TODAY(),
    title: '层级 → 渠道 → 司局/处室 → 项目类型',
    levels: LEVELS.slice(),
    groups,
    channels: items,
  };
}

function ledgerTreeAndPaths() {
  const tree = {};
  const paths = [];
  for (const ch of listLedgerChannels()) {
    const office = ch.orgOffice || '相关处室';
    tree[ch.level] ||= {};
    tree[ch.level][ch.name] ||= {};
    tree[ch.level][ch.name][office] ||= [];
    const types = ch.projectTypes.length ? ch.projectTypes : [];
    for (const projectType of types) {
      if (!tree[ch.level][ch.name][office].includes(projectType)) {
        tree[ch.level][ch.name][office].push(projectType);
      }
      paths.push({ level: ch.level, sourceChannel: ch.name, orgOffice: office, projectType });
    }
    if (!types.length) {
      tree[ch.level][ch.name][office] ||= [];
    }
  }
  return { tree, paths };
}

function liveCascadeConfig() {
  if (ledgerCascadeCache) return ledgerCascadeCache;
  const file = getCascadeConfig();
  const { tree, paths } = ledgerTreeAndPaths();
  ledgerCascadeCache = buildCascadeIndexes({
    version: file.version,
    updated: file.updated,
    rules: file.rules,
    levels: LEVELS,
    tree: Object.keys(tree).length ? tree : file.tree,
    paths: paths.length ? paths : file.paths,
    file: file.sourceFile,
  });
  return ledgerCascadeCache;
}

function liveResolveOffice(projectType) {
  const key = cellText(projectType);
  if (!key) return null;
  const hit = liveCascadeConfig().pathByType[key];
  if (hit) return { level: hit.level, source: hit.sourceChannel, office: hit.orgOffice };
  return resolveOfficeByProjectType(projectType);
}

function liveFindPath({ level, sourceChannel, orgOffice, projectType }) {
  const cfg = liveCascadeConfig();
  return cfg.paths.find((p) =>
    (!level || p.level === level)
    && (!sourceChannel || p.sourceChannel === sourceChannel)
    && (!orgOffice || p.orgOffice === orgOffice)
    && (!projectType || p.projectType === projectType)) || null;
}

function upsertChannelMeta(name, patch, { dropName } = {}) {
  const current = dictKvRead();
  const nextMeta = { ...(current.channelMeta || {}) };
  if (dropName) delete nextMeta[dropName];
  const prev = nextMeta[name] || {};
  nextMeta[name] = {
    level: cellText(patch.level) || prev.level,
    orgOffice: cellText(patch.orgOffice) || prev.orgOffice || '相关处室',
    projectTypes: Array.isArray(patch.projectTypes) ? patch.projectTypes : (prev.projectTypes || []),
  };
  dictKvWrite({
    sourceChannels: [...new Set([...(current.sourceChannels || []).filter((x) => x !== dropName), name])],
    channelMeta: nextMeta,
    hiddenChannels: current.hiddenChannels || [],
  });
}

function addLedgerChannel(name, { level, projectTypes, orgOffice } = {}) {
  const text = cellText(name);
  if (!text) throw new Error('渠道名称不能为空');
  const lv = cellText(level);
  if (!LEVELS.includes(lv)) throw new Error('请选择层级：国家级 / 地方级 / 公司级');
  if (listLedgerChannels().some((x) => x.name === text && x.level === lv)) {
    throw new Error(`「${lv} / ${text}」已存在`);
  }
  const types = parseTypeList(projectTypes);
  const office = cellText(orgOffice) || '相关处室';
  for (const t of types) insertTypeRow({ name: t, level: lv, sourceChannel: text, orgOffice: office });
  upsertChannelMeta(text, { level: lv, orgOffice: office, projectTypes: types });
  ledgerCascadeCache = null;
  return channelDictionaryGrouped();
}

function addProjectTypesToChannel(channelName, { level, projectTypes, orgOffice } = {}) {
  const name = cellText(channelName);
  if (!name) throw new Error('渠道名称不能为空');
  const types = parseTypeList(projectTypes);
  if (!types.length) throw new Error('请填写至少一个项目类型');
  const hit = listLedgerChannels().find((x) => x.name === name && (!level || x.level === cellText(level)))
    || listLedgerChannels().find((x) => x.name === name);
  if (!hit) throw new Error(`渠道「${name}」不存在，请先新增渠道`);
  const lv = cellText(level) || hit.level;
  const office = cellText(orgOffice) || hit.orgOffice || '相关处室';
  for (const t of types) insertTypeRow({ name: t, level: lv, sourceChannel: name, orgOffice: office });
  upsertChannelMeta(name, { level: lv, orgOffice: office, projectTypes: [...new Set([...(hit.projectTypes || []), ...types])] });
  ledgerCascadeCache = null;
  return channelDictionaryGrouped();
}

function updateLedgerChannel(currentName, { name, level, orgOffice, currentLevel } = {}) {
  const oldName = cellText(currentName);
  const nextName = cellText(name);
  const nextLevel = cellText(level);
  if (!oldName || !nextName || !LEVELS.includes(nextLevel)) throw new Error('请完整填写渠道名称和所属层级');
  const hit = listLedgerChannels().find((x) => x.name === oldName && (!currentLevel || x.level === cellText(currentLevel)))
    || listLedgerChannels().find((x) => x.name === oldName);
  if (!hit) throw new Error(`渠道「${oldName}」不存在`);
  if (listLedgerChannels().some((x) => x.name === nextName && x.level === nextLevel && !(x.name === oldName && x.level === hit.level))) {
    throw new Error(`「${nextLevel} / ${nextName}」已存在`);
  }
  const office = cellText(orgOffice) || hit.orgOffice || '相关处室';
  const internalDept = nextLevel === '公司级' ? office : '科研项目处';
  db.prepare(`UPDATE channels SET source_channel=?, level=?, org_office=?, org=?, dept=? WHERE level=? AND source_channel=?`)
    .run(nextName, nextLevel, office, office, internalDept, hit.level, oldName);
  const current = dictKvRead();
  const nextMeta = { ...(current.channelMeta || {}) };
  delete nextMeta[oldName];
  nextMeta[nextName] = { level: nextLevel, orgOffice: office, projectTypes: hit.projectTypes || [] };
  const hidden = (current.hiddenChannels || []).filter((x) => x !== `${hit.level}::${oldName}`);
  dictKvWrite({
    sourceChannels: [...new Set([...(current.sourceChannels || []).filter((x) => x !== oldName), nextName])],
    channelMeta: nextMeta,
    hiddenChannels: hidden,
  });
  const users = db.prepare('SELECT id, form_scope, form_scope_keys FROM users WHERE form_scope=?').all('channel');
  for (const u of users) {
    const keys = parseFormScopeKeys(u.form_scope_keys).map((k) => (k === oldName ? nextName : k));
    db.prepare('UPDATE users SET form_scope_keys=? WHERE id=?').run(JSON.stringify(keys), u.id);
  }
  ledgerCascadeCache = null;
  return channelDictionaryGrouped();
}

function removeProjectTypeFromChannel(channelName, { level, projectType } = {}) {
  const name = cellText(channelName);
  const type = cellText(projectType);
  const hit = listLedgerChannels().find((x) => x.name === name && (!level || x.level === cellText(level)));
  if (!hit || !type || !hit.projectTypes.includes(type)) throw new Error('未找到要删除的项目类型');
  if (channelInUse(hit.level, name, type)) throw new Error(`项目类型「${type}」仍被项目引用，无法删除`);
  db.prepare('DELETE FROM channels WHERE level=? AND source_channel=? AND name=?').run(hit.level, name, type);
  upsertChannelMeta(name, { level: hit.level, orgOffice: hit.orgOffice, projectTypes: hit.projectTypes.filter((t) => t !== type) });
  ledgerCascadeCache = null;
  return channelDictionaryGrouped();
}

function removeLedgerChannel(name, level) {
  const text = cellText(name);
  if (!text) throw new Error('渠道名称不能为空');
  const hit = listLedgerChannels().find((x) => x.name === text && (!level || x.level === cellText(level)));
  if (!hit) throw new Error(`渠道「${text}」不存在`);
  if (channelInUse(hit.level, text)) throw new Error(`渠道「${text}」仍被项目引用，无法删除`);
  db.prepare('DELETE FROM channels WHERE level=? AND source_channel=?').run(hit.level, text);
  const current = dictKvRead();
  const nextMeta = { ...(current.channelMeta || {}) };
  delete nextMeta[text];
  const hideKey = `${hit.level}::${text}`;
  dictKvWrite({
    sourceChannels: (current.sourceChannels || []).filter((x) => x !== text),
    channelMeta: nextMeta,
    hiddenChannels: hit.origin === 'template'
      ? [...new Set([...(current.hiddenChannels || []), hideKey])]
      : (current.hiddenChannels || []).filter((x) => x !== hideKey),
  });
  ledgerCascadeCache = null;
  return channelDictionaryGrouped();
}


// ---------- 管理 ----------
r.get('/admin', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!requireRoles(user, res, ['admin'], '仅系统管理员可访问系统管理')) return;
  const channels = db.prepare('SELECT * FROM channels ORDER BY level, source_channel, org_office, name').all().map(mapChannelRow);
  const users = db.prepare('SELECT * FROM users').all().map((u) => publicUser(u));
  const auditRows = db.prepare('SELECT * FROM audit ORDER BY ts DESC LIMIT 100').all();
  res.json({ channels, users, audit: auditRows, cascade: cascadePayload(), channelDictionary: channelDictionaryGrouped() });
});

/** 渠道字典维护：仅允许在合法路径表内新增叶子（编码全局唯一） */
r.post('/admin/channels', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!requireRoles(user, res, ['admin'], '仅系统管理员可执行此操作')) return;
  const { key, name, level, source_channel, org_office, org, dept, flow, declare, filing } = req.body || {};
  const sourceChannel = source_channel || '';
  const orgOffice = org_office || org || '';
  if (!key || !name || !level || !sourceChannel || !orgOffice) {
    return res.status(400).json({ error: '编码、项目类型、层级、渠道、司局/处室为必填项' });
  }
  if (db.prepare('SELECT id FROM channels WHERE key=?').get(String(key).toUpperCase())) {
    return res.status(400).json({ error: `渠道编码 ${key} 已存在，编码全局唯一禁止重复` });
  }
  const split = (s) => (Array.isArray(s) ? s : String(s || '').split(/[、，,;\s]+/).filter(Boolean));
  const internalDept = level === '公司级' ? orgOffice : (dept || '科研项目处');
  db.prepare(`INSERT INTO channels (key,name,level,source_channel,org_office,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'审批','["阶段性检查"]',1)`)
    .run(
      String(key).toUpperCase(), name, level, sourceChannel, orgOffice, orgOffice, internalDept,
      JSON.stringify(split(flow).length ? split(flow) : ['申报', '立项', '实施', '验收']),
      JSON.stringify(split(declare)), JSON.stringify(split(filing)),
      JSON.stringify(['项目联系人', '项目负责人', '项目承担部门负责人', '二级总师', '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处']),
    );
  audit(user.name, '字典维护', '渠道字典', `新增项目类型「${name}」编码 ${String(key).toUpperCase()}（${level}/${sourceChannel}/${orgOffice}）`);
  ledgerCascadeCache = null;
  res.json({ ok: true });
});

/** 渠道启用 / 终止 */
r.post('/admin/channels/:id/toggle', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!requireRoles(user, res, ['admin'], '仅系统管理员可执行此操作')) return;
  const c = db.prepare('SELECT * FROM channels WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE channels SET enabled=? WHERE id=?').run(c.enabled ? 0 : 1, c.id);
  audit(user.name, '字典维护', '渠道字典', `${c.enabled ? '终止' : '启用'}渠道「${c.name}」（${c.key}）`);
  ledgerCascadeCache = null;
  res.json({ ok: true, enabled: c.enabled ? 0 : 1 });
});

r.post('/admin/dict/channels', (req, res) => {
  const user = assertAdminUser(req, res);
  if (!user) return;
  try {
    const channelDictionary = addLedgerChannel(req.body?.name, {
      level: req.body?.level,
      projectTypes: req.body?.projectTypes,
      orgOffice: req.body?.orgOffice,
    });
    audit(user.name, '字典维护', '渠道字典', `新增渠道「${cellText(req.body?.name)}」·${cellText(req.body?.level)}`);
    res.json({ ok: true, channelDictionary, ledgerChannels: channelDictionary.channels });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

r.post('/admin/dict/channels/types', (req, res) => {
  const user = assertAdminUser(req, res);
  if (!user) return;
  try {
    const channelDictionary = addProjectTypesToChannel(req.body?.name || req.body?.channel, {
      level: req.body?.level,
      projectTypes: req.body?.projectTypes,
      orgOffice: req.body?.orgOffice,
    });
    audit(user.name, '字典维护', '渠道字典', `渠道「${cellText(req.body?.name || req.body?.channel)}」新增项目类型`);
    res.json({ ok: true, channelDictionary, ledgerChannels: channelDictionary.channels });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

r.put('/admin/dict/channels', (req, res) => {
  const user = assertAdminUser(req, res);
  if (!user) return;
  try {
    const channelDictionary = updateLedgerChannel(req.body?.currentName || req.body?.oldName, req.body || {});
    audit(user.name, '字典维护', '渠道字典', `修改渠道「${cellText(req.body?.currentName || req.body?.oldName)}」`);
    res.json({ ok: true, channelDictionary, ledgerChannels: channelDictionary.channels });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

r.post('/admin/dict/channels/types/remove', (req, res) => {
  const user = assertAdminUser(req, res);
  if (!user) return;
  try {
    const channelDictionary = removeProjectTypeFromChannel(req.body?.name || req.body?.channel, req.body || {});
    audit(user.name, '字典维护', '渠道字典', `删除项目类型「${cellText(req.body?.projectType)}」`);
    res.json({ ok: true, channelDictionary, ledgerChannels: channelDictionary.channels });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

r.post('/admin/dict/channels/remove', (req, res) => {
  const user = assertAdminUser(req, res);
  if (!user) return;
  try {
    const name = cellText(req.body?.name);
    const channelDictionary = removeLedgerChannel(name, req.body?.level);
    audit(user.name, '字典维护', '渠道字典', `删除渠道「${name}」`);
    res.json({ ok: true, channelDictionary, ledgerChannels: channelDictionary.channels });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});


/** 账号状态：离岗自动回收权限 */
r.post('/admin/users/:id/status', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  if (!requireRoles(user, res, ['admin'], '仅系统管理员可执行此操作')) return;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  if (u.role === 'admin') return res.status(400).json({ error: '系统管理员账号不可停用' });
  const next = u.status === '在岗' ? '已离岗' : '在岗';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(next, u.id);
  audit(user.name, next === '已离岗' ? '权限回收' : '账号恢复', u.name,
    next === '已离岗' ? '岗位变动，系统自动回收账号权限，7 个工作日内完成注销/移交' : '账号重新启用');
  res.json({ ok: true, status: next });
});


// ---------- 成员管理 API（系统管理员）----------
r.get('/rbac/duty-perms', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  res.json({
    duties: PROJECT_DUTY_DEFS,
    perms: PROJECT_PERM_DEFS,
    matrix: loadDutyPermMatrix(),
    defaults: DEFAULT_DUTY_PERMS,
    viewAlways: PROJECT_VIEW_ALWAYS,
    hint: '页签与概览字段始终可见，岗位矩阵只控制办理，不关闭信息。平台身份决定登录入口与组织范围；同一人在不同项目担任不同岗位时，办理权限随之不同。',
  });
});

r.put('/rbac/duty-perms', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const incoming = req.body?.matrix;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: '请提交岗位权限矩阵' });
  const next = {};
  for (const d of PROJECT_DUTY_DEFS) {
    const arr = Array.isArray(incoming[d.key]) ? incoming[d.key] : [];
    next[d.key] = arr.filter((code) => PROJECT_PERM_DEFS.some((p) => p.code === code));
  }
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(RBAC_DUTY_KV, JSON.stringify(next));
  audit(admin.name, '岗位权限', '项目岗位功能矩阵', `已保存 ${PROJECT_DUTY_DEFS.length} 类岗位 × ${PROJECT_PERM_DEFS.length} 项功能`);
  res.json({ ok: true, matrix: loadDutyPermMatrix() });
});

r.post('/rbac/duty-perms/reset', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  db.prepare('DELETE FROM kv WHERE key=?').run(RBAC_DUTY_KV);
  audit(admin.name, '岗位权限', '项目岗位功能矩阵', '已恢复推荐默认矩阵');
  res.json({ ok: true, matrix: loadDutyPermMatrix() });
});

r.get('/me/project-duties', (req, res) => {
  const user = req.user || requireUser(req, res);
  if (!user) return;
  res.json({ rows: listUserProjectDuties(user) });
});

r.get('/admin/users/:id/project-duties', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '成员不存在' });
  res.json({ user: publicUser(u), rows: listUserProjectDuties(publicUser(u)) });
});

r.get('/admin/users', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const users = db.prepare('SELECT * FROM users ORDER BY role, id').all().map((u) => publicUser(u));
  res.json({ users });
});

r.post('/admin/users', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const id = String(req.body?.id || '').trim();
  const name = String(req.body?.name || '').trim();
  const role = String(req.body?.role || 'team').trim();
  const scope = String(req.body?.scope || 'self').trim();
  let title = String(req.body?.title || '').trim();
  if (!title && role === 'contact') title = '项目联系人';
  const status = String(req.body?.status || '在岗').trim();
  const unitRaw = req.body?.unit_id;
  const unit_id = (unitRaw === '' || unitRaw == null) ? null : Number(unitRaw);
  if (!isEmpNo(id)) return res.status(400).json({ error: '账号须为 6 位数字工号' });
  if (!name) return res.status(400).json({ error: '姓名不能为空' });
  if (!USER_ROLES.has(role)) return res.status(400).json({ error: '角色不合法' });
  if (!USER_SCOPES.has(scope)) return res.status(400).json({ error: '范围不合法' });
  if (!['在岗', '已离岗'].includes(status)) return res.status(400).json({ error: '状态不合法' });
  if (db.prepare('SELECT id FROM users WHERE id=? OR emp_no=?').get(id, id)) {
    return res.status(400).json({ error: `工号 ${id} 已存在` });
  }
  if (unit_id != null && Number.isNaN(unit_id)) return res.status(400).json({ error: '单位 ID 不合法' });
  const form = normalizeFormAccess(req.body || {}, unit_id);
  if (form.error) return res.status(400).json({ error: form.error });
  const password = String(req.body?.password || id);
  const password_hash = hashPassword(password);
  db.prepare(`INSERT INTO users (id,name,role,scope,unit_id,title,status,password_hash,emp_no,form_access,form_scope,form_scope_keys)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, name, role, scope, unit_id, title || null, status, password_hash, id, form.form_access, form.form_scope, form.form_scope_keys);
  audit(admin.name, '成员管理', name, `新增成员 ${id}（角色 ${role}/${scope}${form.form_access ? `，表单维护 ${FORM_SCOPE_LABEL[form.form_scope]}` : ''}），初始密码已设置`);
  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)), initialPassword: password });
});

r.put('/admin/users/:id', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const id = String(req.params.id || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return res.status(404).json({ error: '成员不存在' });
  const name = String(req.body?.name ?? u.name).trim();
  const role = String(req.body?.role ?? u.role).trim();
  const scope = String(req.body?.scope ?? u.scope).trim();
  const title = String(req.body?.title ?? (u.title || '')).trim();
  const status = String(req.body?.status ?? u.status).trim();
  const unitRaw = req.body?.unit_id;
  const unit_id = unitRaw === undefined
    ? u.unit_id
    : ((unitRaw === '' || unitRaw == null) ? null : Number(unitRaw));
  if (!name) return res.status(400).json({ error: '姓名不能为空' });
  if (!USER_ROLES.has(role)) return res.status(400).json({ error: '角色不合法' });
  if (!USER_SCOPES.has(scope)) return res.status(400).json({ error: '范围不合法' });
  if (!['在岗', '已离岗'].includes(status)) return res.status(400).json({ error: '状态不合法' });
  if (u.role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: '不能取消唯一系统管理员角色' });
  }
  if (id === admin.id && status === '已离岗') {
    return res.status(400).json({ error: '不能将自己设为已离岗' });
  }
  const form = normalizeFormAccess(req.body || {}, unit_id, u);
  if (form.error) return res.status(400).json({ error: form.error });
  db.prepare('UPDATE users SET name=?, role=?, scope=?, unit_id=?, title=?, status=?, form_access=?, form_scope=?, form_scope_keys=? WHERE id=?')
    .run(name, role, scope, unit_id, title || null, status, form.form_access, form.form_scope, form.form_scope_keys, id);
  audit(admin.name, '成员管理', name, `编辑成员 ${id}${form.form_access ? `（表单维护 ${FORM_SCOPE_LABEL[form.form_scope]}）` : ''}`);
  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});

r.delete('/admin/users/:id', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const id = String(req.params.id || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return res.status(404).json({ error: '成员不存在' });
  if (id === admin.id) return res.status(400).json({ error: '不能删除当前登录账号' });
  if (u.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: '不能删除唯一系统管理员' });
  }
  db.prepare('DELETE FROM login_sessions WHERE user_id=?').run(id);
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  audit(admin.name, '成员管理', u.name, `删除成员 ${id}`);
  res.json({ ok: true });
});

r.post('/admin/users/:id/reset-password', (req, res) => {
  const admin = assertAdminUser(req, res);
  if (!admin) return;
  const id = String(req.params.id || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return res.status(404).json({ error: '成员不存在' });
  const password = String(req.body?.password || u.emp_no || id);
  if (password.length < 4) return res.status(400).json({ error: '密码至少 4 位' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), u.id);
  db.prepare('DELETE FROM login_sessions WHERE user_id=?').run(id);
  audit(admin.name, '成员管理', u.name, `重置密码 ${id}`);
  res.json({ ok: true, password, message: `已将 ${id} 的密码重置为：${password}` });
});


export default r;
