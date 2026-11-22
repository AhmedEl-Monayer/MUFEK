import express from 'express';
import { get, nowIso, run } from '../db.js';
import { asyncHandler, httpError, publicUser, text, validatePhone } from '../util.js';
import { requireAuth } from '../auth.js';
import { avatarUpload, removeUpload } from '../uploads.js';
import { decryptNationalId, maskNationalId } from '../security.js';

const router = express.Router();
router.use(requireAuth);

function withMaskedId(user) {
  return publicUser(user, {
    nationalIdMasked: maskNationalId(decryptNationalId(user.national_id_enc))
  });
}

router.get('/', asyncHandler(async (req, res) => {
  res.json({ user: withMaskedId(req.user) });
}));

router.patch('/', asyncHandler(async (req, res) => {
  const fullName = req.body?.fullName !== undefined
    ? text(req.body.fullName, { min: 3, max: 120, label: 'الاسم الكامل', required: true })
    : req.user.full_name;
  const phone = req.body?.phone !== undefined
    ? validatePhone(req.body.phone, req.user.role === 'student')
    : (req.user.phone || '');
  const completed = req.user.role === 'student'
    ? Boolean(fullName && phone && req.user.avatar)
    : req.user.profile_completed;
  run(
    'UPDATE users SET full_name = ?, phone = ?, profile_completed = ?, updated_at = ? WHERE id = ?',
    fullName, phone, completed ? 1 : 0, nowIso(), req.user.id
  );
  const fresh = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: withMaskedId(fresh) });
}));

router.post('/avatar', avatarUpload, asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'اختر صورة شخصية');
  const old = req.user.avatar;
  const completed = req.user.role === 'student'
    ? Boolean(req.user.phone && req.user.full_name)
    : req.user.profile_completed;
  run(
    'UPDATE users SET avatar = ?, profile_completed = ?, updated_at = ? WHERE id = ?',
    req.file.filename, completed ? 1 : 0, nowIso(), req.user.id
  );
  if (old) removeUpload('avatar', old);
  const fresh = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: withMaskedId(fresh) });
}));

export default router;
