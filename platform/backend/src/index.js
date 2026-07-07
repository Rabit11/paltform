import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, signToken, projectScope, canExport, canApply } from './middleware/auth.js';
import { seedDatabase } from './seed.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'keyan-platform' }));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const { password: _, ...safe } = user;
  res.json({ token: signToken(safe), user: safe });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

app.get('/api/meta/roles', authMiddleware, (_req, res) => {
  res.json([
    { id: 'hq', label: '总部治理', desc: '全公司项目统筹、流程配置、后评价管理' },
    { id: 'leader', label: '领导驾驶舱', desc: '宏观决策、风险研判、指标溯源' },
    { id: 'dept', label: '单位治理', desc: '本单位项目计划、经费、风险统筹' },
    { id: 'pm', label: '项目主管', desc: '跨单位项目监控、审批协调' },
    { id: 'owner', label: '项目负责人', desc: '单项目全周期填报与推进' },
    { id: 'member', label: '项目成员', desc: '参与项目资料填报与节点执行' },
  ]);
});

app.get('/api/channels', authMiddleware, async (_req, res) => {
  const channels = await prisma.channel.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] });
  res.json(channels);
});

function buildProjectWhere(user, extra = {}) {
  const scope = projectScope(user);
  const where = { ...extra };
  if (scope.org) where.org = scope.org;
  if (scope.owner) where.owner = scope.owner;
  if (scope.id === '__none__') where.id = '__none__';
  return where;
}

