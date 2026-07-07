/** 需求 V18 · 填表说明 · 台账表头与填写说明 */

export const LEVEL_OPTIONS = ['国家级', '地方级', '公司级'];

export const INIT_DEPT_HINT = {
  国家级: '工信部、国资委、科技部、发改委等',
  地方级: '上海市经信委等',
  公司级: '科技管理部',
};

export const DELIVERABLE_TYPES = ['专利', '论文', '软著', '技术标准', '样机', '设备', '其他'];
export const DELIVERABLE_STATUS = ['待交付', '已交付'];
export const OWNERSHIP_OPTIONS = ['公司', '牵头单位', '参研单位', '外协单位'];
export const PARTNER_TYPES = ['牵头', '参研', '科研外协'];
export const OUTCOME_METHODS = ['产品类（型号转化）', '市场类（市场转化）'];
export const OUTCOME_FORMS_PRODUCT = ['转让', '许可', '作价投资', '自行投资'];
export const OUTCOME_FORMS_MARKET = ['转让', '许可', '作价投资', '自行投资', '合作实施'];
export const OUTCOME_STATUS = ['已启动', '洽谈中', '已签约', '已完成', '技术储备待应用', '已转化应用'];
export const PLAN_COMPLETION = ['已完成', '进行中', '已超期'];

/** 项目所属信息 · 填表行（系统生成字段 readonly） */
export const PROJECT_INFO_ROWS = [
  { key: 'code', label: '项目编号', hint: '项目唯一编号，系统自动生成', readonly: true },
  { key: 'name', label: '名称', hint: '项目全称，与立项文件一致', required: true },
  { key: 'goal', label: '目标', hint: '项目总体目标', type: 'textarea' },
  { key: 'startDate', label: '开始时间', hint: '项目正式启动日期', type: 'date' },
  { key: 'endDate', label: '结束时间', hint: '原计划完成日期；延期后为延期后日期', type: 'date' },
  { key: 'level', label: '层级', hint: '枚举：国家级、地方级、公司级', type: 'level', required: true },
  { key: 'initDept', label: '立项部门', hint: '国家级：工信部/国资委/科技部/发改委等；地方级：上海市经信委等；公司级：科技管理部', readonly: true },
  { key: 'channelId', label: '渠道类别', hint: '项目专项或渠道具体名称', type: 'channel', required: true },
  { key: 'org', label: '牵头单位', hint: '项目主责单位', required: true },
  { key: 'mainWork', label: '主要工作内容', hint: '牵头单位主要工作任务', type: 'textarea' },
  { key: 'status', label: '项目状态', hint: '枚举：进行中、已完成、延期、已通过公司级验收、已通过主管单位验收；系统根据进度自动生成，不需手工填写', readonly: true },
  { key: 'outcomeStatus', label: '成果转化状态', hint: '枚举：已转化应用、接续研发立项、技术储备；系统生成，不需手工填写', readonly: true },
  { key: 'partnerUnit1', label: '参研单位 1', hint: '参研单位全称' },
  { key: 'partnerWork1', label: '主要工作内容 1', hint: '参研单位 1 主要任务', type: 'textarea' },
  { key: 'partnerUnit2', label: '参研单位 2', hint: '参研单位全称' },
  { key: 'partnerWork2', label: '主要工作内容 2', hint: '参研单位 2 主要任务', type: 'textarea' },
  { key: 'partnerUnitsExtra', label: '预留参研单位字段', hint: '参研单位 3、工作内容 3 等扩展', type: 'textarea' },
  { key: 'risk', label: '预警（红、黄、绿、蓝）', hint: '系统根据节点进度自动计算：绿=全部完成；蓝=正常(>30天)；黄=临期(≤30天)；红=超期', readonly: true },
];

export const TEAM_SECTIONS = [
  {
    module: '技术团队',
    fields: [
      { key: 'owner', label: '项目负责人', hint: '姓名及工号', required: true, placeholder: '姓名 / 工号' },
      { key: 'techOwner', label: '技术负责人', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'pmName', label: '项目主管', hint: '姓名及工号', placeholder: '姓名 / 工号' },
    ],
  },
  {
    module: '责任专家',
    fields: [
      { key: 'chiefL1', label: '一级总师', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'chiefL2', label: '二级总师', hint: '姓名及工号', placeholder: '姓名 / 工号' },
    ],
  },
  {
    module: '管理团队',
    fields: [
      { key: 'mgmtHqDirector', label: '总部处室处长', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'mgmtHqSupervisor', label: '总部处室主管', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'mgmtUnitMinister', label: '单位科技部长', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'mgmtUnitSupervisor', label: '单位科技主管', hint: '姓名及工号', placeholder: '姓名 / 工号' },
    ],
  },
  {
    module: '财务团队',
    fields: [
      { key: 'financeHq', label: '总部财务主管', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'financeUnitMinister', label: '单位财务部长', hint: '姓名及工号', placeholder: '姓名 / 工号' },
      { key: 'financeUnitSupervisor', label: '单位财务主管', hint: '姓名及工号', placeholder: '姓名 / 工号' },
    ],
  },
];

export const FUNDING_ROWS = [
  { key: 'budgetTotal', label: '总经费', hint: '项目批复总经费（万元）', type: 'number' },
  { key: 'budgetSpent', label: '历年支出', hint: '截至当前累计实际支出（万元）', type: 'number' },
  { key: 'budgetYear', label: '年度预算', hint: '当年预算（万元）', type: 'number' },
  { key: 'budgetYearSpent', label: '年度支出', hint: '当年实际支出（万元）', type: 'number' },
];

