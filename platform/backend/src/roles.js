/** 需求 V18 ·（二）角色定义 */
export const ROLES = {
  project_team: {
    id: 'project_team',
    label: '项目团队',
    personnel: '项目责任人、技术责任人、项目主管',
    duties: '负责对应项目全周期资料填报、节点推进，配合各级审核验收；协作单位后评价基础信息填报；成果转化基础信息填报与佐证上传',
    permissions: '仅查看/操作本人关联项目；提交保存前可编辑；无全量数据导出权限',
    canEdit: true,
    canExport: false,
    scope: 'linked',
  },
  chief_l1: {
    id: 'chief_l1',
    label: '一级责任总师',
    personnel: '对应专业科研项目的公司级责任总师',
    duties: '技术指导把关；重要节点审核；申报/验收/评估环节线上材料评审',
    permissions: '查看本人经手全部项目；无修改权限',
    canEdit: false,
    canExport: false,
    scope: 'chief_l1',
  },
  chief_l2: {
    id: 'chief_l2',
    label: '二级责任总师',
    personnel: '对应专业科研项目的单位级责任总师',
    duties: '技术指导把关；重要节点审核；申报/验收/评估环节线上材料评审',
    permissions: '查看本人经手全部项目；无修改权限',
    canEdit: false,
    canExport: false,
    scope: 'chief_l2',
  },
  mgmt_hq: {
    id: 'mgmt_hq',
    label: '管理团队（总部）',
    personnel: '责任处室处长、主管',
    duties: '公司科研项目计划、经费、风险总体统筹；协作单位全周期评价及后评价；成果转化信息审核与进度督办',
    permissions: '查看并导出公司全部科研项目；无修改权限',
    canEdit: false,
    canExport: true,
    scope: 'all',
  },
  mgmt_unit: {
    id: 'mgmt_unit',
    label: '管理团队（单位）',
    personnel: '科研项目管理部门负责人、各单位项目主管',
    duties: '本单位项目计划、经费、风险管理；协作单位评价录入；成果转化审核督办',
    permissions: '查看本单位全部科研项目；无修改权限；无全量导出',
    canEdit: false,
    canExport: false,
    scope: 'org',
  },
  finance: {
    id: 'finance',
    label: '财务团队',
    personnel: '各二级单位财务负责人及经办',
    duties: '项目经费核对、预算核销、经费异常监管；对接经费系统数据',
    permissions: '二级公司财务主管仅查看本单位项目经费台账；无修改权限',
    canEdit: false,
    canExport: false,
    scope: 'org_finance',
  },
  admin: {
    id: 'admin',
    label: '超级管理员',
    personnel: '科技部科研项目处指定人员',
    duties: '平台权限配置、流程模板维护、全平台数据运维管理',
    permissions: '可查看公司所有科研项目；平台账号与人员库增删改；禁止直接修改项目业务数据；岗位变动7个工作日内完成账号注销/移交',
    canEdit: false,
    canExport: true,
    scope: 'all',
  },
};

/** 兼容旧演示账号角色码 */
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

export function getRoleDef(role) {
  return ROLES[normalizeRole(role)] || null;
}

export function canExport(role) {
  const r = getRoleDef(role);
  return r?.canExport ?? false;
}

export function canEdit(role) {
  const r = getRoleDef(role);
  return r?.canEdit ?? false;
}

export function canApply(role) {
  return normalizeRole(role) === 'project_team';
}

/** Prisma where 片段：按角色过滤项目 */
export function projectScopeFilter(user) {
  const role = normalizeRole(user.role);
  const name = user.name;
  switch (role) {
    case 'mgmt_hq':
    case 'admin':
      return {};
    case 'mgmt_unit':
    case 'finance':
      return user.org ? { org: user.org } : { id: '__none__' };
    case 'chief_l1':
      return { chiefL1: name };
    case 'chief_l2':
      return { chiefL2: name };
    case 'project_team':
      return {
        OR: [
          { owner: name },
          { techOwner: name },
          { pmName: name },
        ],
      };
    default:
      return { id: '__none__' };
  }
}

export function canAccessProject(user, project) {
  const role = normalizeRole(user.role);
  if (['mgmt_hq', 'admin'].includes(role)) return true;
  if (['mgmt_unit', 'finance'].includes(role)) return project.org === user.org;
  if (role === 'chief_l1') return project.chiefL1 === user.name;
  if (role === 'chief_l2') return project.chiefL2 === user.name;
  if (role === 'project_team') {
    return [project.owner, project.techOwner, project.pmName].includes(user.name);
  }
  return false;
}

export function canEditProject(user, project) {
  if (!canEdit(user.role)) return false;
  return canAccessProject(user, project);
}

export function canManageUsers(role) {
  return normalizeRole(role) === 'admin';
}
