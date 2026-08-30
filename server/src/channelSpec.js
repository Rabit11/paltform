/** 附件「各渠道项目全周期管理流程」：项目渠道清单与流程（权威口径） */
export const DECLARE_CHAIN = [
  '项目联系人', '项目负责人', '项目承担部门负责人', '二级总师',
  '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处',
];

export const CHANNEL_SPEC = [
  {
    key: 'MJKY', name: 'MJKY', level: '国家级', sourceChannel: '工信部', orgOffice: '装备二司',
    flow: ['建议书申报', '立项批复', '任务书/可研报告申报', '任务书/可研报告申报批复', '中期评估', '单位、公司两级验收评审', '国家级验收'],
    declare: ['建议书', '建议书意见'], filing: ['立项批复'], assess: ['中期评估'],
  },
  {
    key: 'ZX04', name: '04专项接续', level: '国家级', sourceChannel: '工信部', orgOffice: '装备一司',
    flow: ['建议书申报', '立项批复', '合同书签署', '中期评估', '单位、公司两级验收评审', '国家级验收'],
    declare: ['建议书', '建议书意见'], filing: ['立项批复'], assess: ['中期评估'],
  },
  {
    key: 'ZDYF', name: '重点研发计划', level: '国家级', sourceChannel: '科技部', orgOffice: '国自然',
    flow: ['申请书提交', '申请书评审', '任务书签署', '启动会', '中期评估', '单位、公司两级验收评审', '综合绩效评价'],
    declare: ['申请书', '申请书评审'], filing: [], assess: ['中期评估'],
  },
  {
    key: 'XX25', name: 'XX25专项', level: '国家级', sourceChannel: '工信部', orgOffice: '高新技术司',
    flow: ['任务清单报送', '任务清单评估并下达', '签署任务书', '季度会/双月报/年度评估', '国资委现场督导', '单位、公司两级验收评审', '验收评估'],
    declare: ['申报通知', '任务清单', '任务清单评估'], filing: [], assess: ['季度会/双月报', '年度评估', '国资委现场督导'],
  },
  {
    key: 'NSFC', name: '国家自然科学基金', level: '国家级', sourceChannel: '科技部', orgOffice: '国自然',
    flow: ['申请书提交', '申请书评审', '批准通知', '年度实施报告', '中期评估', '单位、公司两级验收评审', '国家级验收'],
    declare: ['申请书', '申请书评审'], filing: ['批准通知'], assess: ['年度实施报告', '中期评估'],
  },
  {
    key: 'JBGS', name: '上海市科技攻关揭榜挂帅', level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处',
    flow: ['榜单梳理', '榜单发布', '榜单答疑', '申请书评审并批复立项', '合同签订', '中期评审', '单位验收评审', '科委验收'],
    declare: ['榜单答疑'], filing: ['申请书评审'], assess: ['中期评审'],
  },
  {
    key: 'SHKC', name: '科技创新行动计划', level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处',
    flow: ['建议书申报', '建议书评审', '项目立项', '合同签订', '阶段性检查', '单位验收评审', '综合绩效评价'],
    declare: ['建议书', '建议书评审'], filing: ['立项通知'], assess: ['阶段性检查'],
  },
  {
    key: 'YYGD', name: '预研三年滚动计划', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处',
    flow: ['建议书申报', '建议书评审', '项目立项', '任务书提交', '任务书确认并签订合同', '阶段性检查', '单位级验收评审', '公司级验收评审'],
    declare: ['建议书', '建议书评审'], filing: ['立项通知'], assess: ['阶段性检查'],
  },
  {
    key: 'XJQX', name: '新疆大飞机气象创新中心', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处',
    flow: ['申请书提交', '申请书评审', '技术委员会/主任委员会/理事会审议', '项目立项', '任务书提交', '任务书确认和合同签订', '阶段性检查', '单位验收评审'],
    declare: ['申请书', '申请书评审', '三会审议纪要'], filing: ['立项通知'], assess: ['阶段性检查'],
  },
  {
    key: 'KJZ', name: '科技周', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处',
    flow: ['发布拟立项项目清单', '各单位立项', '实施', '验收'],
    declare: ['合作需求', '需求对接总结', '技术发展战略委员会审议'], filing: ['拟立项通知', '立项文件'], assess: [],
    chain: ['项目负责人', '三级专业总师', '二级专业总师', '单位科技部门负责人', '单位分管科技领导', '总部科技发展处', '一级总师', '总部科技管理部'],
  },
  {
    key: 'DFY', name: '大飞机研究院', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处',
    flow: ['项目建议书编制', '项目建议书评审', '形成拟立项清单', '理事会审议', '立项', '项目实施', '项目验收'],
    declare: ['项目申请书', '学术委员会审议'], filing: ['立项通知'], assess: ['阶段性检查'],
  },
  {
    key: 'CLLM', name: '大飞机先进材料创新联盟', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '技术基础处',
    flow: ['项目申报', '申请书评审', '联盟专委会审议', '联盟理事会审议', '立项建议', '报批', '发布立项通知', '合同书签署', '项目实施', '项目承担单位验收评审'],
    declare: ['项目申请书'], filing: ['立项建议清单及联盟专委会、理事会审议意见'], assess: ['阶段性检查'],
  },
  {
    key: 'BOEING', name: '“中国商飞-波音”可持续航空技术研究中心项目', level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处',
    flow: ['项目波音指导委员会立项', '项目合同签订', '向公司报备', '项目实施', '项目承担单位验收', '与总部签订拨款合同', '拨款'],
    declare: ['波音指导委员会会议纪要'], filing: ['三方合同'], assess: ['阶段性检查'],
    chain: ['项目负责人', '北研中心科技部主管', '北研中心科技部部长', '北研中心分管领导', '总部科技部主管（备案）'],
    mode: '报备',
  },
];

