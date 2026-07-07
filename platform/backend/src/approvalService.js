import { normalizeRole } from './roles.js';
import { getApprovalFlow } from './approvalFlows.js';

export function parsePayload(app) {
  try {
    return JSON.parse(app.payload || '{}');
  } catch {
    return {};
  }
}

export function stepActorRole(step) {
  return step.role;
}

/** 当前用户是否为该步骤的待审人 */
export function canUserApproveStep(user, step, app, payload = {}) {
  const role = normalizeRole(user.role);
  const stepRole = step.role;
  if (stepRole === 'offline') return false;
  if (stepRole !== role) return false;
  if (['mgmt_unit', 'finance'].includes(role) && app.org && user.org && app.org !== user.org) {
    return false;
  }
  if (role === 'chief_l1' && payload.chiefL1 && user.name !== payload.chiefL1) return false;
  if (role === 'chief_l2' && payload.chiefL2 && user.name !== payload.chiefL2) return false;
  if (step.key === 'owner' && payload.owner && user.name !== payload.owner) return false;
  return true;
}

export function buildApprovalState(app, flowDef) {
  const steps = flowDef.steps || [];
  const payload = parsePayload(app);
  const currentStep = app.currentStep ?? 0;
  const nodes = steps.map((step, index) => {
    let status = 'pending';
    if (index < currentStep) status = 'done';
    else if (index === currentStep && ['pending', 'submitted'].includes(app.status)) status = 'current';
    else if (app.status === 'archived' || app.status === 'approved') status = 'done';
    return { index, ...step, status };
  });
  return {
    type: flowDef.type,
    phases: flowDef.phases,
    note: flowDef.note,
    steps,
    nodes,
    currentStep,
    currentStepLabel: steps[currentStep]?.label,
    progress: steps.length ? Math.round((currentStep / steps.length) * 100) : 0,
    rules: flowDef.type === 'filing' ? '报备类：单位科技部审批后自动归档' : '标准审签：驳回退回填报、撤销留痕、附件可替换',
  };
}

export function nextApproverHint(step) {
  if (!step) return '—';
  return `${step.label}（${step.role}）`;
}

export function isSubmitter(user, app) {
  return app.applicant === user.name || app.applicantId === user.id;
}

/** 是否出现在当前用户审签收件箱 */
export function inUserInbox(user, app, flowDef) {
  const payload = parsePayload(app);
  const step = flowDef.steps[app.currentStep];
  if (app.status === 'pending' && canUserApproveStep(user, step, app, payload)) return true;
  if (isSubmitter(user, app)) {
    return ['draft', 'rejected', 'pending'].includes(app.status);
  }
  if (['mgmt_hq', 'admin'].includes(normalizeRole(user.role)) && app.status === 'archived') {
    return flowDef.type === 'filing';
  }
  return false;
}
