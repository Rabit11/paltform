/** 需求 V18 · 项目上传与编号生成 */
export function calcPartnerLevel(score) {
  if (score == null || score === '') return null;
  const s = Number(score);
  if (s >= 90) return '优秀';
  if (s >= 60) return '合格';
  return '不合格';
}

export function calcPlanRisk(dueDate, completion) {
  if (completion === '已完成') return 'green';
  if (!dueDate) return 'blue';
  const due = new Date(dueDate);
  const now = new Date();
  const days = (due - now) / 86400000;
  if (days < 0) return 'red';
  if (days <= 30) return 'yellow';
  return 'blue';
}

export async function generateProjectCode(prisma) {
  const year = new Date().getFullYear();
  const prefix = `KY-${year}-`;
  const last = await prisma.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
  });
  let seq = 1;
  if (last?.code) {
    const m = last.code.match(/-(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function generateOutcomeCode(prisma) {
  const prefix = 'CG-';
  const last = await prisma.outcome.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
  });
  let seq = 1;
  if (last?.code) {
    const m = last.code.match(/-(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  const year = new Date().getFullYear();
  return `${prefix}${year}-${String(seq).padStart(3, '0')}`;
}

/** 从立项上传 payload 提取 Project 主表字段 */
export function pickProjectFields(body, channelName, initDept, code) {
  const n = (v) => (v === '' || v === undefined ? null : v);
  const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
  return {
    code: code || body.code?.trim(),
    name: body.name?.trim(),
    goal: n(body.goal),
    level: body.level,
    channelId: body.channelId,
    channelName: channelName || body.channelName,
    initDept: n(body.initDept) || initDept || null,
    org: body.org?.trim() || '',
    owner: body.owner?.trim() || body.applicant || '',
    techOwner: n(body.techOwner),
    pmName: n(body.pmName),
    chiefL1: n(body.chiefL1),
    chiefL2: n(body.chiefL2),
    mgmtHqDirector: n(body.mgmtHqDirector),
    mgmtHqSupervisor: n(body.mgmtHqSupervisor),
    mgmtUnitMinister: n(body.mgmtUnitMinister),
    mgmtUnitSupervisor: n(body.mgmtUnitSupervisor),
    financeHq: n(body.financeHq),
    financeUnitMinister: n(body.financeUnitMinister),
    financeUnitSupervisor: n(body.financeUnitSupervisor),
    partnerUnit1: n(body.partnerUnit1),
    partnerWork1: n(body.partnerWork1),
    partnerUnit2: n(body.partnerUnit2),
    partnerWork2: n(body.partnerWork2),
    partnerUnitsExtra: n(body.partnerUnitsExtra),
    mainWork: n(body.mainWork),
    status: '进行中',
    outcomeStatus: '技术储备待应用',
    risk: 'blue',
    phase: '立项',
    startDate: n(body.startDate),
    endDate: n(body.endDate),
    budgetTotal: num(body.budgetTotal),
    budgetSpent: num(body.budgetSpent),
    budgetYear: num(body.budgetYear),
    budgetYearSpent: num(body.budgetYearSpent),
    over100M: num(body.budgetTotal) >= 10000,
  };
}

export function validateProjectUpload(body) {
  const missing = [];
  if (!body.name?.trim()) missing.push('名称');
  if (!body.level) missing.push('层级');
  if (!body.channelId) missing.push('渠道类别');
  if (!body.org?.trim()) missing.push('牵头单位');
  if (!body.owner?.trim()) missing.push('项目负责人');
  return missing;
}