/** 旧项目类型名 / 旧 key → 现行 key（导入与造数兼容） */
export const TYPE_KEY_ALIASES = {
  MJKY: 'MJKY',
  '04专项接续': 'ZX04',
  '国家科技重大专项--04专项': 'ZX04',
  重点研发计划: 'ZDYF',
  下一代国家重点研发计划: 'ZDYF',
  'XX25专项': 'XX25',
  1025: 'XX25',
  国家自然科学基金: 'NSFC',
  大飞机基础研究联合基金: 'NSFC',
  新材料2030专项: 'NSFC',
  上海市科技攻关揭榜挂帅: 'JBGS',
  科技创新行动计划: 'SHKC',
  '上海市科委、经信委项目': 'SHKC',
  预研三年滚动计划: 'YYGD',
  预研三年: 'YYGD',
  新疆大飞机气象创新中心: 'XJQX',
  新疆气象中心项目: 'XJQX',
  科技周: 'KJZ',
  大飞机研究院: 'DFY',
  大飞机先进材料创新联盟: 'CLLM',
  '“中国商飞-波音”可持续航空技术研究中心项目': 'BOEING',
  波音合作: 'BOEING',
  重大科技创新: 'YYGD',
  实验室: 'YYGD',
  科技委技术发展课题: 'YYGD',
  KT: 'YYGD',
  XP: 'YYGD',
  高质量专项: 'YYGD',
  FGW第一批GXJC项目: 'ZDYF',
  '大飞机研究院-南航': 'DFY',
  '大飞机研究院-西工': 'DFY',
  '大飞机研究院-同济': 'DFY',
  '大飞机研究院-上海交大': 'DFY',
  '大飞机研究院-北航': 'DFY',
  '大飞机研究院-重庆大学': 'DFY',
  '大飞机研究院-香港理工': 'DFY',
  '大飞机研究院-中国民航大学': 'DFY',
};

/** 库内旧 key 并入现行渠道（不删项目） */
export const MERGE_INTO = {
  NSFC_2030: 'NSFC',
  FGW: 'ZDYF',
  ZDKC: 'YYGD',
  LAB: 'YYGD',
  KJW: 'YYGD',
  KT: 'YYGD',
  XP: 'YYGD',
  HQZX: 'YYGD',
  DFY_NH: 'DFY',
  DFY_XG: 'DFY',
  DFY_TJ: 'DFY',
  DFY_SJ: 'DFY',
  DFY_BH: 'DFY',
  DFY_CQ: 'DFY',
  DFY_POLYU: 'DFY',
  DFY_MH: 'DFY',
};

export function specByKey() {
  return Object.fromEntries(CHANNEL_SPEC.map((c) => [c.key, c]));
}

export function resolveTypeKey(nameOrKey) {
  const s = String(nameOrKey || '').trim();
  if (!s) return '';
  if (specByKey()[s]) return s;
  if (TYPE_KEY_ALIASES[s]) return TYPE_KEY_ALIASES[s];
  if (MERGE_INTO[s]) return MERGE_INTO[s];
  return s;
}

export function cascadeTreeAndPaths() {
  const tree = {};
  const paths = [];
  for (const c of CHANNEL_SPEC) {
    tree[c.level] ||= {};
    tree[c.level][c.sourceChannel] ||= {};
    tree[c.level][c.sourceChannel][c.orgOffice] ||= [];
    if (!tree[c.level][c.sourceChannel][c.orgOffice].includes(c.name)) {
      tree[c.level][c.sourceChannel][c.orgOffice].push(c.name);
    }
    paths.push({
      level: c.level,
      sourceChannel: c.sourceChannel,
      orgOffice: c.orgOffice,
      projectType: c.name,
    });
  }
  return { tree, paths };
}
