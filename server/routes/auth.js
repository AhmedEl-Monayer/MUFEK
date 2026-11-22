import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { get, nowIso, run } from '../db.js';
import { COOKIE_NAME, IS_PROD, SESSION_DAYS } from '../config.js';
import {
  hashNationalId,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword
} from '../security.js';
import { asyncHandler, httpError, publicUser, validatePassword } from '../util.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'محاولات دخول كثيرة. حاول بعد 15 دقيقة' }
});

const resetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً' }
});

function createSession(user, req, res) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  run(
    'INSERT INTO sessions(token_hash, user_id, created_at, expires_at, user_agent) VALUES(?, ?, ?, ?, ?)',
    sha256(token), user.id, nowIso(), expires.toISOString(), String(req.headers['user-agent'] || '').slice(0, 300)
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
  run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
  run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
}

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) throw httpError(400, 'أدخل اسم المستخدم وكلمة المرور');
  const user = get('SELECT * FROM users WHERE lower(username) = lower(?)', username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw httpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  if (!user.is_active) throw httpError(403, 'هذا الحساب معطل. تواصل مع مسؤول المنصة');
  createSession(user, req, res);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  if (req.sessionHash) run('DELETE FROM sessions WHERE token_hash = ?', req.sessionHash);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

router.post('/forgot-password', resetLimiter, asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const nationalId = String(req.body?.nationalId || '').trim();
  if (!username || !/^\d{14}$/.test(nationalId)) {
    throw httpError(400, 'أدخل اسم المستخدم والرقم القومي (14 رقماً)');
  }
  const user = get('SELECT * FROM users WHERE lower(username) = lower(?)', username);
  if (!user || user.national_id_hash !== hashNationalId(nationalId) || !user.is_active) {
    throw httpError(400, 'بيانات التحقق غير صحيحة');
  }
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', nowIso(), user.id);
  run(
    'INSERT INTO password_resets(user_id, token_hash, created_at, expires_at) VALUES(?, ?, ?, ?)',
    user.id, sha256(token), nowIso(), expiresAt
  );
  // In production this token is delivered by email. The platform has no SMTP by default,
  // so it is returned once to the verified owner of the account.
  res.json({ token, expiresAt, message: 'تم التحقق من الهوية. استخدم الرمز لتعيين كلمة مرور جديدة.' });
}));

router.post('/reset-password', resetLimiter, asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = validatePassword(req.body?.password);
  if (!token) throw httpError(400, 'رمز الاستعادة مطلوب');
  const reset = get('SELECT * FROM password_resets WHERE token_hash = ?', sha256(token));
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    throw httpError(400, 'رمز الاستعادة غير صالح أو منتهي');
  }
  const user = get('SELECT * FROM users WHERE id = ?', reset.user_id);
  if (!user || !user.is_active) throw httpError(400, 'الحساب غير متاح');
  run('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?', await hashPassword(password), nowIso(), user.id);
  run('UPDATE password_resets SET used_at = ? WHERE id = ?', nowIso(), reset.id);
  run('DELETE FROM sessions WHERE user_id = ?', user.id);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}));

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = validatePassword(req.body?.newPassword);
  if (!(await verifyPassword(current, req.user.password_hash))) {
    throw httpError(400, 'كلمة المرور الحالية غير صحيحة');
  }
  if (current === next) throw httpError(400, 'كلمة المرور الجديدة يجب أن تختلف عن الحالية');
  run(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
    await hashPassword(next), nowIso(), req.user.id
  );
  if (req.sessionHash) {
    run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', req.user.id, req.sessionHash);
  }
  res.json({ ok: true });
}));

export default router;