app.get('/api/projects', authMiddleware, async (req, res) => {
  const { level, channel, risk, phase, search } = req.query;
  const where = buildProjectWhere(req.user);
  if (level) where.level = level;
  if (channel) where.channelId = channel;
  if (risk) where.risk = risk;
  if (phase) where.phase = phase;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { org: { contains: search } },
      { owner: { contains: search } },
    ];
  }
  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { milestones: true, partners: true, outcomes: true } } },
  });
  res.json({ items: projects, canExport: canExport(req.user.role) });
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  const where = buildProjectWhere(req.user, { id: req.params.id });
  const project = await prisma.project.findFirst({
    where,
    include: {
      milestones: true,
      partners: true,
      outcomes: true,
      deliverables: true,
      audits: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!project) return res.status(404).json({ error: '项目不存在或无权查看' });
  res.json(project);
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const where = buildProjectWhere(req.user);
  const projects = await prisma.project.findMany({ where });
  const stats = {
    total: projects.length,
    byRisk: { red: 0, yellow: 0, blue: 0, green: 0 },
    byLevel: {},
    byPhase: {},
    budgetTotal: 0,
    budgetSpent: 0,
    redProjects: [],
  };
  for (const p of projects) {
    stats.byRisk[p.risk] = (stats.byRisk[p.risk] || 0) + 1;
    stats.byLevel[p.level] = (stats.byLevel[p.level] || 0) + 1;
    stats.byPhase[p.phase] = (stats.byPhase[p.phase] || 0) + 1;
    stats.budgetTotal += p.budgetTotal;
    stats.budgetSpent += p.budgetSpent;
    if (p.risk === 'red') stats.redProjects.push({ id: p.id, name: p.name, org: p.org, owner: p.owner });
  }
  const todos = await prisma.todo.findMany({
    where: { status: 'pending' },
    include: { project: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const filteredTodos = todos.filter((t) => {
    const roles = t.roles.split(',');
    if (!roles.includes(req.user.role)) return false;
    if (t.orgs && req.user.role === 'dept' && !t.orgs.includes(req.user.org)) return false;
    return true;
  });
  res.json({ role: req.user.role, stats, todos: filteredTodos });
});

app.get('/api/todos', authMiddleware, async (req, res) => {
  const todos = await prisma.todo.findMany({
    include: { project: { select: { id: true, name: true, code: true, org: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const filtered = todos.filter((t) => {
    const roles = t.roles.split(',');
    if (!roles.includes(req.user.role)) return false;
    if (t.orgs && ['dept', 'owner', 'member'].includes(req.user.role)) {
      if (req.user.role === 'dept' && t.orgs && !t.orgs.includes(req.user.org)) return false;
      if (['owner', 'member'].includes(req.user.role) && t.project && t.project.org !== req.user.org) return false;
    }
    return true;
  });
  res.json(filtered);
});

app.patch('/api/todos/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const todo = await prisma.todo.update({ where: { id: req.params.id }, data: { status } });
  await prisma.auditLog.create({
    data: { actor: req.user.name, action: '待办处理', detail: `${todo.title} → ${status}`, source: 'human' },
  });
  res.json(todo);
});

app.get('/api/partners', authMiddleware, async (req, res) => {
  const where = buildProjectWhere(req.user);
  const projectIds = (await prisma.project.findMany({ where, select: { id: true } })).map((p) => p.id);
  const partners = await prisma.partner.findMany({
    where: { projectId: { in: projectIds } },
    include: { project: { select: { id: true, name: true, code: true, org: true } } },
  });
  res.json(partners);
});

app.get('/api/outcomes', authMiddleware, async (req, res) => {
  const where = buildProjectWhere(req.user);
  const projectIds = (await prisma.project.findMany({ where, select: { id: true } })).map((p) => p.id);
  const outcomes = await prisma.outcome.findMany({
    where: { projectId: { in: projectIds } },
    include: { project: { select: { id: true, name: true, code: true } } },
  });
  res.json(outcomes);
});

app.get('/api/risks', authMiddleware, async (req, res) => {
  const where = buildProjectWhere(req.user, { risk: { in: ['red', 'yellow'] } });
  const projects = await prisma.project.findMany({ where, orderBy: { risk: 'asc' } });
  res.json(projects);
});

app.post('/api/applications', authMiddleware, async (req, res) => {
  if (!canApply(req.user.role)) return res.status(403).json({ error: '当前角色无权立项申报' });
  const { level, channelId, channelName, payload } = req.body;
  const app = await prisma.application.create({
    data: {
      level,
      channelId,
      channelName,
      org: req.user.org || '',
      applicant: req.user.name,
      status: 'submitted',
      payload: JSON.stringify(payload || {}),
    },
  });
  await prisma.todo.create({
    data: {
      title: `立项申报审核：${payload?.name || channelName}`,
      type: 'apply_review',
      roles: 'dept,pm,hq',
      orgs: req.user.org,
      status: 'pending',
    },
  });
  res.status(201).json(app);
});

app.get('/api/applications/channel-materials/:channelId', authMiddleware, (req, res) => {
  const map = {
    mjky: ['项目指南', '建议书', '可行性研究报告', '单位评审意见'],
    yy3n: ['建议书', '预算书', '单位评审纪要'],
    zdcx: ['建议书', '技术路线说明', '经费预算表'],
    shjb: ['揭榜申请书', '技术方案', '团队资质证明'],
    default: ['申报书', '预算书', '佐证材料'],
  };
  res.json({ materials: map[req.params.channelId] || map.default });
});

app.post('/api/ai/extract', authMiddleware, (req, res) => {
  const { text } = req.body || {};
  res.json({
    extracted: {
      name: '基于材料自动识别的项目名称（演示）',
      goal: '从上传材料中抽取的项目目标摘要',
      budgetTotal: 1200,
      startDate: '2025-01-01',
      endDate: '2027-12-31',
      org: req.user.org,
      owner: req.user.name,
      deliverables: ['专利2项', '技术标准1项', '样机1套'],
    },
    source: text ? '材料解析' : '模拟抽取',
    note: 'AI 仅提议不执行，请人工核对后提交',
  });
});

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  const { question } = req.body || {};
  const where = buildProjectWhere(req.user);
  const projects = await prisma.project.findMany({ where });
  const red = projects.filter((p) => p.risk === 'red');
  const yellow = projects.filter((p) => p.risk === 'yellow');
  let answer = '暂无匹配数据。';
  const q = (question || '').toLowerCase();
  if (q.includes('红') || q.includes('逾期') || q.includes('超期')) {
    answer = red.length
      ? `当前有 ${red.length} 个红色预警项目：${red.map((p) => p.name).join('；')}。依据：全局四色规则，节点超期未完成。`
      : '当前范围内无红色预警项目。';
  } else if (q.includes('黄') || q.includes('临期')) {
    answer = yellow.length
      ? `临期项目 ${yellow.length} 个：${yellow.map((p) => p.name).join('；')}。依据：距到期≤30天。`
      : '当前范围内无黄色临期项目。';
  } else if (q.includes('经费') || q.includes('预算')) {
    const total = projects.reduce((s, p) => s + p.budgetTotal, 0);
    const spent = projects.reduce((s, p) => s + p.budgetSpent, 0);
    answer = `范围内项目总经费 ${total.toFixed(0)} 万元，已支出 ${spent.toFixed(0)} 万元，执行率 ${total ? ((spent / total) * 100).toFixed(1) : 0}%。依据：项目台账经费汇总观察口径（两套经费体系独立存储）。`;
  } else {
    answer = `在管项目 ${projects.length} 个。可询问：红色预警、临期项目、经费执行等情况。`;
  }
  res.json({ answer, citations: ['项目台账', '四色预警规则 V18', '经费汇总观察口径'] });
});

app.get('/api/audit', authMiddleware, async (req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(logs);
});

async function start() {
  if (process.env.SEED_ON_START === 'true') {
    await seedDatabase();
  }
  app.listen(PORT, () => console.log(`[keyan-api] listening on ${PORT}`));
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