export const ANNUAL_PLAN_COLS = [
  { key: 'yearGoal', label: '年度目标', hint: '当年需完成的科研任务' },
  { key: 'planContent', label: '计划内容', hint: '计划具体条目' },
  { key: 'dueDate', label: '完成时间', hint: '预计完成全部审批流程日期', type: 'date' },
  { key: 'completion', label: '完成情况', hint: '已完成、进行中、已超期', type: 'select', options: PLAN_COMPLETION },
  { key: 'planStatus', label: '计划完成状态', hint: '与预警逻辑一致：绿已完成/蓝正常>30天/黄临期≤30天/红超期', readonly: true },
];

export const DELIVERABLE_COLS = [
  { key: 'name', label: '交付物名称', hint: '合同/任务书考核指标对应交付物全称' },
  { key: 'type', label: '交付物类型', hint: '专利、论文、软著、技术标准、样机、设备等', type: 'select', options: DELIVERABLE_TYPES },
  { key: 'status', label: '交付状态', hint: '绿已交付/蓝正常>30天/黄临期≤30天/红超期', type: 'select', options: DELIVERABLE_STATUS },
  { key: 'ownership', label: '交付物权属', hint: '公司、牵头单位、参研单位、外协单位等', type: 'multi' },
  { key: 'outcomeCode', label: '对应成果编号', hint: '与成果转化关联，可多交付物对应一成果' },
];

export const PARTNER_COLS = [
  { key: 'name', label: '协作单位名称', hint: '合同签署单位全称' },
  { key: 'type', label: '协作类型', hint: '牵头、参研、科研外协', type: 'select', options: PARTNER_TYPES },
  { key: 'evaluator', label: '评价单位、人员', hint: '管理团队评价人' },
  { key: 'score', label: '评价得分', hint: '0-100，五维度量化合计', type: 'number' },
  { key: 'level', label: '评价等级', hint: '系统计算：优秀≥90、合格60-89、不合格<60', readonly: true },
  { key: 'evalDate', label: '评价日期', hint: '管理团队完成评价并出具报告日期', type: 'date' },
];

export const OUTCOME_COLS = [
  { key: 'code', label: '成果编号', hint: '系统生成唯一编号', readonly: true },
  { key: 'name', label: '成果名称', hint: '体现转化价值的统一名称' },
  { key: 'projectCode', label: '所属项目编号', hint: '自动关联科研项目编号，不可手工修改', readonly: true },
  { key: 'summary', label: '成果简介', hint: '100字以内核心技术与价值摘要', type: 'textarea' },
  { key: 'method', label: '转化方式', hint: '产品类(型号转化)或市场类(市场转化)', type: 'select', options: OUTCOME_METHODS },
  { key: 'form', label: '转化形式', hint: '转让、许可、作价投资、自行投资等', type: 'select' },
  { key: 'planDate', label: '计划转化时间', hint: '里程碑节点，用于预警', type: 'date' },
  { key: 'actualDate', label: '实际转化时间', hint: '协议签署或应用完成日期', type: 'date' },
  { key: 'status', label: '转化状态', hint: '已启动、洽谈中、已签约、已完成等；颜色逻辑同交付物', type: 'select', options: OUTCOME_STATUS },
  { key: 'transformBrief', label: '转化简介', hint: '依转化方式填写目标产品、应用单位、合同金额等', type: 'textarea' },
  { key: 'responsibleUnit', label: '责任单位', hint: '成果转化责任单位' },
  { key: 'deliverableCount', label: '关联交付物数量', hint: '系统自动统计关联交付物数', readonly: true },
];

export function calcPartnerLevel(score) {
  if (score == null || score === '') return '';
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
  const days = (due - now) / (86400000);
  if (days < 0) return 'red';
  if (days <= 30) return 'yellow';
  return 'blue';
}

export function riskLabel(r) {
  return { red: '红', yellow: '黄', blue: '蓝', green: '绿' }[r] || r;
}

export function emptyProjectForm() {
  return {
    code: '',
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
    level: '',
    channelId: '',
    channelName: '',
    initDept: '',
    org: '',
    status: '进行中',
    outcomeStatus: '技术储备待应用',
    mainWork: '',
    partnerUnit1: '',
    partnerWork1: '',
    partnerUnit2: '',
    partnerWork2: '',
    partnerUnitsExtra: '',
    risk: 'blue',
    owner: '',
    techOwner: '',
    pmName: '',
    chiefL1: '',
    chiefL2: '',
    mgmtHqDirector: '',
    mgmtHqSupervisor: '',
    mgmtUnitMinister: '',
    mgmtUnitSupervisor: '',
    financeHq: '',
    financeUnitMinister: '',
    financeUnitSupervisor: '',
    budgetTotal: null,
    budgetSpent: null,
    budgetYear: null,
    budgetYearSpent: null,
    annualPlans: [{ yearGoal: '', planContent: '', dueDate: '', completion: '进行中', planStatus: '蓝' }],
    deliverables: [{ name: '', type: '专利', status: '待交付', ownership: [], outcomeCode: '' }],
    partners: [{ name: '', type: '参研', evaluator: '', score: null, level: '', evalDate: '' }],
    outcomes: [{ code: '', name: '', projectCode: '', summary: '', method: '', form: '', planDate: '', actualDate: '', status: '已启动', transformBrief: '', responsibleUnit: '', deliverableCount: 0 }],
    folderName: '',
    folderFiles: [],
  };
}
