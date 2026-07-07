import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'keyan-platform-jwt-secret';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, org: user.org, title: user.title },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

const ROLE_SCOPES = {
  hq: () => ({}),
  leader: () => ({}),
  dept: (user) => ({ org: user.org }),
  pm: () => ({}),
  owner: (user) => ({ owner: user.name }),
  member: (user) => ({ owner: user.name }),
};

export function projectScope(user) {
  const fn = ROLE_SCOPES[user.role];
  return fn ? fn(user) : { id: '__none__' };
}

export function canExport(role) {
  return ['hq', 'leader', 'pm'].includes(role);
}

export function canApply(role) {
  return ['member', 'owner', 'pm'].includes(role);
}
