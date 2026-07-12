import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDb } from './db.js';
import { todayISO, statusColor, worstColor, evalGrade, daysLeft, addDays } from './domain.js';
import { aiStatus, extractProjectInfo } from './ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', 'data', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = openDb();
const r = Router();

const J = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const TODAY = () => todayISO();
const LEVELS = ['国家级', '地方级', '公司级'];

const V19_MAJOR_BY_CHANNEL = {
  MJKY: ['总体与适航', '低碳动力'],
  ZX04: ['机载系统', '国产化验证'],
  ZDYF: ['气动结构', '关键技术'],
  XX25: ['智能制造', '重大专项'],
  NSFC: ['基础研究', '机理模型'],
  FGW: ['数字能力', '基础设施'],
  JBGS: ['地方攻关', '揭榜挂帅'],
  SHKC: ['地方攻关', '创新行动'],
  YYGD: ['预先研究', '滚动计划'],
  ZDKC: ['重大创新', '专项突破'],
  XJQX: ['气象创新', '平台能力'],
  KJZ: ['科技传播', '成果展示'],
  DFY: ['研究院专项', '标准预研'],
  CLLM: ['材料联盟', '先进材料'],
  BOEING: ['国际合作', '可持续航空'],
};

const TRANSITION_FIELDS = [
  { group: '项目所属信息', code: 'code', label: '项目编号', required: true },
  { group: '项目所属信息', code: 'name', label: '项目名称', required: true },
  { group: '项目所属信息', code: 'level', label: '项目级别', required: true },
  { group: '项目所属信息', code: 'channel', label: '项目渠道', required: true },
  { group: '项目所属信息', code: 'major1', label: '一级专业', required: false },
  { group: '项目所属信息', code: 'major2', label: '二级专业', required: false },
  { group: '项目所属信息', code: 'managerUnit', label: '管理单位', required: false },
  { group: '项目所属信息', code: 'demandUnit', label: '需求单位', required: false },
  { group: '主要工作内容', code: 'leadWork', label: '牵头单位/主要工作内容', required: true },
  { group: '科研经费情况', code: 'totalBudget', label: '总经费(万元)', required: true },
  { group: '科研经费情况', code: 'centralGrant', label: '国拨经费(万元)', required: false },
  { group: '科研经费情况', code: 'selfFund', label: '自筹经费(万元)', required: false },
  { group: '成果转化', code: 'transformSummary', label: '成果转化情况', required: false },
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

function defaultTransitionRows() {
  const projects = db.prepare('SELECT p.*, c.name cname FROM projects p JOIN channels c ON c.id=p.channel_id ORDER BY p.id LIMIT 10').all().map((p) => enrichProject(p, TODAY()));
  return projects.map((p, i) => ({
    id: `TR-${String(i + 1).padStart(3, '0')}`,
    sourceType: p.level,
    sourceSheet: `${p.level}-${p.v19.major1}`,
    code: p.code,
    name: p.name,
    level: p.level,
    channel: db.prepare('SELECT name FROM channels WHERE id=?').get(p.channel_id)?.name || '',
    major1: p.v19.major1,
    major2: p.v19.major2,
    managerUnit: p.v19.managerUnit,
    demandUnit: p.v19.demandUnit,
    leadWork: p.v19.leadWork,
    totalBudget: p.total_budget,
    centralGrant: p.v19.centralGrant,
    selfFund: p.v19.selfFund,
    transformSummary: p.v19.transformSummary,
    updatedBy: i % 2 ? '总部项目类型主管' : '汇总表维护人',
    updatedAt: TODAY(),
  }));
}

const transitionKey = 'transition.records.v19';
function getTransitionRows() {
  const raw = db.prepare('SELECT value FROM kv WHERE key=?').get(transitionKey)?.value;
  if (raw) return J(raw, []);
  const rows = defaultTransitionRows();
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?)').run(transitionKey, JSON.stringify(rows));
  return rows;
}
function setTransitionRows(rows) {
  db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(transitionKey, JSON.stringify(rows));
}
function validateTransitionRow(row) {
  const missing = TRANSITION_FIELDS.filter((f) => f.required && !row[f.code]).map((f) => f.label);
  const warnings = [];
  if (row.totalBudget != null && Number(row.totalBudget) <= 0) warnings.push('总经费需大于 0');
  if (row.level && !LEVELS.includes(row.level)) warnings.push('项目级别不在国家级/地方级/公司级内');
  return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}

/** V19 二次反馈：表单过渡工具 */
r.get('/transition-tool', (req, res) => {
  const rows = getTransitionRows();
  const enriched = rows.map((x) => ({ ...x, validation: validateTransitionRow(x) }));
  const subtables = LEVELS.map((lv) => ({ name: lv, count: rows.filter((x) => x.level === lv).length }));
  const duplicates = rows.filter((r, i) => rows.findIndex((x) => x.code === r.code || x.name === r.name) !== i).map((x) => x.code || x.name);
  res.json({
    fields: TRANSITION_FIELDS,
    rows: enriched,
    subtables,
    summary: {
      total: rows.length,
      valid: enriched.filter((x) => x.validation.ok).length,
      invalid: enriched.filter((x) => !x.validation.ok).length,
      duplicates: [...new Set(duplicates)],
      lastUpdated: rows.map((x) => x.updatedAt).sort().pop() || null,
    },
    pending: ['真实专项表格及填写说明', '下拉菜单最终口径', '内网机 IP/端口/安装权限', '安全审查和备份策略'],
  });
});

r.post('/transition-tool/records', (req, res) => {
  const user = currentUser(req);
  const rows = getTransitionRows();
  const row = req.body || {};
  const id = row.id || `TR-${String(rows.length + 1).padStart(3, '0')}`;
  const next = { ...row, id, updatedBy: user.name, updatedAt: TODAY() };
  const idx = rows.findIndex((x) => x.id === id);
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  setTransitionRows(rows);
  audit(user.name, '表单过渡工具', '分表维护', `保存 ${next.sourceSheet || next.level || '专项分表'}：${next.name || next.code}`);
  res.json({ ok: true, row: { ...next, validation: validateTransitionRow(next) } });
});

r.post('/transition-tool/import-demo', (req, res) => {
  const user = currentUser(req);
  const rows = defaultTransitionRows();
  setTransitionRows(rows);
  audit(user.name, '表单过渡工具', '批量导入', `按 V19 字段口径导入演示数据 ${rows.length} 行`);
  res.json({ ok: true, imported: rows.length });
});

r.get('/transition-tool/export.xlsx', (req, res) => {
  const rows = getTransitionRows();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'V19总表');
  for (const lv of LEVELS) {
    const part = rows.filter((x) => x.level === lv);
    if (part.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(part), lv);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TRANSITION_FIELDS), '字段口径');
  const invalid = rows.map((x) => ({ id: x.id, code: x.code, name: x.name, ...validateTransitionRow(x) })).filter((x) => !x.ok);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invalid), '校验问题');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="transition-v19-${TODAY()}.xlsx"`);
  res.send(buf);
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
