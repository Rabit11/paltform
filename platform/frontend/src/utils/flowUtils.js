/** 渠道全周期流程 · 前端展示工具（与 backend flowUtils 逻辑一致） */

export function classifyStepPhase(stepName) {
  const s = stepName || '';
  if (/申报|申请|提交|编制|报送|梳理|发布|清单/.test(s)) return '申报';
  if (/评审|批复|立项|批准|审议|评估并下达|形成/.test(s)) return '评审立项';
  if (/签署|合同|任务书|签订|确认|报备/.test(s)) return '签约';
  if (/实施|启动|检查|报告|会|督导|季度|拨款/.test(s)) return '实施';
  if (/验收|绩效|评价/.test(s)) return '验收';
  return '其他';
}

export const STEP_PHASE_COLORS = {
  申报: '#5a9bc9',
  评审立项: '#4682B4',
  签约: '#366892',
  实施: '#6b8fa8',
  验收: '#2d5678',
  其他: '#64748b',
};

export const STEEL = '#4682B4';
