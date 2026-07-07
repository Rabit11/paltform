import jwt from 'jsonwebtoken';
import {
  normalizeRole,
  projectScopeFilter,
  canExport,
  canEdit,
  canApply,
  canEditProject,
  canAccessProject,
  canManageUsers,
  ROLES,
} from '../roles.js';

const JWT_SECRET = process.env.JWT_SECRET || 'keyan-platform-jwt-secret';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { ...payload, role: normalizeRole(payload.role) };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: normalizeRole(user.role),
      org: user.org,
      title: user.title,
      teamRole: user.teamRole,
    },
    JWT_SECRET,
    { expiresIn: '12h' },
  );
}

export function projectScope(user) {
  return projectScopeFilter(user);
}

export { canExport, canEdit, canApply, canEditProject, canAccessProject, canManageUsers, ROLES, normalizeRole };
