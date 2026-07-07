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

/** 登录后默认落地页（按角色职责） */
export function homeRouteForRole(role) {
  const id = normalizeRole(role);
  const routes = {
    project_team: '/apply',
    chief_l1: '/approvals',
    chief_l2: '/approvals',
    mgmt_hq: '/approvals',
    mgmt_unit: '/approvals',
    finance: '/ledger',
    admin: '/dashboard',
  };
  return routes[id] || '/dashboard';
}

/** 登录门户分组（V18 审签职责） */
export const LOGIN_PORTALS = [
  {
    id: 'fill',
    title: '填报入口',
    subtitle: '项目联系人 · 项目负责人',
    roles: ['project_team'],
    desc: '立项申报、材料上传、驳回修改、流程撤销',
    accent: '#4682B4',
  },
  {
    id: 'review',
    title: '审签入口',
    subtitle: '总师 · 单位管理 · 总部科技部',
    roles: ['chief_l1', 'chief_l2', 'mgmt_hq', 'mgmt_unit'],
    desc: '分级审批、驳回留痕、附件审阅、报备追溯',
    accent: '#2d6a4f',
  },
  {
    id: 'finance',
    title: '经费入口',
    subtitle: '单位财务部门负责人',
    roles: ['finance'],
    desc: '经费台账审签节点、预算合规审核',
    accent: '#9a7026',
  },
  {
    id: 'ops',
    title: '运维入口',
    subtitle: '超级管理员',
    roles: ['admin'],
    desc: '人员配置、渠道流程、全平台运维',
    accent: '#5c4d7a',
  },
];

export function portalForRole(role) {
  const id = normalizeRole(role);
  return LOGIN_PORTALS.find((p) => p.roles.includes(id)) || LOGIN_PORTALS[0];
}

const MENUS = {
  project_team: [
    { path: '/dashboard', label: '工作台', icon: '💼' },
    { path: '/ledger', label: '我的项目', icon: '📋' },
    { path: '/approvals', label: '我的申报', icon: '📝' },
    { path: '/apply', label: '立项申报', icon: '➕' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
  ],
  chief_l1: [
    { path: '/approvals', label: '审签中心', icon: '✓' },
    { path: '/dashboard', label: '总师工作台', icon: '🎓' },
    { path: '/ledger', label: '经手项目', icon: '📋' },
    { path: '/board', label: '可视化看板', icon: '📊' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
  ],
  chief_l2: [
    { path: '/approvals', label: '审签中心', icon: '✓' },
    { path: '/dashboard', label: '总师工作台', icon: '🎓' },
    { path: '/ledger', label: '经手项目', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
  ],
  mgmt_hq: [
    { path: '/approvals', label: '审签中心', icon: '✓' },
    { path: '/dashboard', label: '总部治理台', icon: '🏛' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
    { path: '/board', label: '可视化看板', icon: '📊' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/outcomes', label: '成果转化', icon: '🎯' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
    { path: '/ai', label: '智能助手', icon: '✦' },
  ],
  mgmt_unit: [
    { path: '/approvals', label: '审签中心', icon: '✓' },
    { path: '/dashboard', label: '单位治理台', icon: '🏢' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/channels', label: '渠道流程', icon: '🔀' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
  ],
  finance: [
    { path: '/dashboard', label: '经费管理台', icon: '💰' },
    { path: '/approvals', label: '经费审签', icon: '✓' },
    { path: '/ledger', label: '经费台账', icon: '📋' },
    { path: '/board', label: '可视化看板', icon: '📊' },
  ],
  admin: [
    { path: '/dashboard', label: '运维概览', icon: '⚙' },
    { path: '/approvals', label: '审签总览', icon: '✓' },
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
