import { get, run } from './db.js';
import { COOKIE_NAME } from './config.js';
import { sha256 } from './security.js';
import { httpError } from './util.js';

export function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  const tokenHash = sha256(token);
  const session = get('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
  if (!session) {
    res.clearCookie(COOKIE_NAME);
    return next();
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    res.clearCookie(COOKIE_NAME);
    return next();
  }
  const user = get('SELECT * FROM users WHERE id = ?', session.user_id);
  if (!user || !user.is_active) {
    res.clearCookie(COOKIE_NAME);
    return next();
  }
  req.user = user;
  req.sessionHash = tokenHash;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول للمتابعة' });
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول للمتابعة' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'لا تملك صلاحية تنفيذ هذه العملية' });
  }
  next();
};

export function requireCompleteProfile(req, res, next) {
  if (req.user?.role === 'student' && !req.user.profile_completed) {
    return res.status(403).json({ error: 'يجب استكمال الملف الشخصي أولاً', code: 'PROFILE_INCOMPLETE' });
  }
  next();
}

export function assertActive(user) {
  if (!user || !user.is_active) throw httpError(403, 'الحساب غير مفعل');
  return user;
}
