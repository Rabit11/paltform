/** 需求 V18 · 角色定义（前端） */
export const ROLES = {
  project_team: {
    id: 'project_team',
    label: '项目团队',
    dashboard: '项目团队工作台',
    personnel: '项目责任人、技术责任人、项目主管',
  },
  chief_l1: {
    id: 'chief_l1',
    label: '一级责任总师',
    dashboard: '责任总师工作台',
    personnel: '公司级责任总师',
  },
  chief_l2: {
    id: 'chief_l2',
    label: '二级责任总师',
    dashboard: '责任总师工作台',
    personnel: '单位级责任总师',
  },
  mgmt_hq: {
    id: 'mgmt_hq',
    label: '管理团队（总部）',
    dashboard: '总部治理台',
    personnel: '责任处室处长、主管',
  },
  mgmt_unit: {
    id: 'mgmt_unit',
    label: '管理团队（单位）',
    dashboard: '单位治理台',
    personnel: '单位科技部长、项目主管',
  },
  finance: {
    id: 'finance',
    label: '财务团队',
    dashboard: '经费管理台',
    personnel: '二级单位财务负责人及经办',
  },
  admin: {
    id: 'admin',
    label: '超级管理员',
    dashboard: '平台运维台',
    personnel: '科技部科研项目处指定人员',
  },
};

export const ROLE_ALIASES = {
  hq: 'mgmt_hq',
  leader: 'mgmt_hq',
  dept: 'mgmt_unit',
  pm: 'project_team',
  owner: 'project_team',
  member: 'project_team',
};

export function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

export function roleLabel(role) {
  const id = normalizeRole(role);
  return ROLES[id]?.label || role;
}

export function dashboardTitle(role) {
  const id = normalizeRole(role);
  return ROLES[id]?.dashboard || '工作台';
}

const MENUS = {
  project_team: [
    { path: '/dashboard', label: '工作台', icon: '💼' },
    { path: '/ledger', label: '我的项目', icon: '📋' },
    { path: '/todos', label: '我的待办', icon: '✓' },
    { path: '/apply', label: '立项申报/上传', icon: '📝' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
  ],
  chief_l1: [
    { path: '/dashboard', label: '总师工作台', icon: '🎓' },
    { path: '/ledger', label: '经手项目', icon: '📋' },
    { path: '/board', label: '可视化看板', icon: '📊' },
    { path: '/todos', label: '节点审核', icon: '✓' },
  ],
  chief_l2: [
    { path: '/dashboard', label: '总师工作台', icon: '🎓' },
    { path: '/ledger', label: '经手项目', icon: '📋' },
    { path: '/todos', label: '节点审核', icon: '✓' },
  ],
  mgmt_hq: [
    { path: '/dashboard', label: '总部治理台', icon: '🏛' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
    { path: '/board', label: '可视化看板', icon: '📊' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/outcomes', label: '成果转化', icon: '🎯' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
    { path: '/todos', label: '待办审批', icon: '✓' },
    { path: '/ai', label: '智能助手', icon: '✦' },
  ],
  mgmt_unit: [
    { path: '/dashboard', label: '单位治理台', icon: '🏢' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
    { path: '/todos', label: '待办审批', icon: '✓' },
  ],
  finance: [
    { path: '/dashboard', label: '经费管理台', icon: '💰' },
    { path: '/ledger', label: '经费台账', icon: '📋' },
    { path: '/board', label: '可视化看板', icon: '📊' },
  ],
  admin: [
    { path: '/dashboard', label: '运维概览', icon: '⚙' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
    { path: '/board', label: '可视化看板', icon: '📊' },
    { path: '/admin', label: '人员与运维', icon: '🔧' },
  ],
};

export function menusForRole(role) {
  const id = normalizeRole(role);
  return MENUS[id] || MENUS.project_team;
}

export function canExport(role) {
  return ['mgmt_hq', 'admin'].includes(normalizeRole(role));
}
