import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDb, createSchema } from './db.js';
import { todayISO, statusColor, worstColor, evalGrade, daysLeft, addDays } from './domain.js';
import { aiStatus, extractProjectInfo } from './ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', 'data', 'uploads');
const TRANSITION_TEMPLATE_FILE = '预先研究项目信息-表头 (1).xlsx';
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = openDb();
createSchema(db);
const r = Router();

const J = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const TODAY = () => todayISO();
const LEVELS = ['国家级', '地方级', '公司级'];

const V19_MAJOR_BY_CHANNEL = {
  MJKY: ['10-总体气动', '1001-总体与气动'],
  ZX04: ['30-系统', '3002-飞控'],
  ZDYF: ['20-机体', '2002-强度'],
  XX25: ['40-制造', '4001-系统工艺'],
  NSFC: ['80-通用基础', '8003-情报档案'],
  FGW: ['80-通用基础', '8005-信息化'],
  JBGS: ['70-运行支持', '7001-运行支援'],
  SHKC: ['70-运行支持', '7001-运行支援'],
  YYGD: ['10-总体气动', '1001-总体与气动'],
  ZDKC: ['80-通用基础', '8004-标准化技术'],
  XJQX: ['60-飞行', '6001-试飞工程'],
  KJZ: ['80-通用基础', '8004-标准化技术'],
  DFY: ['80-通用基础', '8003-情报档案'],
  CLLM: ['50-复合材料', '5001-复合材料设计'],
  BOEING: ['70-运行支持', '7001-运行支援'],
};

