/** 渠道全周期流程 · 节点推断与状态计算 */

const PHASE_KEYWORDS = [
  { re: /验收|绩效评价|综合绩效/, stepRe: /验收|绩效|评价/ },
  { re: /后评价|成果转化|协作评价/, stepRe: /验收|绩效|评价|转化/ },
  { re: /^验收$/, stepRe: /验收|评审/ },
  { re: /实施|进行/, stepRe: /中期|启动|实施|检查|报告|会|督导|季度/ },
  { re: /立项/, stepRe: /立项|批复|批准|任务书签署|合同|启动会/ },
];

/** 根据项目 phase/status 推断当前流程节点索引 */
export function resolveFlowStep(project, steps = []) {
  if (!steps.length) return 0;
  if (typeof project.flowStep === 'number' && project.flowStep > 0) {
    return Math.min(project.flowStep, steps.length - 1);
  }
  const phase = project.phase || '';
  const status = project.status || '';

  for (const rule of PHASE_KEYWORDS) {
    if (rule.re.test(phase) || rule.re.test(status)) {
      const idx = steps.findIndex((s) => rule.stepRe.test(s));
      if (idx >= 0) return idx;
    }
  }

  if (/完成|已通过/.test(status)) return steps.length - 1;
  if (/立项/.test(phase)) {
    const idx = steps.findIndex((s) => /立项|批复|批准/.test(s));
    return idx >= 0 ? idx : 1;
  }
  if (/实施/.test(phase)) {
    const idx = steps.findIndex((s) => /中期|启动|检查|实施/.test(s));
    return idx >= 0 ? idx : Math.max(1, Math.floor(steps.length * 0.5));
  }

  return Math.min(1, steps.length - 1);
}

/** 节点业务阶段分类（用于分组色带） */
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

/** 构建带状态的流程节点列表 */
export function buildFlowNodes(steps, currentIndex) {
  return steps.map((name, index) => {
    let status = 'pending';
    if (index < currentIndex) status = 'done';
    else if (index === currentIndex) status = 'current';
    return {
      index,
      name,
      phase: classifyStepPhase(name),
      status,
    };
  });
}

export function buildChannelFlowPayload(project, channelDef) {
  if (!channelDef?.steps?.length) return null;
  const currentStep = resolveFlowStep(project, channelDef.steps);
  const nodes = buildFlowNodes(channelDef.steps, currentStep);
  const progress = Math.round(((currentStep + (nodes[currentStep]?.status === 'done' ? 1 : 0.5)) / channelDef.steps.length) * 100);
  return {
    channelId: channelDef.id,
    channelName: channelDef.name,
    level: channelDef.level,
    dept: channelDef.dept,
    steps: channelDef.steps,
    currentStep,
    currentStepName: channelDef.steps[currentStep],
    progress: Math.min(100, progress),
    nodes,
  };
}

/** 统计渠道下各节点项目数 */
export function aggregateStepCounts(projects, steps) {
  const counts = new Array(steps.length).fill(0);
  for (const p of projects) {
    const idx = resolveFlowStep(p, steps);
    counts[idx] += 1;
  }
  return counts;
}
