/** 中国商飞（COMAC）配色 */
export const COMAC_COLORS = [
  '#2359a7', '#11766f', '#1a6eb5', '#2d8f83', '#9a7026',
  '#4a90c4', '#0d4a8a', '#5ba897', '#c4973a', '#102c4a',
  '#3f7d56', '#34455f', '#708096', '#a84b45', '#5c8fd6',
];

/** 项目名称 → 专业领域（按关键词优先级匹配） */
const FIELD_RULES = [
  { field: '控制科学与工程', keywords: ['飞控', '控制'] },
  { field: '动力工程及工程热物理', keywords: ['发动机', '叶片', '高温合金'] },
  { field: '适航与安全', keywords: ['适航', '审定'] },
  { field: '能源与动力工程', keywords: ['燃料', 'SAF', '可持续航空'] },
  { field: '材料科学与工程', keywords: ['复合材料', '钛合金', '材料', '合金'] },
  { field: '航空宇航科学与技术', keywords: ['气动', '机翼', '客机', '大飞机', '民机'] },
  { field: '电子信息', keywords: ['航电', '数字化', '协同平台', '系统'] },
  { field: '机械工程', keywords: ['装配', '制造', '绿色制造', '产业化'] },
  { field: '力学', keywords: ['噪声'] },
  { field: '大气科学', keywords: ['气象'] },
  { field: '计算机科学与技术', keywords: ['软件', '算法', '智能'] },
  { field: '管理科学与工程', keywords: ['供应链'] },
];

export function classifyByProjectName(name = '') {
  for (const rule of FIELD_RULES) {
    if (rule.keywords.some((k) => name.includes(k))) return rule.field;
  }
  return '综合交叉';
}

/** 项目按专业经费占比 */
export function buildProjectFieldChart(projects) {
  const map = {};
  let total = 0;
  for (const p of projects) {
    const field = classifyByProjectName(p.name);
    map[field] = (map[field] || 0) + (p.budgetTotal || 0);
    total += p.budgetTotal || 0;
  }
  const items = Object.entries(map)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      percent: total ? +((value / total) * 100).toFixed(2) : 0,
      projectCount: projects.filter((p) => classifyByProjectName(p.name) === name).length,
    }))
    .sort((a, b) => b.value - a.value);
  return { items, total: Math.round(total) };
}

/** 人员专业划分（人员列表每项含 specialty） */
export function buildPersonnelFieldChart(personnel) {
  const map = {};
  for (const p of personnel) {
    const field = p.specialty || '综合交叉';
    map[field] = (map[field] || 0) + 1;
  }
  const total = personnel.length;
  const items = Object.entries(map)
    .map(([name, value]) => ({
      name,
      value,
      percent: total ? +((value / total) * 100).toFixed(2) : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return { items, total };
}

/** 从项目负责人生成/补充人员专业（项目变更时动态更新） */
export function derivePersonnelFromProjects(projects, basePersonnel = []) {
  const byName = new Map(basePersonnel.map((p) => [p.name, { ...p }]));
  for (const p of projects) {
    if (!p.owner) continue;
    if (!byName.has(p.owner)) {
      byName.set(p.owner, {
        name: p.owner,
        specialty: classifyByProjectName(p.name),
        org: p.org,
        source: 'project',
      });
    }
  }
  return [...byName.values()];
}
