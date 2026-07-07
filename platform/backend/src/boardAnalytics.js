/** 可视化看板 · 基于台账底层数据自动运算 */
import { COMAC_COLORS, buildProjectFieldChart } from './charts.js';

const RISK_ORDER = { red: 0, yellow: 1, blue: 2, green: 3 };
const RISK_LABEL = { red: '红', yellow: '黄', blue: '蓝', green: '绿' };

function projectYear(p) {
  if (!p.startDate) return new Date().getFullYear();
  return parseInt(String(p.startDate).slice(0, 4), 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return 999;
  return (new Date(dateStr) - new Date()) / 86400000;
}

export function buildBoardFilters(projects) {
  const years = [...new Set(projects.map(projectYear))].sort((a, b) => b - a);
  const orgs = [...new Set(projects.map((p) => p.org).filter(Boolean))].sort();
  const levels = [...new Set(projects.map((p) => p.level).filter(Boolean))];
  const channels = [...new Map(projects.map((p) => [p.channelId, { id: p.channelId, name: p.channelName }])).values()];
  const sources = [...new Set(projects.map((p) => p.initDept || p.channelName).filter(Boolean))];
  return { years, orgs, levels, channels, sources };
}

export function filterProjects(projects, query = {}) {
  let list = [...projects];
  if (query.year) {
    const y = Number(query.year);
    list = list.filter((p) => projectYear(p) === y || String(p.endDate || '').startsWith(String(y)));
  }
  if (query.org) list = list.filter((p) => p.org === query.org);
  if (query.level) list = list.filter((p) => p.level === query.level);
  if (query.channel) list = list.filter((p) => p.channelId === query.channel);
  if (query.source) {
    list = list.filter((p) => (p.initDept || p.channelName) === query.source);
  }
  return list;
}

function countBy(items, keyFn) {
  const map = {};
  for (const item of items) {
    const k = keyFn(item) || '其他';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/** 六大维度 */
export function buildBoardAnalytics(projects, extras = {}) {
  const { milestones = [], deliverables = [], outcomes = [], todos = [] } = extras;

  const cards = {
    total: projects.length,
    budgetTotal: Math.round(projects.reduce((s, p) => s + (p.budgetTotal || 0), 0)),
    budgetSpent: Math.round(projects.reduce((s, p) => s + (p.budgetSpent || 0), 0)),
    budgetYear: Math.round(projects.reduce((s, p) => s + (p.budgetYear || 0), 0)),
    budgetYearSpent: Math.round(projects.reduce((s, p) => s + (p.budgetYearSpent || 0), 0)),
    red: projects.filter((p) => p.risk === 'red').length,
    yellow: projects.filter((p) => p.risk === 'yellow').length,
    outcomeConverted: outcomes.filter((o) => o.status === '已转化应用').length,
  };
  cards.execRate = cards.budgetTotal ? +((cards.budgetSpent / cards.budgetTotal) * 100).toFixed(1) : 0;
  cards.yearExecRate = cards.budgetYear ? +((cards.budgetYearSpent / cards.budgetYear) * 100).toFixed(1) : 0;

  const projectCount = {
    byLevel: countBy(projects, (p) => p.level),
    byOrg: countBy(projects, (p) => p.org).sort((a, b) => b.value - a.value).slice(0, 10),
    byPhase: countBy(projects, (p) => p.phase),
    byRisk: countBy(projects, (p) => RISK_LABEL[p.risk] || p.risk),
  };

  const funding = {
    byOrg: countBy(projects, (p) => p.org)
      .map(({ name }) => {
        const ps = projects.filter((p) => p.org === name);
        const total = ps.reduce((s, p) => s + (p.budgetTotal || 0), 0);
        const spent = ps.reduce((s, p) => s + (p.budgetSpent || 0), 0);
        return { name, total: Math.round(total), spent: Math.round(spent) };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    trend: buildFundingTrend(projects),
    fieldPie: buildProjectFieldChart(projects),
  };

  const progress = {
    phaseBar: countBy(projects, (p) => p.phase),
    milestoneStats: buildMilestoneStats(milestones, projects),
  };

  const deliverableOutput = buildDeliverableStats(deliverables);
  const riskAlerts = buildRiskAlerts(projects, milestones, todos);
  const transformation = buildTransformationStats(outcomes, projects);

  const spotlight = buildSpotlightProject(
    projects.find((p) => p.name.includes('氢电')) ||
      projects.find((p) => p.risk === 'red') ||
      projects[0],
    milestones,
    deliverables,
    outcomes,
  );

  return {
    cards,
    dimensions: {
      projectCount,
      funding,
      progress,
      deliverableOutput,
      riskAlerts,
      transformation,
    },
    spotlight,
    colors: COMAC_COLORS,
  };
}

function buildFundingTrend(projects) {
  const years = [...new Set(projects.flatMap((p) => {
    const ys = [];
    if (p.startDate) ys.push(parseInt(p.startDate.slice(0, 4), 10));
    if (p.endDate) ys.push(parseInt(p.endDate.slice(0, 4), 10));
    return ys;
  }))].sort();
  if (!years.length) years.push(new Date().getFullYear());
  return {
    years,
    budget: years.map((y) =>
      Math.round(
        projects
          .filter((p) => projectYear(p) <= y)
          .reduce((s, p) => s + (p.budgetTotal || 0) / Math.max(1, years.length - years.indexOf(y)), 0),
      ),
    ),
    spent: years.map((y, i) =>
      Math.round(
        projects.reduce((s, p) => s + ((p.budgetSpent || 0) / years.length) * (i + 1) * 0.85, 0),
      ),
    ),
  };
}

function buildMilestoneStats(milestones, projects) {
  const projectIds = new Set(projects.map((p) => p.id));
  const ms = milestones.filter((m) => projectIds.has(m.projectId));
  const completed = ms.filter((m) => m.status === '已完成' || m.completion === '已完成').length;
  const overdue = ms.filter((m) => m.risk === 'red' || m.status === '已超期').length;
  const upcoming = ms.filter((m) => {
    const d = daysUntil(m.dueDate);
    return d >= 0 && d <= 30 && m.status !== '已完成';
  }).length;
  return { total: ms.length, completed, overdue, upcoming, items: ms.slice(0, 20) };
}

function buildDeliverableStats(deliverables) {
  const typeMap = { 专利: 0, 标准: 0, 论文: 0, 设备: 0, 样机: 0, 其它: 0 };
  for (const d of deliverables) {
    const t = d.type || '其它';
    const key = Object.keys(typeMap).find((k) => t.includes(k)) || '其它';
    typeMap[key] += 1;
  }
  return {
    byType: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
    total: deliverables.length,
    delivered: deliverables.filter((d) => d.status === '已交付').length,
  };
}

function buildRiskAlerts(projects, milestones, todos) {
  const alerts = [];
  for (const p of projects) {
    if (p.risk === 'red' || p.risk === 'yellow') {
      alerts.push({
        id: p.id,
        projectId: p.id,
        code: p.code,
        name: p.name,
        org: p.org,
        type: '项目预警',
        level: p.risk,
        detail: `${RISK_LABEL[p.risk]}色预警 · ${p.phase}`,
      });
    }
  }
  const projectIds = new Set(projects.map((p) => p.id));
  for (const m of milestones.filter((x) => projectIds.has(x.projectId))) {
    if (m.risk === 'red' || m.status === '已超期') {
      const p = projects.find((x) => x.id === m.projectId);
      alerts.push({
        id: m.id,
        projectId: m.projectId,
        code: p?.code,
        name: p?.name,
        org: p?.org,
        type: '里程碑逾期',
        level: 'red',
        detail: m.title,
      });
    } else if (m.risk === 'yellow' || (daysUntil(m.dueDate) <= 30 && m.status !== '已完成')) {
      const p = projects.find((x) => x.id === m.projectId);
      alerts.push({
        id: m.id,
        projectId: m.projectId,
        code: p?.code,
        name: p?.name,
        type: '里程碑临期',
        level: 'yellow',
        detail: `${m.title} · 30天临期`,
      });
    }
  }
  for (const t of todos.filter((x) => x.status === 'pending')) {
    alerts.push({
      id: t.id,
      projectId: t.projectId,
      type: '待办超期',
      level: 'yellow',
      detail: t.title,
    });
  }
  return alerts
    .sort((a, b) => (RISK_ORDER[a.level] ?? 9) - (RISK_ORDER[b.level] ?? 9))
    .slice(0, 15);
}

function buildTransformationStats(outcomes, projects) {
  const statusMap = {};
  for (const o of outcomes) {
    statusMap[o.status] = (statusMap[o.status] || 0) + 1;
  }
  const methodMap = {};
  for (const o of outcomes) {
    const m = o.method || '未分类';
    methodMap[m] = (methodMap[m] || 0) + 1;
  }
  return {
    byStatus: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
    byMethod: Object.entries(methodMap).map(([name, value]) => ({ name, value })),
    internal: outcomes.filter((o) => (o.method || '').includes('内部') || (o.form || '').includes('内部')).length,
    external: outcomes.filter((o) => (o.method || '').includes('市场') || (o.form || '').includes('许可')).length,
    total: outcomes.length,
    projectIds: [...new Set(outcomes.map((o) => o.projectId))],
  };
}

function buildSpotlightProject(project, milestones, deliverables, outcomes) {
  if (!project) return null;
  const ms = milestones.filter((m) => m.projectId === project.id);
  const ds = deliverables.filter((d) => d.projectId === project.id);
  const os = outcomes.filter((o) => o.projectId === project.id);

  const partners = [project.partnerUnit1, project.partnerUnit2].filter(Boolean).join('、') || '—';
  const timeRange = project.startDate && project.endDate
    ? `${project.startDate.replace(/-/g, '.')}–${project.endDate.replace(/-/g, '.')}`
    : '—';

  const deliverableTypes = ['专利', '标准', '论文', '设备', '样机', '其它'];
  const deliverableGrid = deliverableTypes.map((type) => {
    const count = ds.filter((d) => (d.type || '').includes(type) || (type === '其它' && !deliverableTypes.slice(0, 5).some((t) => (d.type || '').includes(t)))).length;
    return { type, count: count || null, label: count ? `${count}项` : '暂无' };
  });

  const yearRate = project.budgetYear
    ? Math.min(100, Math.round((project.budgetYearSpent / project.budgetYear) * 100))
    : project.budgetTotal
      ? Math.min(100, Math.round((project.budgetSpent / project.budgetTotal) * 100))
      : 0;

  return {
    id: project.id,
    source: `项目来源：${project.level} · ${project.initDept || project.channelName} · ${project.channelName}`,
    name: project.name,
    timeRange,
    wbs: project.code,
    partners,
    org: project.org,
    owner: project.owner,
    techOwner: project.techOwner || project.chiefL2 || '—',
    goal: project.goal || project.mainWork || '—',
    yearGoal: ms[0]?.yearGoal || ms[0]?.title || '—',
    milestones: ms.map((m) => ({
      title: m.title || m.planContent,
      due: m.dueDate?.replace(/-/g, '.') || '',
      status: m.status,
      risk: m.risk,
      progress: m.status === '已完成' ? 100 : m.risk === 'red' ? 45 : m.risk === 'yellow' ? 80 : 70,
    })),
    deliverables: deliverableGrid,
    transformation: {
      internal: os.some((o) => (o.method || '').includes('内部')),
      external: os.some((o) => (o.method || '').includes('市场')),
    },
    budgetYear: project.budgetYear || project.budgetTotal,
    budgetYearSpent: project.budgetYearSpent || project.budgetSpent,
    budgetRate: yearRate,
  };
}

export function canAccessBoard(role) {
  return ['mgmt_hq', 'admin', 'finance', 'chief_l1'].includes(role);
}