const TRANSITION_FIELDS = [
  { group: '项目基本信息', code: 'serial', label: '序号', required: false, index: 0, width: 8 },
  { group: '项目基本信息', code: 'level', label: '级别', required: true, index: 1, width: 10 },
  { group: '项目基本信息', code: 'sourceChannel', label: '项目来源/渠道', required: true, index: 2, width: 16 },
  { group: '项目基本信息', code: 'projectType', label: '项目类型', required: true, index: 3, width: 16 },
  { group: '项目基本信息', code: 'major1', label: '一级专业', required: false, index: 4, width: 16 },
  { group: '项目基本信息', code: 'major2', label: '二级专业', required: false, index: 5, width: 18 },
  { group: '项目基本信息', code: 'name', label: '项目名称', required: true, index: 6, width: 34 },
  { group: '项目基本信息', code: 'center', label: '所中心', required: false, index: 7, width: 14 },
  { group: '项目基本信息', code: 'demandUnit', label: '管理/需求单位', required: false, index: 8, width: 18 },
  { group: '项目基本信息', code: 'responsibleUnit', label: '责任单位', required: true, index: 9, width: 16 },
  { group: '项目基本信息', code: 'projectStatus', label: '项目状态', required: true, index: 10, width: 12 },
  { group: '项目基本信息', code: 'acceptanceStatus', label: '验收状态', required: false, index: 11, width: 12 },
  { group: '项目基本信息', code: 'owner', label: '负责人', required: false, index: 12, width: 18, aliases: ['中国商飞内部负责人'] },
  { group: '项目基本信息', code: 'approvalMonth', label: '项目立项年月', required: false, index: 13, width: 14 },
  { group: '项目基本信息', code: 'startMonth', label: '项目开始年月', required: false, index: 14, width: 14 },
  { group: '项目基本信息', code: 'endMonth', label: '项目结束年月', required: false, index: 15, width: 14 },
  { group: '项目基本信息', code: 'duration', label: '项目周期', required: false, index: 16, width: 12 },
  { group: '经费情况', code: 'totalBudget', label: '总经费（万元）', required: true, index: 17, width: 14, number: true },
  { group: '经费情况', code: 'centralGrant', label: '国拨经费（万元）', required: false, index: 18, width: 14, number: true },
  { group: '经费情况', code: 'internalGrant', label: '其中商飞内部单位国拨经费（万元）', required: false, index: 19, width: 22, number: true },
  { group: '经费情况', code: 'selfFund', label: '自筹经费（万元）', required: false, index: 20, width: 14, number: true },
  { group: '经费情况', code: 'internalSelfFund', label: '其中商飞内部单位自筹经费（万元）', required: false, index: 21, width: 22, number: true },
  { group: '经费情况', code: 'spent', label: '累计支出（万元）', required: false, index: 22, width: 14, number: true },
  { group: '经费情况', code: 'budget2026', label: '2026年预算（万元）', required: false, index: 23, width: 16, number: true },
  { group: '经费情况', code: 'budget2026Actual', label: '2026年实际执行经费（万元）', required: false, index: 24, width: 18, number: true },
  { group: '经费情况', code: 'budget2026Rate', label: '2026年预算执行率', required: false, index: 25, width: 16 },
  { group: '经费情况', code: 'closedActualBudget', label: '已结题项目实际执行经费（万元）', required: false, index: 26, width: 22, number: true },
  { group: '经费情况', code: 'closedGrantSpent', label: '已结题项目国拨经费执行（万元）', required: false, index: 27, width: 22, number: true },
  { group: '经费情况', code: 'closedSelfSpent', label: '已结题项目自筹经费执行（万元）', required: false, index: 28, width: 24, number: true, aliases: ['已结题项目国自筹经费执行（万元）'] },
  { group: '经费情况', code: 'closedExecutionRate', label: '已结题项目经费执行率', required: false, index: 29, width: 16, aliases: ['执行率'] },
  { group: '成果转化情况', code: 'resultCount', label: '产生成果数量', required: false, index: 30, width: 14, number: true },
  { group: '成果转化情况', code: 'resultNames', label: '产生成果名称', required: false, index: 31, width: 28 },
  { group: '成果转化情况', code: 'convertedCount', label: '已转化数量', required: false, index: 32, width: 14, number: true },
  { group: '成果转化情况', code: 'convertedNames', label: '转化成果名称', required: false, index: 33, width: 28 },
  { group: '成果转化情况', code: 'convertedMonth', label: '转化年月', required: false, index: 34, width: 14 },
  { group: '成果转化情况', code: 'convertedModel', label: '转化型号', required: false, index: 35, width: 18 },
  { group: '成果转化情况', code: 'reserveCount', label: '技术储备数量', required: false, index: 36, width: 14, number: true },
  { group: '成果转化情况', code: 'reserveNames', label: '储备成果名称', required: false, index: 37, width: 28 },
  { group: '成果转化情况', code: 'reserveYear', label: '预计转化年度', required: false, index: 38, width: 14 },
  { group: '备注', code: 'remarks', label: '备注', required: false, index: 39, width: 18 },
];

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
  const major = V19_MAJOR_BY_CHANNEL[channel.key] || ['科研项目', p.level];
  const split = fundSplit(Number(p.total_budget) || 0, p.level);
  const spentAll = funds.reduce((s, f) => s + f.spent, 0);
  const execRate = p.total_budget ? Math.round((spentAll / p.total_budget) * 100) : 0;
  const pkgs = db.prepare('SELECT status,mode,form FROM packages WHERE project_id=?').all(p.id);
  const collaborators = db.prepare('SELECT total,blacklisted FROM collaborators WHERE project_id=?').all(p.id);
  return {
    major1: major[0],
    major2: major[1],
    launchMonth: p.start?.slice(0, 7) || '',
    endMonth: p.end?.slice(0, 7) || '',
    projectMonths: monthDiff(p.start, p.end),
    managerUnit: channel.dept || '科研项目处',
    demandUnit: p.level === '公司级' ? '公司总部科技管理部' : channel.org || '上级主管部门',
    responsibleUnit: unit.name || '',
    leadWork: `${unit.short || '牵头单位'}牵头；${(p.goal || '').slice(0, 44)}${p.goal && p.goal.length > 44 ? '…' : ''}`,
    plannedPartners: J(p.partners_json, []).map((x) => x.name).join('、'),
    centralGrant: split.centralGrant,
    selfFund: split.selfFund,
    internalFund: split.internalFund,
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

function currentUser(req) {
  const id = req.header('x-user') || 'u_hq';
  return db.prepare('SELECT * FROM users WHERE id=?').get(id) || db.prepare("SELECT * FROM users WHERE id='u_hq'").get();
}

// 岗位变动权限回收：已离岗账号阻断业务访问（bootstrap 放行以便登录页展示状态）
r.use((req, res, next) => {
  if (req.path === '/bootstrap') return next();
  const id = req.header('x-user');
  if (id) {
    const u = db.prepare('SELECT status FROM users WHERE id=?').get(id);
    if (u && u.status === '已离岗') return res.status(401).json({ error: '该账号已离岗，权限已自动回收（超级管理员 7 个工作日内完成注销/移交）' });
  }
  next();
});

// ---------- 项目富化 ----------
function enrichProject(p, today) {
  const ms = db.prepare('SELECT * FROM milestones WHERE project_id=? ORDER BY due').all(p.id);
  const msColors = ms.map((m) => statusColor(m.due, m.done_at, today));
  const openMs = ms.filter((m) => !m.done_at);
  const color = p.status === '已验收' || p.status === '已终止' ? 'green'
    : ms.length === 0 ? 'blue' : worstColor(msColors);
  const funds = db.prepare('SELECT * FROM funds WHERE project_id=? ORDER BY year').all(p.id);
  const yearFund = funds.find((f) => f.year === Number(today.slice(0, 4)));
  const spentAll = funds.reduce((s, f) => s + f.spent, 0);
  const delivered = db.prepare('SELECT COUNT(*) n FROM deliverables WHERE project_id=? AND delivered_at IS NOT NULL').get(p.id).n;
  const delivTotal = db.prepare('SELECT COUNT(*) n FROM deliverables WHERE project_id=?').get(p.id).n;
  const doneMs = ms.filter((m) => m.done_at).length;
  const v19 = v19LedgerFields(p, funds, delivered, delivTotal);
  return {
    ...p,
    partners: J(p.partners_json, []),
    team: J(p.team_json, {}),
    tags: J(p.tags_json, []),
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
  if (user.scope === 'hq') return rows;
  if (user.role === 'chief') {
    return rows.filter((p) => { const t = J(p.team_json, {}); return t.chief1 === user.name || t.chief2 === user.name; });
  }
  if (user.scope === 'unit') return rows.filter((p) => p.lead_unit_id === user.unit_id);
  // team: 本人关联项目
  return rows.filter((p) => {
    const t = J(p.team_json, {});
    return [t.owner, t.tech, t.pm].includes(user.name);
  });
}

// ---------- 基础 ----------
r.get('/bootstrap', (req, res) => {
  const units = db.prepare('SELECT * FROM units').all();
  const channels = db.prepare('SELECT * FROM channels').all().map((c) => ({
    ...c, flow: J(c.flow_json, []), declare: J(c.declare_json, []), filing: J(c.filing_json, []), chain: J(c.approve_chain_json, []), assess: J(c.assess_json, []),
  }));
  const users = db.prepare('SELECT * FROM users').all();
  res.json({ today: TODAY(), units, channels, users });
});

// ---------- 项目台账 ----------
r.get('/projects', (req, res) => {
  const user = currentUser(req);
  const today = TODAY();
  let rows = db.prepare('SELECT * FROM projects ORDER BY id').all();
  rows = scopeProjects(user, rows);
  const { level, channel, unit, status, color, kw } = req.query;
  let list = rows.map((p) => enrichProject(p, today));
  if (level) list = list.filter((p) => p.level === level);
  if (channel) list = list.filter((p) => String(p.channel_id) === String(channel));
  if (unit) list = list.filter((p) => String(p.lead_unit_id) === String(unit));
  if (status) list = list.filter((p) => p.status === status);
  if (color) list = list.filter((p) => p.color === color);
  if (kw) list = list.filter((p) => p.name.includes(kw) || p.code.includes(kw));
  res.json(list);
});

r.get('/projects.xlsx', (req, res) => {
  const user = currentUser(req);
  if (user.role === 'leader') return res.status(403).json({ error: '领导角色为只读查看权限，暂不开放全量导出' });
  const today = TODAY();
  const list = db.prepare('SELECT * FROM projects ORDER BY id').all().map((p) => enrichProject(p, today));
  const units = Object.fromEntries(db.prepare('SELECT id,short FROM units').all().map((u) => [u.id, u.short]));
  const chs = Object.fromEntries(db.prepare('SELECT id,name FROM channels').all().map((c) => [c.id, c.name]));
  const cmap = { red: '红·逾期', yellow: '黄·临期', blue: '蓝·推进', green: '绿·完成' };
  const rows = list.map((p) => ({
    项目编号: p.code, 项目名称: p.name, 项目级别: p.level, 项目渠道: chs[p.channel_id],
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
  const user = currentUser(req);
  if (user.role === 'leader') return res.status(403).json({ error: '领导角色为只读查看权限，暂不开放全量导出' });
  const today = TODAY();
  const list = db.prepare('SELECT * FROM projects ORDER BY id').all().map((p) => enrichProject(p, today));
  const units = Object.fromEntries(db.prepare('SELECT id,short FROM units').all().map((u) => [u.id, u.short]));
  const chs = Object.fromEntries(db.prepare('SELECT id,name FROM channels').all().map((c) => [c.id, c.name]));
  const head = '项目编号,名称,层级,渠道类别,牵头单位,开始时间,结束时间,项目状态,预警,总经费(万元),历年支出(万元),年度预算,年度支出,里程碑进度,项目负责人';
  const cmap = { red: '红', yellow: '黄', blue: '蓝', green: '绿' };
  const lines = list.map((p) => [p.code, p.name, p.level, chs[p.channel_id], units[p.lead_unit_id], p.start, p.end, p.status, cmap[p.color], p.total_budget, p.spentAll, p.yearBudget, p.yearSpent, `${p.msDone}/${p.msTotal}`, p.team.owner].join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
  res.send('﻿' + head + '\n' + lines.join('\n'));
});

r.get('/projects/:id', (req, res) => {
  const today = TODAY();
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
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
  const postEval = null; // V19 本轮暂缓/删除后评价，接口保留字段但不再返回业务数据。
  const channel = db.prepare('SELECT * FROM channels WHERE id=?').get(p.channel_id);
  const unit = db.prepare('SELECT * FROM units WHERE id=?').get(p.lead_unit_id);
  res.json({
    ...proj,
    channelName: channel.name, channelFlow: J(channel.flow_json, []), channelFiling: J(channel.filing_json, []), channelAssess: J(channel.assess_json, []), unitName: unit.name, unitShort: unit.short,
    milestones, plans, funds, deliverables, packages, collaborators, approvals, changes, documents,
    postEval,
  });
});

// ---------- 驾驶舱 ----------
r.get('/dashboard', (req, res) => {
  const today = TODAY();
  const thisYear = Number(today.slice(0, 4));
  const { unit, level, year, channel } = req.query;
  let projects = db.prepare('SELECT * FROM projects').all().map((p) => enrichProject(p, today));
  if (unit) projects = projects.filter((p) => String(p.lead_unit_id) === String(unit));
  if (level) projects = projects.filter((p) => p.level === level);
  if (channel) projects = projects.filter((p) => String(p.channel_id) === String(channel));
  if (year) projects = projects.filter((p) => Number(p.start.slice(0, 4)) <= Number(year) && Number(p.end.slice(0, 4)) >= Number(year));

  const ids = new Set(projects.map((p) => p.id));
  const units = db.prepare("SELECT * FROM units WHERE kind='unit'").all();
  const channels = db.prepare('SELECT * FROM channels').all();

  const active = projects.filter((p) => ['实施中', '验收中'].includes(p.status));
  const fy = Number(year) || thisYear;
  const fundRows = db.prepare('SELECT * FROM funds WHERE year=?').all(fy).filter((f) => ids.has(f.project_id));
  const yearBudget = fundRows.reduce((s, f) => s + f.budget, 0);
  const yearSpent = fundRows.reduce((s, f) => s + f.spent, 0);

  const msAll = db.prepare('SELECT * FROM milestones').all().filter((m) => ids.has(m.project_id));
  const msColors = { red: 0, yellow: 0, blue: 0, green: 0 };
  msAll.forEach((m) => msColors[statusColor(m.due, m.done_at, today)]++);

  const delAll = db.prepare('SELECT * FROM deliverables').all().filter((d) => ids.has(d.project_id));
  const pkgs = db.prepare('SELECT * FROM packages').all().filter((k) => ids.has(k.project_id));
  const plans = db.prepare('SELECT * FROM plans').all().filter((p) => ids.has(p.project_id));
  const blacklist = db.prepare('SELECT COUNT(*) n FROM collaborators WHERE blacklisted=1').get().n;
  const totalBudgetRaw = projects.reduce((s, p) => s + p.total_budget, 0);
  const activeBudgetRaw = active.reduce((s, p) => s + p.total_budget, 0);
  const totalGrant = projects.reduce((s, p) => s + p.v19.centralGrant, 0);
  const totalSelf = projects.reduce((s, p) => s + p.v19.selfFund, 0);
  const totalInternal = projects.reduce((s, p) => s + p.v19.internalFund, 0);
  const activeGrant = active.reduce((s, p) => s + p.v19.centralGrant, 0);
  const activeSelf = active.reduce((s, p) => s + p.v19.selfFund, 0);
  const spentAll = projects.reduce((s, p) => s + p.v19.cumulativeSpent, 0);

  const kpis = {
    total: projects.length,
    active: active.length,
    totalBudget: Math.round(totalBudgetRaw / 100) / 100, // 亿元
    yearBudget: Math.round(yearBudget), yearSpent: Math.round(yearSpent),
    execRate: yearBudget ? Math.round((yearSpent / yearBudget) * 100) : 0,
    totalExecRate: totalBudgetRaw ? Math.round((spentAll / totalBudgetRaw) * 100) : 0,
    red: projects.filter((p) => p.color === 'red').length,
    yellow: projects.filter((p) => p.color === 'yellow').length,
    deliverables: delAll.filter((d) => d.delivered_at).length,
    packagesDone: pkgs.filter((k) => k.status === '已完成').length,
    blacklist,
    pendingApprovals: db.prepare("SELECT COUNT(*) n FROM approvals WHERE status='审批中'").get().n,
  };

  const byLevel = ['国家级', '地方级', '公司级'].map((lv) => ({
    level: lv,
    count: projects.filter((p) => p.level === lv).length,
    budget: Math.round(projects.filter((p) => p.level === lv).reduce((s, p) => s + p.total_budget, 0)),
  }));

  const byUnit = units.map((u) => {
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

  const unitLevelMatrix = units.map((u) => {
    const ps = projects.filter((p) => p.lead_unit_id === u.id);
    return {
      unit: u.short,
      国家级: ps.filter((p) => p.level === '国家级').length,
      地方级: ps.filter((p) => p.level === '地方级').length,
      公司级: ps.filter((p) => p.level === '公司级').length,
      active: ps.filter((p) => ['实施中', '验收中'].includes(p.status)).length,
      accepted: ps.filter((p) => p.status === '已验收').length,
    };
  }).filter((x) => LEVELS.some((lv) => x[lv] > 0));

  const byChannel = channels.map((c) => ({ channel: c.name, key: c.key, level: c.level, count: projects.filter((p) => p.channel_id === c.id).length }))
    .filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

  const years = [thisYear - 4, thisYear - 3, thisYear - 2, thisYear - 1, thisYear];
  const fundsTrend = years.map((y) => {
    const rowsY = db.prepare('SELECT * FROM funds WHERE year=?').all(y).filter((f) => ids.has(f.project_id));
    return { year: y, budget: Math.round(rowsY.reduce((s, f) => s + f.budget, 0)), spent: Math.round(rowsY.reduce((s, f) => s + f.spent, 0)) };
  });

  const statusDist = ['申报中', '立项中', '实施中', '验收中', '已验收', '已终止'].map((s) => ({ status: s, count: projects.filter((p) => p.status === s).length })).filter((x) => x.count > 0);

  const delTypes = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果'];
  const delivByType = delTypes.map((t) => ({
    type: t,
    delivered: delAll.filter((d) => d.type === t && d.delivered_at).length,
    pending: delAll.filter((d) => d.type === t && !d.delivered_at).length,
  }));

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
  risks.sort((a, b) => (a.color === b.color ? a.days - b.days : a.color === 'red' ? -1 : 1));

  const colorDist = ['red', 'yellow', 'blue', 'green'].map((c) => ({ color: c, count: projects.filter((p) => p.color === c).length }));

  res.json({
    today, kpis, byLevel, byUnit, unitLevelMatrix, byChannel, fundsTrend, statusDist,
    delivByType, transform, transformSummary, modelTransform: Array.from(modelMap.values()).sort((a, b) => b.count - a.count),
    planStats, fundStructure, risks: risks.slice(0, 12), colorDist, msColors,
  });
});

// ---------- 预警 ----------
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
  if (user.scope !== 'hq') {
    const visible = new Set(scopeProjects(user, db.prepare('SELECT * FROM projects').all()).map((p) => p.id));
    rows = rows.filter((a) => !a.project_id || visible.has(a.project_id));
  }
  res.json(rows);
});

// ---------- 审批 ----------
function mapApproval(a) {
  const p = a.project_id ? db.prepare('SELECT name, code FROM projects WHERE id=?').get(a.project_id) : null;
  return { ...a, steps: J(a.steps_json, []), payload: J(a.payload_json, {}), projectName: p?.name, projectCode: p?.code };
}
r.get('/approvals', (req, res) => {
  const user = currentUser(req);
  let rows = db.prepare("SELECT * FROM approvals WHERE type<>'post_eval' ORDER BY created_at DESC").all().map(mapApproval);
  const { mine, status } = req.query;
  if (status) rows = rows.filter((a) => a.status === status);
  if (mine === '1') {
    rows = rows.filter((a) => {
      if (a.status !== '审批中') return false;
      const step = a.steps[a.current_step];
      if (!step) return false;
      if (user.role === 'mgmt' && user.scope === 'hq') return step.title.includes('总部') || step.title.includes('科研项目处') || step.title.includes('拨付执行');
      if (user.role === 'chief') return step.assignee === user.name || step.title.includes('总师');
      if (user.role === 'finance') return step.title.includes('财务') && a.unit_id === user.unit_id;
      if (user.role === 'team') return step.assignee === user.name || a.initiator === user.name;
      return false;
    });
  } else if (user.scope !== 'hq' && user.role !== 'admin') {
    rows = rows.filter((a) => a.unit_id === user.unit_id || a.initiator === user.name || a.steps.some((s) => s.assignee === user.name));
  }
  res.json(rows);
});

r.post('/approvals/:id/act', (req, res) => {
  const user = currentUser(req);
  const { action, comment } = req.body || {};
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '流程已办结' });
  const steps = J(a.steps_json, []);
  const idx = a.current_step;
  const now = TODAY();
  if (action === 'approve') {
    steps[idx] = { ...steps[idx], status: 'approved', at: now, comment: comment || '同意。', actor: user.name };
    let newStatus = a.status, newIdx = idx + 1;
    if (newIdx >= steps.length) {
      newStatus = '已通过';
      newIdx = steps.length - 1;
      applyApprovalEffect(a, user);
    } else {
      steps[newIdx] = { ...steps[newIdx], status: 'current' };
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
  res.json(mapApproval(db.prepare('SELECT * FROM approvals WHERE id=?').get(a.id)));
});

function applyApprovalEffect(a, user) {
  const payload = J(a.payload_json, {});
  if (!a.project_id) return;
  if (a.type === 'declaration') {
    db.prepare("UPDATE projects SET status='立项中' WHERE id=? AND status='申报中'").run(a.project_id);
  } else if (a.type === 'filing') {
    db.prepare("UPDATE projects SET status='实施中' WHERE id=? AND status IN ('申报中','立项中')").run(a.project_id);
  } else if (a.type === 'acceptance') {
    // 验收办结：状态流转 + 记录办结日期（协作评价 30 日倒计时锚点）
    db.prepare("UPDATE projects SET status='已验收', accepted_at=? WHERE id=?").run(TODAY(), a.project_id);
  } else if (a.type === 'baseinfo' && payload.fields) {
    const f = payload.fields;
    if (f.goal != null) db.prepare('UPDATE projects SET goal=? WHERE id=?').run(String(f.goal).slice(0, 300), a.project_id);
    if (f.yearGoal != null) db.prepare('UPDATE projects SET year_goal=? WHERE id=?').run(String(f.yearGoal).slice(0, 200), a.project_id);
    if (Array.isArray(f.partners)) db.prepare('UPDATE projects SET partners_json=? WHERE id=?').run(JSON.stringify(f.partners), a.project_id);
  } else if (a.type === 'milestone_close' && payload.milestone) {
    db.prepare('UPDATE milestones SET done_at=?, evidence=? WHERE project_id=? AND title=?').run(TODAY(), '佐证材料.pdf（审核通过）', a.project_id, payload.milestone);
  } else if (a.type === 'plan_finish' && payload.plan) {
    db.prepare("UPDATE plans SET status='已完成', done_at=? WHERE project_id=? AND title=?").run(TODAY(), a.project_id, payload.plan);
  } else if (a.type === 'change' && payload.category === '延期' && payload.target) {
    const m = db.prepare('SELECT * FROM milestones WHERE project_id=? AND title LIKE ?').get(a.project_id, `%${payload.target}%`);
    if (m) db.prepare('UPDATE milestones SET due=? WHERE id=?').run(addDays(m.due, 90), m.id);
    db.prepare("UPDATE changes SET status='已通过' WHERE project_id=? AND kind='项目变更' AND status='审批中'").run(a.project_id);
  } else if (a.type === 'data_change') {
    db.prepare("UPDATE changes SET status='已通过' WHERE project_id=? AND kind='数据变更' AND status='审批中'").run(a.project_id);
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
  const user = currentUser(req);
  const { to } = req.body || {};
  const a = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (a.status !== '审批中') return res.status(400).json({ error: '仅在途流程可转办' });
  if (!to || !String(to).trim()) return res.status(400).json({ error: '请填写转办对象' });
  const steps = J(a.steps_json, []);
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

// ---------- 申报 ----------
r.post('/declarations', (req, res) => {
  const user = currentUser(req);
  const { name, channelId, goal, budget, start, end, partners, materials, uploadId, milestones, deliverables, yearGoal } = req.body || {};
  if (!name || !channelId) return res.status(400).json({ error: '缺少项目名称或渠道' });
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(channelId);
  if (!ch) return res.status(400).json({ error: '渠道不存在' });
  const year = Number(TODAY().slice(0, 4));
  const n = db.prepare('SELECT COUNT(*) n FROM projects WHERE code LIKE ?').get(`KY-${year}-%`).n;
  const code = `KY-${year}-${String(n + 1).padStart(3, '0')}`;
  const team = { owner: user.name, tech: '', pm: '', chief1: '陈铁军', chief2: '蔡文渊', hqHead: '王建国', hqStaff: '何雨桐', unitDeptHead: '方致远', unitStaff: '田念慈', finHq: '金世安', finHead: '毕仲文', finStaff: '龚雪君' };
  const info = db.prepare(`INSERT INTO projects (code,wbs,name,goal,level,channel_id,lead_unit_id,partners_json,team_json,start,end,status,total_budget,tags_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(code, null, name, goal || '', ch.level, ch.id, user.unit_id || 1, JSON.stringify((partners || []).map((x) => ({ name: x, work: '' }))), JSON.stringify(team), start || TODAY(), end || `${year + 2}-12-31`, '申报中', Number(budget) || 0, JSON.stringify([ch.name]));
  const pid = info.lastInsertRowid;
  const chain = J(ch.approve_chain_json, []);
  const steps = chain.map((title, i) => ({ title, assignee: i === 0 ? user.name : '', status: i === 0 ? 'approved' : i === 1 ? 'current' : 'pending', at: i === 0 ? TODAY() : null, comment: i === 0 ? '发起申报。' : null }));
  const isFiling = ch.declare_mode === '报备';
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('declaration', `「${name}」${ch.name} ${isFiling ? '报备申签' : '申报审签'}`, pid, user.name, user.unit_id || 1, TODAY(), '审批中', 1, JSON.stringify(steps), JSON.stringify({ materials: materials || J(ch.declare_json, []), declareMode: ch.declare_mode }));
  for (const m of (materials || J(ch.declare_json, []))) {
    db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb) VALUES (?,?,?,?,?,?)').run(pid, '申报', `${m}.pdf`, TODAY(), user.name, 1024);
  }
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
  // 真实上传文件归档：关联项目 + 进入文档库（可下载）
  if (uploadId) {
    const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
    if (up) {
      db.prepare('UPDATE uploads SET project_id=? WHERE id=?').run(pid, up.id);
      db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb,file_path) VALUES (?,?,?,?,?,?,?)')
        .run(pid, '申报', up.orig_name, up.uploaded_at, up.uploader || user.name, up.size_kb, up.stored_name);
    }
  }
  audit(user.name, '发起申报', name, `渠道：${ch.name}，在线提交申报审签流程${uploadId ? '（含申报书原件归档 + AI 识读预填）' : ''}`);
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
    if (owner && [p.team.owner, p.team.tech, p.team.pm].some((x) => normalizeText(x) === normalizeText(owner))) { score += 8; hitFields.push('项目负责人/团队'); }
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

/** V19 新增：成果转化独立台账 */
r.get('/transformations', (req, res) => {
  const user = currentUser(req);
  const today = TODAY();
  const { status, mode, unit, kw } = req.query;
  let rows = db.prepare(`SELECT k.*, p.name pname, p.code pcode, p.level, p.status pstatus, u.short unitShort
    FROM packages k JOIN projects p ON p.id=k.project_id JOIN units u ON u.id=k.unit_id ORDER BY k.plan_date`).all();
  if (user.scope !== 'hq') {
    const visible = new Set(scopeProjects(user, db.prepare('SELECT * FROM projects').all()).map((p) => p.id));
    rows = rows.filter((k) => visible.has(k.project_id));
  }
  rows = rows.map((k) => ({
    ...k,
    color: packageColor(k, today),
    deliverableCount: db.prepare('SELECT COUNT(*) n FROM deliverables WHERE package_id=?').get(k.id).n,
    deliverables: db.prepare('SELECT name,type,delivered_at FROM deliverables WHERE package_id=?').all(k.id),
    target: transformationTarget(k),
  }));
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

function buildTransitionHeaderMap(headerLine, subHeaderLine = []) {
  const colByLabel = new Map();
  const maxCols = Math.max(headerLine.length, subHeaderLine.length, TRANSITION_FIELDS.length);
  for (let c = 0; c < maxCols; c += 1) {
    const labels = [headerLine[c], subHeaderLine[c]].map((x) => normalizeHeaderLabel(x)).filter(Boolean);
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

function transitionAlertColor(row) {
  const status = cellText(row.projectStatus || row.acceptanceStatus);
  if (status.includes('延期') || status.includes('逾期') || status.includes('问题')) return 'red';
  if (status.includes('验收中') || status.includes('立项中') || status.includes('临期')) return 'yellow';
  if (status.includes('已完成') || status.includes('已验收') || status.includes('已结题')) return 'green';
  return 'blue';
}

function normalizeTransitionRow(row) {
  const projectType = transitionProjectType(row);
  const sourceChannel = cellText(row.sourceChannel || row.channel);
  return {
    ...row,
    id: row.id || `TR-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
    sourceType: projectType,
    sourceSheet: projectType,
    projectType,
    code: row.code || row.serial || '',
    channel: sourceChannel,
    sourceChannel,
    leadWork: row.leadWork || [row.responsibleUnit, row.demandUnit].filter(Boolean).join(' / '),
    transformSummary: transitionTransformSummary(row),
    closedExecutionRate: row.closedExecutionRate || row.executionRate || '',
    budget2026Actual: row.budget2026Actual ?? '',
    budget2026Rate: row.budget2026Rate || '',
    color: row.color || transitionAlertColor(row),
    updatedBy: row.updatedBy || '汇总表维护人',
    updatedAt: row.updatedAt || TODAY(),
  };
}

function defaultTransitionRows() {
  const projects = db.prepare('SELECT p.*, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id ORDER BY p.id LIMIT 10').all().map((p) => enrichProject(p, TODAY()));
  return projects.map((p, i) => normalizeTransitionRow({
    id: `TR-${String(i + 1).padStart(3, '0')}`,
    serial: String(i + 1),
    code: p.code,
    level: p.level,
    sourceChannel: db.prepare('SELECT name FROM channels WHERE id=?').get(p.channel_id)?.name || '',
    projectType: `${p.v19.major1 || '科技创新'}专项`,
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
  }));
}

const transitionKey = 'transition.records.v19';
function canWriteTransition(user) {
  return user?.role === 'admin' || (user?.role === 'mgmt' && user?.scope === 'hq');
}

function ensureTransitionWriter(req, res) {
  const user = currentUser(req);
  if (!canWriteTransition(user)) {
    res.status(403).json({ error: '仅总部管理团队或授权管理员可维护表单数据' });
    return null;
  }
  return user;
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
  return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}

function transitionIdentity(input) {
  const row = normalizeTransitionRow(input);
  const name = normalizeKey(row.name);
  if (!name && cellText(row.serial)) return `serial:${normalizeKey(row.serial)}`;
  if (!name) return '';
  return `project:${[name, normalizeKey(row.sourceChannel), normalizeKey(row.responsibleUnit)].join('|')}`;
}

function upsertTransitionRecord(input, batchId = null) {
  const row0 = normalizeTransitionRow(input);
  const identity = transitionIdentity(row0) || `id:${normalizeKey(row0.id)}`;
  const existing = db.prepare('SELECT id FROM transition_records WHERE identity_key=?').get(identity);
  const row = normalizeTransitionRow({ ...row0, id: existing?.id || row0.id });
  db.prepare(`INSERT INTO transition_records
    (id,identity_key,project_type,project_name,source_file,source_excel_sheet,source_row,updated_by,updated_at,batch_id,row_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(identity_key) DO UPDATE SET
      project_type=excluded.project_type,
      project_name=excluded.project_name,
      source_file=excluded.source_file,
      source_excel_sheet=excluded.source_excel_sheet,
      source_row=excluded.source_row,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at,
      batch_id=excluded.batch_id,
      row_json=excluded.row_json`)
    .run(row.id, identity, transitionProjectType(row), row.name || '', row.sourceFile || '', row.sourceExcelSheet || '', row.sourceRow || null,
      row.updatedBy || '汇总表维护人', row.updatedAt || TODAY(), batchId, JSON.stringify(row));
  db.prepare(`INSERT INTO transition_type_owners (project_type,owner_name)
    VALUES (?,?) ON CONFLICT(project_type) DO NOTHING`)
    .run(transitionProjectType(row), row.updatedBy || '总部项目类型主管');
}

function getTransitionRows() {
  const stored = db.prepare('SELECT row_json FROM transition_records ORDER BY rowid').all();
  if (stored.length) return stored.map((x) => normalizeTransitionRow(J(x.row_json, {})));
  const raw = db.prepare('SELECT value FROM kv WHERE key=?').get(transitionKey)?.value;
  const legacy = raw ? J(raw, []).map((x) => normalizeTransitionRow(x)) : [];
  if (legacy.length) setTransitionRows(legacy);
  return legacy;
}

function setTransitionRows(rows) {
  const normalized = rows.map((x) => normalizeTransitionRow(x));
  db.transaction(() => {
    db.prepare('DELETE FROM transition_records').run();
    for (const row of normalized) upsertTransitionRecord(row, null);
    db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(transitionKey, JSON.stringify(normalized));
  })();
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

function transitionDiff(before, after) {
  const oldRow = before ? normalizeTransitionRow(before) : null;
  const nextRow = normalizeTransitionRow(after);
  return TRANSITION_FIELDS.flatMap((field) => {
    const nextValue = cellRawText(nextRow[field.code]);
    const oldValue = oldRow ? cellRawText(oldRow[field.code]) : '';
    if (!oldRow && !nextValue) return [];
    if (oldRow && oldValue === nextValue) return [];
    return [{
      code: field.code,
      field: field.label,
      before: oldValue,
      after: nextValue,
    }];
  });
}

function insertTransitionChangeLog({ batchId = null, row, action, userName, sourceFile = '', before = null }) {
  const normalized = normalizeTransitionRow(row);
  const diff = transitionDiff(before, normalized);
  if (action !== 'add' && diff.length === 0) return;
  db.prepare(`INSERT INTO transition_change_logs
    (batch_id,identity_key,project_type,project_name,action,changed_by,changed_at,diff_json,source_file)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(batchId, transitionIdentity(normalized) || normalized.id, transitionProjectType(normalized), normalized.name || '',
      action, userName || normalized.updatedBy || '表单维护人', TODAY(), JSON.stringify(diff), sourceFile || normalized.sourceFile || '');
}

function recentTransitionChangeLogs(limit = 60) {
  return db.prepare('SELECT * FROM transition_change_logs ORDER BY id DESC LIMIT ?').all(limit).map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    identityKey: row.identity_key,
    projectType: row.project_type,
    projectName: row.project_name,
    action: row.action,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    sourceFile: row.source_file,
    diff: J(row.diff_json, []),
  }));
}

function filterTransitionRows(rows, query = {}) {
  const text = (v) => normalizeKey(v);
  const kw = text(query.kw);
  const level = cellText(query.level);
  const channel = cellText(query.channel);
  const unit = cellText(query.unit);
  const status = cellText(query.status);
  const acceptanceStatus = cellText(query.acceptanceStatus);
  const color = cellText(query.color);
  const projectType = cellText(query.projectType);
  const startFrom = cellText(query.startFrom);
  const endTo = cellText(query.endTo);
  const budgetMin = cellNumber(query.budgetMin);
  const budgetMax = cellNumber(query.budgetMax);
  const transformStatus = cellText(query.transformStatus);
  return rows.map((x) => normalizeTransitionRow(x)).filter((row) => {
    if (projectType && transitionProjectType(row) !== projectType) return false;
    if (level && row.level !== level) return false;
    if (channel && cellText(row.sourceChannel || row.channel) !== channel) return false;
    if (unit && ![row.responsibleUnit, row.demandUnit, row.center].some((x) => cellText(x) === unit)) return false;
    if (status && cellText(row.projectStatus || row.acceptanceStatus) !== status) return false;
    if (acceptanceStatus && cellText(row.acceptanceStatus) !== acceptanceStatus) return false;
    if (color && row.color !== color) return false;
    if (startFrom && cellText(row.startMonth) && cellText(row.startMonth) < startFrom) return false;
    if (endTo && cellText(row.endMonth) && cellText(row.endMonth) > endTo) return false;
    const total = cellNumber(row.totalBudget);
    if (budgetMin != null && (total == null || total < budgetMin)) return false;
    if (budgetMax != null && (total == null || total > budgetMax)) return false;
    if (transformStatus) {
      const converted = cellNumber(row.convertedCount) || 0;
      const result = cellNumber(row.resultCount) || 0;
      if (transformStatus === '已转化' && converted <= 0) return false;
      if (transformStatus === '有成果未转化' && !(result > 0 && converted <= 0)) return false;
      if (transformStatus === '暂无成果' && result > 0) return false;
    }
    if (kw) {
      const hay = text([row.serial, row.code, row.name, row.projectType, row.sourceChannel, row.responsibleUnit, row.demandUnit].join(' '));
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function transitionFilterOptions(rows) {
  const vals = (fn, extras = []) => [...new Set([...extras, ...rows.map((r) => cellText(fn(normalizeTransitionRow(r)))).filter(Boolean)])];
  const dictionaries = transitionTemplateDictionaries();
  return {
    levels: vals((r) => r.level, LEVELS),
    channels: vals((r) => r.sourceChannel || r.channel, dictionaries.sourceChannels),
    units: vals((r) => r.responsibleUnit || r.demandUnit || r.center),
    statuses: vals((r) => r.projectStatus || r.acceptanceStatus, ['已完成', '进行中', '延期']),
    acceptanceStatuses: vals((r) => r.acceptanceStatus, ['单位级验收', '公司级验收', '机关验收', '未验收']),
    transformStatuses: ['已转化', '有成果未转化', '暂无成果'],
    colors: ['red', 'yellow', 'blue', 'green'],
  };
}

function previewTransitionMerge(existingRows, incomingRows, userName, mode = 'merge') {
  const baseRows = mode === 'replace' ? [] : existingRows.map((x) => normalizeTransitionRow(x));
  const index = new Map();
  for (const row of baseRows) {
    const key = transitionIdentity(row);
    if (key) index.set(key, row);
  }
  const batch = new Set();
  const rows = [];
  const errors = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  for (const input of incomingRows) {
    const row = normalizeTransitionRow({ ...input, updatedBy: userName, updatedAt: TODAY() });
    const key = transitionIdentity(row);
    const validation = validateTransitionRow(row);
    let action = index.has(key) ? 'update' : 'add';
    let issue = '';
    if (!key) {
      action = 'skip';
      issue = '缺少项目名称，无法生成项目唯一标识';
    } else if (batch.has(key)) {
      action = 'skip';
      issue = '同一批次内项目唯一性冲突，请保留一条记录后重新上传';
    } else if (!validation.ok) {
      action = 'skip';
      issue = validation.missing.concat(validation.warnings).join('；');
    }
    if (key) batch.add(key);
    if (action === 'add') added += 1;
    if (action === 'update') updated += 1;
    if (action === 'skip') {
      skipped += 1;
      invalid += 1;
      errors.push({ row: row.sourceRow || '', name: row.name || row.serial || '', issue });
    }
    rows.push({ row, key, action, validation, issue });
  }
  return {
    rows,
    report: {
      imported: incomingRows.length,
      added,
      updated,
      skipped,
      invalid,
      errors,
      subtables: transitionSubtables(baseRows.concat(rows.filter((x) => x.action !== 'skip').map((x) => x.row))),
    },
  };
}

function createTransitionBatch({ uploadId, fileName, mode, userName, parsed }) {
  const preview = previewTransitionMerge(getTransitionRows(), parsed.rows, userName, mode);
  const report = preview.report;
  const batchId = db.transaction(() => {
    const info = db.prepare(`INSERT INTO transition_import_batches
      (upload_id,file_name,mode,status,uploaded_by,uploaded_at,parsed_count,added_count,updated_count,skipped_count,invalid_count,report_json,issues_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uploadId, fileName, mode, report.invalid ? '待修正' : '待确认', userName, TODAY(), report.imported, report.added, report.updated,
        report.skipped, report.invalid, JSON.stringify(report), JSON.stringify(parsed.issues || []));
    const id = info.lastInsertRowid;
    const ins = db.prepare(`INSERT INTO transition_import_rows
      (batch_id,row_no,identity_key,project_type,project_name,action,row_json,validation_json,issue)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const item of preview.rows) {
      ins.run(id, item.row.sourceRow || null, item.key || '', transitionProjectType(item.row), item.row.name || '', item.action,
        JSON.stringify(item.row), JSON.stringify(item.validation), item.issue || '');
    }
    return id;
  })();
  return getTransitionBatch(batchId, true);
}

function mapTransitionBatch(row, withRows = false) {
  if (!row) return null;
  const batch = {
    ...row,
    report: J(row.report_json, {}),
    issues: J(row.issues_json, []),
  };
  delete batch.report_json;
  delete batch.issues_json;
  if (withRows) {
    batch.rows = db.prepare('SELECT * FROM transition_import_rows WHERE batch_id=? ORDER BY id').all(row.id).map((x) => ({
      id: x.id,
      rowNo: x.row_no,
      identityKey: x.identity_key,
      projectType: x.project_type,
      projectName: x.project_name,
      action: x.action,
      row: normalizeTransitionRow(J(x.row_json, {})),
      validation: J(x.validation_json, { ok: false, missing: [], warnings: [] }),
      issue: x.issue || '',
    }));
  }
  return batch;
}

function getTransitionBatch(id, withRows = false) {
  return mapTransitionBatch(db.prepare('SELECT * FROM transition_import_batches WHERE id=?').get(id), withRows);
}

function recentTransitionBatches() {
  return db.prepare('SELECT * FROM transition_import_batches ORDER BY id DESC LIMIT 8').all().map((x) => mapTransitionBatch(x));
}

function confirmTransitionBatch(batchId, userName) {
  const batch = db.prepare('SELECT * FROM transition_import_batches WHERE id=?').get(batchId);
  if (!batch) throw new Error('导入批次不存在');
  if (!['待确认', '待修正'].includes(batch.status)) throw new Error('该导入批次已处理，不能重复确认');
  if (batch.invalid_count > 0) throw new Error('该批次仍存在校验问题，请修正 Excel 后重新上传');
  const rows = db.prepare("SELECT * FROM transition_import_rows WHERE batch_id=? AND action IN ('add','update') ORDER BY id").all(batch.id);
  db.transaction(() => {
    if (batch.mode === 'replace') db.prepare('DELETE FROM transition_records').run();
    for (const r0 of rows) {
      const row = normalizeTransitionRow({ ...J(r0.row_json, {}), updatedBy: userName, updatedAt: TODAY() });
      const beforeRaw = db.prepare('SELECT row_json FROM transition_records WHERE identity_key=?').get(r0.identity_key || transitionIdentity(row));
      const before = beforeRaw ? J(beforeRaw.row_json, null) : null;
      upsertTransitionRecord(row, batch.id);
      insertTransitionChangeLog({
        batchId: batch.id,
        row,
        action: r0.action === 'update' ? 'update' : 'add',
        userName,
        sourceFile: batch.file_name,
        before,
      });
    }
    db.prepare("UPDATE transition_import_batches SET status='已入库', confirmed_by=?, confirmed_at=? WHERE id=?")
      .run(userName, TODAY(), batch.id);
    db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(transitionKey, JSON.stringify(getTransitionRows()));
  })();
  return getTransitionBatch(batch.id, true);
}

function transitionTemplatePath() {
  const candidates = [
    join(__dirname, '..', 'templates', TRANSITION_TEMPLATE_FILE),
    join(__dirname, '..', 'data', 'templates', TRANSITION_TEMPLATE_FILE),
    join(__dirname, '..', '..', '..', '需求跟进材料', TRANSITION_TEMPLATE_FILE),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function transitionTemplateDictionaries() {
  const template = transitionTemplatePath();
  if (!template) return { major1: [], major2: [], projectTypes: [], sourceChannels: [] };
  try {
    const wb = XLSX.read(readFileSync(template), { type: 'buffer', cellDates: false });
    const sheetByNameOrIndex = (names, index) => {
      for (const name of names) {
        if (wb.Sheets[name]) return wb.Sheets[name];
      }
      const fallbackName = wb.SheetNames[index];
      return fallbackName ? wb.Sheets[fallbackName] : null;
    };
    const colValues = (sheetNames, fallbackIndex, col = 0) => {
      const ws = sheetByNameOrIndex(sheetNames, fallbackIndex);
      if (!ws) return [];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
      return [...new Set(aoa.map((r) => cellText(r[col])).filter(Boolean))];
    };
    return {
      major1: colValues(['一级专业'], 1),
      major2: colValues(['二级专业'], 2),
      projectTypes: colValues(['sheet4', '项目类型'], 3, 0),
      sourceChannels: colValues(['sheet4', '项目类型'], 3, 5),
    };
  } catch {
    return { major1: [], major2: [], projectTypes: [], sourceChannels: [] };
  }
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
  const rowOpen = rowMatch?.[0].match(/^<row\b([^>]*)>/)?.[1] || ` spans="1:${TRANSITION_FIELDS.length}" ht="25" customHeight="1"`;
  const rowAttrs = rowOpen
    .replace(/\sr="6"/, '')
    .replace(/\sspans="[^"]*"/, ` spans="1:${TRANSITION_FIELDS.length}"`)
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
  const lastCol = colName(TRANSITION_FIELDS.length - 1);
  const { rowAttrs, styles } = templateRowStyle(sheetXml);
  const headerRows = [...sheetXml.matchAll(/<row\b[^>]*\br="([1-5])"[^>]*>[\s\S]*?<\/row>/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => m[0])
    .join('');
  const dataRows = rows.map((row, i) => transitionRowXml(i + 6, row, rowAttrs, styles)).join('');
  let next = sheetXml.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:${lastCol}${lastRow}"/>`);
  next = next.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRows}${dataRows}</sheetData>`);
  next = next.replace(/<autoFilter\b([^>]*)\bref="[^"]+"/, `<autoFilter$1ref="A4:${lastCol}${lastRow}"`);
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

async function makeTransitionTemplateWorkbook(rows) {
  const template = transitionTemplatePath();
  if (!template) throw new Error(`未找到导出模板：${TRANSITION_TEMPLATE_FILE}`);
  const zip = await JSZip.loadAsync(readFileSync(template));
  const sheet1Path = 'xl/worksheets/sheet1.xml';
  const workbookPath = 'xl/workbook.xml';
  const relsPath = 'xl/_rels/workbook.xml.rels';
  const typesPath = '[Content_Types].xml';
  const baseSheetXml = await zip.file(sheet1Path).async('string');
  zip.file(sheet1Path, replaceTemplateSheetData(baseSheetXml, rows));

  let workbookXml = await zip.file(workbookPath).async('string');
  let relsXml = await zip.file(relsPath).async('string');
  let typesXml = await zip.file(typesPath).async('string');
  let relId = nextRelationshipId(relsXml);
  let sheetId = nextSheetId(workbookXml);
  let sheetNo = 4;
  const used = new Set(['Sheet1', 'Sheet2', 'Sheet3']);
  for (const table of transitionSubtables(rows)) {
    const part = rows.filter((x) => transitionProjectType(x) === table.name);
    if (!part.length) continue;
    const sheetName = uniqueSheetName(table.name, used);
    const path = `xl/worksheets/sheet${sheetNo}.xml`;
    zip.file(path, replaceTemplateSheetData(baseSheetXml, part));
    workbookXml = workbookXml.replace('</sheets>', `<sheet name="${xmlAttrEscape(sheetName)}" sheetId="${sheetId}" r:id="rId${relId}"/></sheets>`);
    relsXml = relsXml.replace('</Relationships>', `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNo}.xml"/></Relationships>`);
    typesXml = typesXml.replace('</Types>', `<Override PartName="/xl/worksheets/sheet${sheetNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    relId += 1;
    sheetId += 1;
    sheetNo += 1;
  }
  zip.file(workbookPath, workbookXml);
  zip.file(relsPath, relsXml);
  zip.file(typesPath, typesXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function makeTransitionValidationWorkbook(rows, batches = [], changeLogs = recentTransitionChangeLogs(500)) {
  const reportRows = rows.map((row, i) => {
    const validation = validateTransitionRow(row);
    return {
      序号: row.serial || i + 1,
      项目类型: transitionProjectType(row),
      项目名称: row.name || '',
      责任单位: row.responsibleUnit || '',
      更新时间: row.updatedAt || '',
      更新人员: row.updatedBy || '',
      校验结果: validation.ok ? '通过' : '不通过',
      问题说明: validation.missing.concat(validation.warnings).join('；'),
    };
  });
  const batchRows = batches.map((b) => ({
    批次号: b.id,
    文件名: b.file_name,
    状态: b.status,
    上传人: b.uploaded_by,
    上传时间: b.uploaded_at,
    确认人: b.confirmed_by || '',
    确认时间: b.confirmed_at || '',
    解析行数: b.parsed_count,
    新增: b.added_count,
    更新: b.updated_count,
    跳过: b.skipped_count,
    问题行: b.invalid_count,
  }));
  const changeRows = changeLogs.flatMap((log) => {
    const diffs = log.diff?.length ? log.diff : [{ field: '', before: '', after: '' }];
    return diffs.map((d) => ({
      批次号: log.batchId || '',
      动作: log.action === 'add' ? '新增' : log.action === 'manual' ? '手工维护' : '更新',
      项目类型: log.projectType || '',
      项目名称: log.projectName || '',
      字段名: d.field || '',
      变更前: d.before || '',
      变更后: d.after || '',
      操作人: log.changedBy || '',
      操作时间: log.changedAt || '',
      来源文件: log.sourceFile || '',
    }));
  });
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(reportRows.length ? reportRows : [{ 校验结果: '当前暂无台账记录' }]);
  ws1['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, ws1, '记录校验报告');
  const ws2 = XLSX.utils.json_to_sheet(batchRows.length ? batchRows : [{ 状态: '暂无导入批次' }]);
  ws2['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, '导入批次');
  const ws3 = XLSX.utils.json_to_sheet(changeRows.length ? changeRows : [{ 状态: '暂无变更明细' }]);
  ws3['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, ws3, '变更明细');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function safeZipName(name) {
  return safeSheetName(name).replace(/[<>:"/\\|?*]/g, '').slice(0, 80) || '未分类';
}

async function makeTransitionExportPackage(rows) {
  const zip = new JSZip();
  zip.file('01-最新总表.xlsx', await makeTransitionTemplateWorkbook(rows));
  for (const table of transitionSubtables(rows)) {
    const part = rows.filter((x) => transitionProjectType(x) === table.name);
    if (!part.length) continue;
    zip.file(`02-专项分表/${safeZipName(table.name)}.xlsx`, await makeTransitionTemplateWorkbook(part));
  }
  zip.file('03-校验报告.xlsx', makeTransitionValidationWorkbook(rows, recentTransitionBatches(), recentTransitionChangeLogs(500)));
  return zip.generateAsync({ type: 'nodebuffer' });
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
    const raw = cells[columnMap?.get(f.code) ?? f.index];
    row[f.code] = f.number ? cellNumber(raw) : cellRawText(raw);
    row.raw[f.label] = row[f.code];
  }
  return normalizeTransitionRow(row);
}

function parseTransitionWorkbook(storedPath, sourceFile, userName) {
  const wb = XLSX.read(readFileSync(storedPath), { type: 'buffer', cellDates: false });
  const parsedSheets = [];
  const issues = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
    const headerIndex = aoa.findIndex((line) => line.some((x) => cellText(x) === '项目类型') && line.some((x) => cellText(x) === '项目名称'));
    if (headerIndex < 0) {
      if (!['Sheet2', 'Sheet3'].includes(sheetName)) issues.push({ sheet: sheetName, row: 0, issue: '未识别到“项目类型/项目名称”表头，已跳过该工作表' });
      continue;
    }
    const sheetRows = [];
    const subHeaderLine = aoa[headerIndex + 1] || [];
    const { map: columnMap, missing } = buildTransitionHeaderMap(aoa[headerIndex] || [], subHeaderLine);
    if (missing.length) issues.push({ sheet: sheetName, row: headerIndex + 1, issue: `表头缺少必要字段：${missing.join('、')}` });
    const dataStart = headerIndex + 2;
    for (let i = dataStart; i < aoa.length; i += 1) {
      const cells = aoa[i] || [];
      if (!isTransitionDataRow(cells, columnMap)) continue;
      sheetRows.push(transitionRowFromCells(cells, i + 1, sourceFile, sheetName, userName, columnMap));
    }
    parsedSheets.push({ sheetName, rows: sheetRows });
  }
  const primary = parsedSheets.find((x) => x.sheetName === 'Sheet1' && x.rows.length);
  if (primary) return { rows: primary.rows, issues: issues.filter((x) => x.sheet === 'Sheet1') };
  return { rows: parsedSheets.flatMap((x) => x.rows), issues };
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
  const value = normalizeTransitionRow(row)[field.code];
  if (field.number) return value == null ? '' : Number(value);
  return cellRawText(value);
}

function makeTransitionSheet(rows, title) {
  const groupRow = TRANSITION_FIELDS.map((f, i) => (i === 0 || TRANSITION_FIELDS[i - 1].group !== f.group ? f.group : ''));
  const headerRow = TRANSITION_FIELDS.map((f) => f.label);
  const subHeaderRow = TRANSITION_FIELDS.map(() => '');
  const body = rows.map((row) => TRANSITION_FIELDS.map((f) => exportTransitionValue(row, f)));
  const ws = XLSX.utils.aoa_to_sheet([[title], groupRow, headerRow, subHeaderRow, ...body]);
  ws['!cols'] = TRANSITION_FIELDS.map((f) => ({ wch: f.width || 14 }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: TRANSITION_FIELDS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
    { s: { r: 1, c: 17 }, e: { r: 1, c: 27 } },
    { s: { r: 1, c: 28 }, e: { r: 1, c: 36 } },
  ];
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
  const rows = getTransitionRows();
  const enriched = rows.map((x) => ({ ...x, validation: validateTransitionRow(x) }));
  const invalid = enriched.filter((x) => !x.validation.ok).length;
  const changeLogs = recentTransitionChangeLogs();
  res.json({
    fields: TRANSITION_FIELDS,
    dictionaries: transitionTemplateDictionaries(),
    filterOptions: transitionFilterOptions(rows),
    rows: enriched,
    subtables: transitionSubtables(rows),
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
    batches: recentTransitionBatches(),
    changeLogs,
    railDesign: {
      autoLedger: [
        '立项备案与项目基本信息自动回写项目台账',
        '年度里程碑、CMOS计划、经费抓取、验收归档自动归集',
        '交付物、成果转化、协作单位评价形成正式台账字段',
      ],
      formMaintenance: [
        '总部上传总表并按项目类型拆分专项分表',
        '项目类型主管维护分表后批量上传',
        '预校验通过并确认上传后更新临时总表与历史迁移库',
      ],
    },
    workflow: ['上传文件', '系统解析', '预校验', '上传人确认', '建档入库'],
    pending: ['项目类型主管正式授权范围', '与正式项目库的批量迁移规则', '安全审查、病毒查杀和备份策略'],
  });
});

r.post('/transition-tool/records', (req, res) => {
  const user = ensureTransitionWriter(req, res);
  if (!user) return;
  const row = normalizeTransitionRow(req.body || {});
  const rows = getTransitionRows();
  const id = row.id || `TR-${String(rows.length + 1).padStart(3, '0')}`;
  const next = normalizeTransitionRow({ ...row, id, updatedBy: user.name, updatedAt: TODAY() });
  const validation = validateTransitionRow(next);
  if (!validation.ok) return res.status(400).json({ error: validation.missing.concat(validation.warnings).join('；') });
  const identity = transitionIdentity(next);
  const beforeRaw = identity ? db.prepare('SELECT row_json FROM transition_records WHERE identity_key=?').get(identity) : null;
  const before = beforeRaw ? J(beforeRaw.row_json, null) : null;
  upsertTransitionRecord(next, null);
  insertTransitionChangeLog({ row: next, action: before ? 'manual' : 'add', userName: user.name, before });
  audit(user.name, '表单维护', '分表维护', `保存 ${next.projectType || '专项分表'}：${next.name || next.code}`);
  res.json({ ok: true, row: { ...next, validation } });
});

r.post('/transition-tool/import-demo', (req, res) => {
  const user = ensureTransitionWriter(req, res);
  if (!user) return;
  const rows = defaultTransitionRows();
  setTransitionRows(rows);
  audit(user.name, '表单维护', '批量导入', `按样例表字段口径导入演示数据 ${rows.length} 行`);
  res.json({ ok: true, imported: rows.length });
});

r.post('/transition-tool/import-upload', (req, res) => {
  const user = ensureTransitionWriter(req, res);
  if (!user) return;
  const uploadId = req.body?.uploadId;
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const up = db.prepare('SELECT * FROM uploads WHERE id=?').get(uploadId);
  if (!up) return res.status(404).json({ error: '上传文件不存在，请重新上传' });
  const ext = extname(up.orig_name).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) return res.status(400).json({ error: '仅支持上传 .xlsx / .xls 表格文件' });
  const storedPath = join(UPLOAD_DIR, up.stored_name);
  if (!existsSync(storedPath)) return res.status(410).json({ error: '上传文件已被清理，请重新上传' });
  const parsed = parseTransitionWorkbook(storedPath, up.orig_name, user.name);
  if (!parsed.rows.length) return res.status(400).json({ error: parsed.issues[0]?.issue || '未解析到有效项目记录' });
  const batch = createTransitionBatch({ uploadId: up.id, fileName: up.orig_name, mode, userName: user.name, parsed });
  audit(user.name, '表单维护', '上传预校验', `${up.orig_name}：解析 ${batch.parsed_count} 行，待新增 ${batch.added_count} 行，待更新 ${batch.updated_count} 行，问题 ${batch.invalid_count} 行`);
  res.json({ ok: true, batch, batchId: batch.id, file: up.orig_name, mode, status: batch.status, issues: batch.issues, ...batch.report, rows: batch.rows });
});

r.get('/transition-tool/import-batches/:id', (req, res) => {
  const batch = getTransitionBatch(Number(req.params.id), true);
  if (!batch) return res.status(404).json({ error: '导入批次不存在' });
  res.json({ batch });
});

r.post('/transition-tool/import-batches/:id/confirm', (req, res) => {
  const user = ensureTransitionWriter(req, res);
  if (!user) return;
  try {
    const batch = confirmTransitionBatch(Number(req.params.id), user.name);
    audit(user.name, '表单维护', '确认入库', `${batch.file_name}：新增 ${batch.added_count} 行，更新 ${batch.updated_count} 行`);
    res.json({ ok: true, batch });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

r.post('/transition-tool/import-batches/:id/cancel', (req, res) => {
  const user = ensureTransitionWriter(req, res);
  if (!user) return;
  const batch = db.prepare('SELECT * FROM transition_import_batches WHERE id=?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: '导入批次不存在' });
  if (!['待确认', '待修正'].includes(batch.status)) return res.status(400).json({ error: '该批次已处理，不能取消' });
  db.prepare("UPDATE transition_import_batches SET status='已取消', confirmed_by=?, confirmed_at=? WHERE id=?").run(user.name, TODAY(), batch.id);
  audit(user.name, '表单维护', '取消导入', batch.file_name, '上传预校验批次未入库，已取消');
  res.json({ ok: true });
});

r.get('/transition-tool/export.xlsx', async (req, res, next) => {
  try {
    const rows = filterTransitionRows(getTransitionRows(), req.query);
    const buf = await makeTransitionTemplateWorkbook(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="transition-v19-template-${TODAY()}.xlsx"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

r.get('/transition-tool/export-package.zip', async (req, res, next) => {
  try {
    const rows = filterTransitionRows(getTransitionRows(), req.query);
    const buf = await makeTransitionExportPackage(rows);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="transition-v19-package-${TODAY()}.zip"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// ---------- 项目业务动作：基本信息补充 / 立项备案 / 验收 / 评估检查 ----------
function newApproval({ type, title, project, initiator, stepTitles, payload = {} }) {
  const steps = stepTitles.map((t, i) => ({
    title: t, assignee: i === 0 ? initiator : '',
    status: i === 0 ? 'approved' : i === 1 ? 'current' : 'pending',
    at: i === 0 ? TODAY() : null,
    comment: i === 0 ? '提交发起。' : null,
  }));
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(type, title, project.id, initiator, project.lead_unit_id, TODAY(), '审批中', Math.min(1, steps.length - 1), JSON.stringify(steps), JSON.stringify(payload));
}

/** 项目基本信息补充填报（审批通过后回写台账） */
r.post('/projects/:id/baseinfo', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { goal, yearGoal, partners } = req.body || {};
  newApproval({
    type: 'baseinfo', title: `「${p.name}」项目基本信息补充建档`, project: p, initiator: user.name,
    stepTitles: ['项目团队填写', '项目负责人审核', '单位科技管理部审核', '单位分管领导复核', '总部科研项目处'],
    payload: { fields: { goal, yearGoal, partners } },
  });
  audit(user.name, '基本信息填报', p.name, '补充缺失字段，提交二级单位内部审核');
  res.json({ ok: true });
});

/** 立项备案（上传盖章版立项佐证，提交总部归档；通过后项目转实施中） */
r.post('/projects/:id/filing', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT p.*, c.filing_json, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id WHERE p.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (p.status !== '立项中') return res.status(400).json({ error: '仅「立项中」项目可提交立项备案' });
  const materials = req.body?.materials || J(p.filing_json, []);
  newApproval({
    type: 'filing', title: `「${p.name}」立项备案`, project: p, initiator: user.name,
    stepTitles: ['项目团队上传立项材料', '单位科技管理部审核', '总部科研项目处备案'],
    payload: { materials },
  });
  for (const m of materials) {
    db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb) VALUES (?,?,?,?,?,?)').run(p.id, '立项', `${m}(盖章版).pdf`, TODAY(), user.name, 1200);
  }
  audit(user.name, '立项备案', p.name, `上传 ${materials.length} 项立项佐证，提交总部备案归档`);
  res.json({ ok: true });
});

/** 验收前置强校验：里程碑闭环 / 交付物已交付 / 经费核销 */
function acceptPrecheck(pid) {
  const openMs = db.prepare('SELECT title FROM milestones WHERE project_id=? AND done_at IS NULL').all(pid);
  const openDel = db.prepare('SELECT name FROM deliverables WHERE project_id=? AND delivered_at IS NULL').all(pid);
  const funds = db.prepare('SELECT * FROM funds WHERE project_id=?').all(pid);
  const unsettled = funds.filter((f) => f.spent > 0 && J(f.writeoffs_json, []).length === 0);
  return {
    ok: openMs.length === 0 && openDel.length === 0 && unsettled.length === 0,
    checks: [
      { label: '全部里程碑闭环销项', pass: openMs.length === 0, detail: openMs.length ? `${openMs.length} 个节点未闭环：${openMs.map((m) => m.title).slice(0, 3).join('、')}${openMs.length > 3 ? '…' : ''}` : '已全部闭环' },
      { label: '核心交付物全部交付', pass: openDel.length === 0, detail: openDel.length ? `${openDel.length} 项未交付：${openDel.map((d) => d.name).slice(0, 3).join('、')}${openDel.length > 3 ? '…' : ''}` : '已全部交付' },
      { label: '节点经费匹配核销完毕', pass: unsettled.length === 0, detail: unsettled.length ? `${unsettled.map((f) => f.year).join('、')} 年度支出未上传付款凭证核销` : '历年支出均有核销凭证' },
    ],
  };
}
r.get('/projects/:id/accept-precheck', (req, res) => res.json(acceptPrecheck(Number(req.params.id))));

r.post('/projects/:id/accept-request', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!['实施中', '验收中'].includes(p.status)) return res.status(400).json({ error: '当前状态不可发起验收' });
  const pre = acceptPrecheck(p.id);
  if (!pre.ok) return res.status(400).json({ error: '前置条件未满足，无法提交验收申请', checks: pre.checks });
  const stepTitles = ['项目团队提交验收申请', '二级单位管理团队初审'];
  if (p.level === '国家级') stepTitles.push('责任总师技术复核');
  stepTitles.push('总部管理团队终审');
  newApproval({
    type: 'acceptance', title: `「${p.name}」${p.level === '公司级' ? '公司级' : p.level === '地方级' ? '属地' : '国家级'}验收申请`, project: p, initiator: user.name,
    stepTitles, payload: { level: p.level, tiers: req.body?.tiers || [] },
  });
  db.prepare("UPDATE projects SET status='验收中' WHERE id=?").run(p.id);
  db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb) VALUES (?,?,?,?,?,?)').run(p.id, '验收', '验收申请书.pdf', TODAY(), user.name, 1500);
  audit(user.name, '发起验收', p.name, `前置校验通过（里程碑/交付物/经费核销），进入${p.level}分级验收流程`);
  res.json({ ok: true });
});

/** 评估检查：按渠道类型发起线上申请，结论材料归档 */
r.post('/projects/:id/assessments', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT p.*, c.assess_json, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id WHERE p.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const types = J(p.assess_json, []);
  const atype = req.body?.atype || types[0];
  if (!atype) return res.status(400).json({ error: '该渠道无评估检查要求' });
  newApproval({
    type: 'assessment', title: `「${p.name}」${atype}申请`, project: p, initiator: user.name,
    stepTitles: ['项目团队填报评估材料', '二级单位主管部门初审', '总部管理部门终审'],
    payload: { atype, note: req.body?.note || '' },
  });
  db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb) VALUES (?,?,?,?,?,?)').run(p.id, '实施', `${atype}材料.pdf`, TODAY(), user.name, ri1200());
  audit(user.name, '评估检查申请', p.name, `${p.cname} · ${atype}`);
  res.json({ ok: true });
});
const ri1200 = () => 800 + Math.floor(Math.random() * 4000);

/** 成果转化：新建成果包（仅「已交付」交付物可纳入，强校验） */
r.post('/projects/:id/packages', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { name, deliverableIds, mode, form, planDate, brief } = req.body || {};
  if (!name || !Array.isArray(deliverableIds) || deliverableIds.length === 0) return res.status(400).json({ error: '请填写成果包名称并选择交付物' });
  const rows = deliverableIds.map((id) => db.prepare('SELECT * FROM deliverables WHERE id=? AND project_id=?').get(id, p.id)).filter(Boolean);
  const undelivered = rows.filter((dRow) => !dRow.delivered_at);
  if (undelivered.length) return res.status(400).json({ error: `仅「已交付」交付物可纳入成果包：${undelivered.map((x) => x.name).join('、')} 未交付` });
  const n = db.prepare('SELECT COUNT(*) n FROM packages').get().n;
  const code = `CG-${TODAY().slice(0, 4)}-${String(n + 1).padStart(3, '0')}`;
  const info = db.prepare('INSERT INTO packages (code,name,project_id,mode,form,plan_date,actual_date,status,brief,detail,unit_id) VALUES (?,?,?,?,?,?,NULL,?,?,?,?)')
    .run(code, name, p.id, mode || '向型号转化', form || '未装机', planDate || addDays(TODAY(), 180), '未启动', brief || '', '', p.lead_unit_id);
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
  const m = db.prepare('SELECT m.*, p.name pname FROM milestones m JOIN projects p ON p.id=m.project_id WHERE m.id=?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'not found' });
  const evidence = (req.body && req.body.evidence) || '完成佐证材料.pdf';
  db.prepare('UPDATE milestones SET done_at=?, evidence=? WHERE id=?').run(TODAY(), evidence, m.id);
  db.prepare("DELETE FROM alerts WHERE project_id=? AND kind='里程碑' AND title LIKE ?").run(m.project_id, `%${m.title}%`);
  audit(user.name, '里程碑销项', m.pname, `「${m.title}」上传佐证并闭环销项`);
  res.json({ ok: true });
});

r.post('/plans/:id/finish', (req, res) => {
  const user = currentUser(req);
  const p = db.prepare('SELECT pl.*, pr.name pname, pr.lead_unit_id FROM plans pl JOIN projects pr ON pr.id=pl.project_id WHERE pl.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
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
  const { projectId, kind, category, detail, reason } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  db.prepare('INSERT INTO changes (project_id,kind,category,detail,reason,status,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, kind || '项目变更', category || '延期', detail || '', reason || '', '审批中', TODAY());
  const type = kind === '数据变更' ? 'data_change' : 'change';
  // 重大变更（外协单位更换/总经费调整/整体周期变更）强制联动法务部门审核
  const isMajor = type === 'change' && ['外协方', '经费', '周期'].includes(category);
  const stepTitles = type === 'change'
    ? (isMajor
      ? ['项目团队填报', '二级单位主管部门初审', '法务部门合规审核', '总部管理部门终审']
      : ['项目团队填报', '二级单位主管部门初审', '总部管理部门终审'])
    : ['项目团队填报', '二级单位内部审批', '总部科技主管确认'];
  const steps = stepTitles.map((title, i) => ({ title, assignee: i === 0 ? user.name : '', status: i === 0 ? 'approved' : i === 1 ? 'current' : 'pending', at: i === 0 ? TODAY() : null, comment: i === 0 ? '提交变更申请。' : null }));
  db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(type, `「${p.name}」${kind || '项目变更'}（${category}）`, p.id, user.name, p.lead_unit_id, TODAY(), '审批中', 1, JSON.stringify(steps), JSON.stringify({ category, target: detail }));
  audit(user.name, '发起变更', p.name, `${kind || '项目变更'}/${category}：${detail}`);
  res.json({ ok: true });
});

// ---------- 财务 ----------
r.get('/finance/:unitId', (req, res) => {
  const today = TODAY();
  const thisYear = Number(today.slice(0, 4));
  const uid = Number(req.params.unitId);
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
  const user = currentUser(req);
  const { projectId, year, amount, note } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: '请填写有效核销金额' });
  const y = Number(year) || Number(TODAY().slice(0, 4));
  let f = db.prepare('SELECT * FROM funds WHERE project_id=? AND year=?').get(p.id, y);
  if (!f) {
    db.prepare('INSERT INTO funds (project_id,year,budget,spent,writeoffs_json) VALUES (?,?,?,?,?)').run(p.id, y, 0, 0, '[]');
    f = db.prepare('SELECT * FROM funds WHERE project_id=? AND year=?').get(p.id, y);
  }
  const voucher = `沪财凭-${y}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  const wo = [...J(f.writeoffs_json, []), { date: TODAY(), amount: amt, voucher, note: note || '经费核销' }];
  db.prepare('UPDATE funds SET spent=spent+?, writeoffs_json=? WHERE id=?').run(amt, JSON.stringify(wo), f.id);
  audit(user.name, '经费核销', p.name, `${y} 年度核销 ${amt} 万元（凭证 ${voucher}），数据同步经费看板`);
  res.json({ ok: true, voucher });
});

/** 年度预算填报（绑定里程碑节点） */
r.post('/finance/budget', (req, res) => {
  const user = currentUser(req);
  const { projectId, year, budget, milestone } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!p) return res.status(400).json({ error: '项目不存在' });
  const b = Number(budget);
  if (b == null || b < 0) return res.status(400).json({ error: '请填写有效预算金额' });
  const y = Number(year) || Number(TODAY().slice(0, 4));
  const f = db.prepare('SELECT * FROM funds WHERE project_id=? AND year=?').get(p.id, y);
  if (f) db.prepare('UPDATE funds SET budget=? WHERE id=?').run(b, f.id);
  else db.prepare('INSERT INTO funds (project_id,year,budget,spent,writeoffs_json) VALUES (?,?,?,0,?)').run(p.id, y, b, '[]');
  audit(user.name, '预算填报', p.name, `${y} 年度预算 ${b} 万元${milestone ? `（绑定里程碑：${milestone}）` : ''}，经两级财务审核备案`);
  res.json({ ok: true });
});

r.get('/funding', (req, res) => {
  const thisYear = Number(TODAY().slice(0, 4));
  const pool = db.prepare('SELECT * FROM funding_pool ORDER BY year DESC').all();
  const quotas = db.prepare('SELECT q.*, u.short FROM funding_quota q JOIN units u ON u.id=q.unit_id WHERE q.year=?').all(thisYear);
  const requests = db.prepare('SELECT r.*, u.short FROM funding_requests r JOIN units u ON u.id=r.unit_id ORDER BY r.created_at DESC').all();
  res.json({ pool, quotas, requests, year: thisYear });
});

r.post('/funding/requests', (req, res) => {
  const user = currentUser(req);
  const { amount, purpose } = req.body || {};
  const thisYear = Number(TODAY().slice(0, 4));
  db.prepare('INSERT INTO funding_requests (year,unit_id,amount,purpose,status,created_at) VALUES (?,?,?,?,?,?)')
    .run(thisYear, user.unit_id || 2, Number(amount) || 0, purpose || '', '待审批', TODAY());
  audit(user.name, '拨付申请', `${amount}万元`, purpose);
  res.json({ ok: true });
});

r.post('/funding/requests/:id/act', (req, res) => {
  const user = currentUser(req);
  const { action } = req.body || {};
  const q = db.prepare('SELECT * FROM funding_requests WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'not found' });
  if (action === 'approve') {
    db.prepare("UPDATE funding_requests SET status='已拨付', decided_at=? WHERE id=?").run(TODAY(), q.id);
    db.prepare('UPDATE funding_quota SET paid=paid+? WHERE year=? AND unit_id=?').run(q.amount, q.year, q.unit_id);
    audit(user.name, '经费拨付', `${q.amount}万元`, q.purpose);
  } else {
    db.prepare("UPDATE funding_requests SET status='已驳回', decided_at=? WHERE id=?").run(TODAY(), q.id);
    audit(user.name, '拨付驳回', `${q.amount}万元`, q.purpose);
  }
  res.json({ ok: true });
});

// ---------- 系统对接同步（CMOS / 经费系统） ----------
const kvGet = (k) => db.prepare('SELECT value FROM kv WHERE key=?').get(k)?.value || null;
const kvSet = (k, v) => db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);

r.get('/sync/status', (req, res) => {
  res.json({ cmos: kvGet('sync.cmos'), funds: kvGet('sync.funds') });
});

r.post('/sync/cmos', (req, res) => {
  const user = currentUser(req);
  // 从 CMOS 数据源拉取：新增已发布计划 + 回写完成状态
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
  const user = currentUser(req);
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
  const today = TODAY();
  const cols = db.prepare('SELECT c.*, p.name pname, p.code pcode, p.accepted_at FROM collaborators c JOIN projects p ON p.id=c.project_id ORDER BY c.eval_date DESC').all()
    .map((c) => {
      // 30 日评价倒计时：参研自项目验收办结、外协自合同验收（演示同锚点）
      const deadline = c.total == null && c.accepted_at ? addDays(c.accepted_at, 30) : null;
      return { ...c, scores: J(c.scores_json), deadline, daysLeft: deadline ? daysLeft(deadline, today) : null };
    });
  const pes = []; // V19 本轮暂缓/删除后评价，协作评价保留，后评价数据不再对前端开放。
  res.json({ collaborators: cols, postEvals: pes });
});

r.post('/collaborators/:id/evaluate', (req, res) => {
  const user = currentUser(req);
  const c = db.prepare('SELECT c.*, p.name pname FROM collaborators c JOIN projects p ON p.id=c.project_id WHERE c.id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const s = req.body?.scores || {};
  const vals = ['tech', 'quality', 'schedule', 'service', 'compliance'].map((k) => Number(s[k]) || 0);
  const total = Math.round(vals.reduce((a, b) => a + b, 0) / 5);
  const grade = evalGrade(total);
  db.prepare('UPDATE collaborators SET scores_json=?, total=?, grade=?, eval_date=?, evaluator=?, blacklisted=? WHERE id=?')
    .run(JSON.stringify(s), total, grade, TODAY(), user.name, grade === '不合格' ? 1 : 0, c.id);
  audit(user.name, '协作单位评价', c.name, `${c.pname}：${total}分（${grade}）`);
  res.json({ ok: true, total, grade });
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

// ---------- 管理 ----------
r.get('/admin', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels').all().map((c) => ({ ...c, flow: J(c.flow_json, []), declare: J(c.declare_json, []), filing: J(c.filing_json, []), chain: J(c.approve_chain_json, []), assess: J(c.assess_json, []) }));
  const users = db.prepare('SELECT * FROM users').all();
  const auditRows = db.prepare('SELECT * FROM audit ORDER BY ts DESC LIMIT 100').all();
  res.json({ channels, users, audit: auditRows });
});

/** 渠道字典维护：新增渠道（编码全局唯一） */
r.post('/admin/channels', (req, res) => {
  const user = currentUser(req);
  const { key, name, level, org, dept, flow, declare, filing } = req.body || {};
  if (!key || !name || !level) return res.status(400).json({ error: '编码、名称、层级为必填项' });
  if (db.prepare('SELECT id FROM channels WHERE key=?').get(String(key).toUpperCase())) {
    return res.status(400).json({ error: `渠道编码 ${key} 已存在，编码全局唯一禁止重复` });
  }
  const split = (s) => (Array.isArray(s) ? s : String(s || '').split(/[、，,;\s]+/).filter(Boolean));
  db.prepare(`INSERT INTO channels (key,name,level,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,'审批','["阶段性检查"]',1)`)
    .run(String(key).toUpperCase(), name, level, org || '', dept || '科研项目处',
      JSON.stringify(split(flow).length ? split(flow) : ['申报', '立项', '实施', '验收']),
      JSON.stringify(split(declare)), JSON.stringify(split(filing)),
      JSON.stringify(['项目联系人', '项目负责人', '项目承担部门负责人', '二级总师', '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处']));
  audit(user.name, '字典维护', '渠道字典', `新增渠道「${name}」编码 ${String(key).toUpperCase()}（经责任单位申请、总部审批后维护）`);
  res.json({ ok: true });
});

/** 渠道启用 / 终止 */
r.post('/admin/channels/:id/toggle', (req, res) => {
  const user = currentUser(req);
  const c = db.prepare('SELECT * FROM channels WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE channels SET enabled=? WHERE id=?').run(c.enabled ? 0 : 1, c.id);
  audit(user.name, '字典维护', '渠道字典', `${c.enabled ? '终止' : '启用'}渠道「${c.name}」（${c.key}）`);
  res.json({ ok: true, enabled: c.enabled ? 0 : 1 });
});

/** 账号状态：离岗自动回收权限 */
r.post('/admin/users/:id/status', (req, res) => {
  const user = currentUser(req);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  if (u.role === 'admin') return res.status(400).json({ error: '超级管理员账号不可停用' });
  const next = u.status === '在岗' ? '已离岗' : '在岗';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(next, u.id);
  audit(user.name, next === '已离岗' ? '权限回收' : '账号恢复', u.name,
    next === '已离岗' ? '岗位变动，系统自动回收账号权限，7 个工作日内完成注销/移交' : '账号重新启用');
  res.json({ ok: true, status: next });
});

export default r;
