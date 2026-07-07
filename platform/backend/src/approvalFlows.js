/**
 * 需求 V18 ·（二）审签流程
 * 各渠道立项审批链 + 通用规则
 */

/** 通用审批规则（全立项流程适用） */
export const APPROVAL_RULES = {
  reject: '审批驳回：自动退回初始填报节点，标注驳回意见，支持修改后二次提交，所有驳回记录留痕归档',
  attachment: '流程中经办人/审核人可替换附件',
  revoke: '流程撤销：仅填报人可发起撤销，撤销后项目回归草稿状态，撤销记录永久留存',
  filing: '无需审批的报备类项目：填报完成由各单位科技部审批后自动归档，总部可查询追溯',
};

/** 标准国家级/地方级/公司级审批链（含财务） */
export const STANDARD_APPROVAL = [
  { key: 'contact', role: 'project_team', label: '项目联系人', hint: '项目主管填报' },
  { key: 'owner', role: 'project_team', label: '项目负责人', hint: 'owner字段' },
  { key: 'dept_head', role: 'mgmt_unit', label: '项目承担部门负责人' },
  { key: 'chief_l2', role: 'chief_l2', label: '二级总师' },
  { key: 'finance', role: 'finance', label: '单位财务部门负责人' },
  { key: 'tech_head', role: 'mgmt_unit', label: '单位科技部门负责人' },
  { key: 'unit_leader', role: 'mgmt_unit', label: '单位分管领导' },
  { key: 'chief_l1', role: 'chief_l1', label: '一级总师' },
  { key: 'hq_sci', role: 'mgmt_hq', label: '总部科技部科研项目处' },
  { key: 'offline', role: 'offline', label: '线下报批', hint: '科技部办理报批' },
];

/** XX25 无财务节点 */
export const XX25_APPROVAL = STANDARD_APPROVAL.filter((s) => s.key !== 'finance');

/** 报备申签（波音等） */
export const FILING_APPROVAL = [
  { key: 'owner', role: 'project_team', label: '项目负责人' },
  { key: 'unit_sci', role: 'mgmt_unit', label: '北研中心科技部主管' },
  { key: 'unit_tech_min', role: 'mgmt_unit', label: '北研中心科技部部长' },
  { key: 'unit_leader', role: 'mgmt_unit', label: '北研中心分管领导' },
  { key: 'hq_sci', role: 'mgmt_hq', label: '总部科技部主管' },
];

/** 科技周 */
export const KJZ_APPROVAL = [
  { key: 'owner', role: 'project_team', label: '项目负责人' },
  { key: 'chief_l3', role: 'chief_l2', label: '三级专业总师' },
  { key: 'chief_l2', role: 'chief_l2', label: '二级专业总师' },
  { key: 'unit_sci', role: 'mgmt_unit', label: '单位科技部' },
  { key: 'tech_head', role: 'mgmt_unit', label: '单位科技部门负责人' },
  { key: 'sci_leader', role: 'mgmt_unit', label: '单位分管科技领导' },
  { key: 'hq_dev', role: 'mgmt_hq', label: '总部科技部科技发展处' },
  { key: 'chief_l1', role: 'chief_l1', label: '一级总师审核' },
  { key: 'hq_mgmt', role: 'mgmt_hq', label: '总部科技管理部' },
  { key: 'demand', role: 'mgmt_hq', label: '需求发布' },
  { key: 'committee', role: 'mgmt_hq', label: '技术发展战略委员会审查' },
  { key: 'publish', role: 'mgmt_hq', label: '发布拟立项项目清单' },
  { key: 'unit_init', role: 'mgmt_unit', label: '各单位立项' },
  { key: 'unit_exec', role: 'project_team', label: '各单位实施' },
  { key: 'unit_accept', role: 'mgmt_unit', label: '各单位验收' },
];

/** 大飞机研究院 */
export const DYJY_APPROVAL = [
  { key: 'guide', role: 'mgmt_unit', label: '征集指南' },
  { key: 'academic_review', role: 'chief_l2', label: '学术委员会评审' },
  { key: 'guide_pub', role: 'mgmt_unit', label: '指南发布' },
  { key: 'proposal', role: 'project_team', label: '形成项目建议书' },
  { key: 'academic_review2', role: 'chief_l2', label: '学术委员会评审' },
  { key: 'draft_list', role: 'mgmt_unit', label: '形成拟立项清单' },
  { key: 'council', role: 'mgmt_hq', label: '理事会审议' },
  { key: 'approval', role: 'mgmt_unit', label: '研究院立项' },
  { key: 'implement', role: 'project_team', label: '组织实施' },
  { key: 'accept', role: 'chief_l2', label: '学术委员会验收评审' },
];

/** 先进材料创新联盟 · 立项阶段 */
export const CLLM_APPROVAL_INIT = [
  { key: 'apply', role: 'project_team', label: '联盟成员单位提交申请书' },
  { key: 'committee', role: 'mgmt_unit', label: '专委会审查意见/纪要' },
  { key: 'council', role: 'mgmt_unit', label: '理事会审查意见/纪要' },
  { key: 'hq_report', role: 'mgmt_hq', label: '公司科技部报批' },
];

/** 渠道 → 审批链映射 */
export const CHANNEL_APPROVAL_FLOWS = {
  mjky: { type: 'approval', steps: STANDARD_APPROVAL },
  '04zx': { type: 'approval', steps: STANDARD_APPROVAL },
  zdyf: { type: 'approval', steps: STANDARD_APPROVAL },
  xx25: { type: 'approval', steps: XX25_APPROVAL },
  nsfc: { type: 'approval', steps: STANDARD_APPROVAL },
  fgw: { type: 'approval', steps: STANDARD_APPROVAL },
  shjb: { type: 'approval', steps: STANDARD_APPROVAL },
  shkj: { type: 'approval', steps: STANDARD_APPROVAL },
  yy3n: { type: 'approval', steps: STANDARD_APPROVAL },
  xjqx: { type: 'approval', steps: STANDARD_APPROVAL },
  kjz: { type: 'approval', steps: KJZ_APPROVAL },
  dyjy: { type: 'approval', steps: DYJY_APPROVAL },
  cllm: { type: 'approval', steps: CLLM_APPROVAL_INIT, phases: ['立项阶段', '实施阶段', '验收阶段'] },
  boeing: { type: 'filing', steps: FILING_APPROVAL, note: '报备类，单位科技部审批后自动归档' },
  zdcx: { type: 'approval', steps: STANDARD_APPROVAL },
};

export function getApprovalFlow(channelId) {
  const flow = CHANNEL_APPROVAL_FLOWS[channelId];
  if (!flow) {
    return { type: 'approval', steps: STANDARD_APPROVAL };
  }
  return flow;
}

export function listApprovalFlows() {
  return Object.entries(CHANNEL_APPROVAL_FLOWS).map(([channelId, flow]) => ({
    channelId,
    ...flow,
    stepLabels: flow.steps.map((s) => s.label),
  }));
}
