export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,32}$/u;

export function text(value, { min = 0, max = 2000, label = 'الحقل', required = false } = {}) {
  const out = value == null ? '' : String(value).trim();
  if (required && !out) throw httpError(400, `${label} مطلوب`);
  if (out && out.length < min) throw httpError(400, `${label} قصير جداً`);
  if (out.length > max) throw httpError(400, `${label} أطول من المسموح`);
  return out;
}

export function optionalId(value, label = 'المعرّف') {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${label} غير صالح`);
  return n;
}

export function requiredId(value, label = 'المعرّف') {
  const n = optionalId(value, label);
  if (!n) throw httpError(400, `${label} مطلوب`);
  return n;
}

export function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function numberOrNull(value, { min = 0, max = 1000 } = {}) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function isoDate(value, { label = 'التاريخ', required = false } = {}) {
  if (!value) {
    if (required) throw httpError(400, `${label} مطلوب`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${label} غير صالح`);
  return date.toISOString();
}

export function validateUsername(value) {
  const username = text(value, { min: 3, max: 32, label: 'اسم المستخدم', required: true });
  if (!USERNAME_RE.test(username)) {
    throw httpError(400, 'اسم المستخدم يجب أن يكون 3-32 حرفاً بدون مسافات');
  }
  return username;
}

export function validatePassword(value) {
  const password = String(value ?? '');
  if (password.length < 8) throw httpError(400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
  if (password.length > 128) throw httpError(400, 'كلمة المرور طويلة جداً');
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/[0-9]/.test(password)) {
    throw httpError(400, 'كلمة المرور يجب أن تحتوي على حروف وأرقام');
  }
  return password;
}

export function validateNationalId(value) {
  const nid = String(value ?? '').trim();
  if (!/^\d{14}$/.test(nid)) throw httpError(400, 'الرقم القومي يجب أن يكون 14 رقماً');
  return nid;
}

export function validatePhone(value, required = false) {
  const phone = text(value, { max: 20, label: 'رقم الهاتف', required });
  if (phone && !/^\+?[\d\s-]{8,20}$/.test(phone)) throw httpError(400, 'رقم الهاتف غير صالح');
  return phone;
}

export function publicUser(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone || '',
    avatar: row.avatar || null,
    isActive: !!row.is_active,
    mustChangePassword: !!row.must_change_password,
    profileCompleted: !!row.profile_completed,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    ...extra
  };
}

export function isStaff(role) {
  return role === 'doctor' || role === 'ta' || role === 'developer';
}

export function roleLabel(role) {
  return {
    developer: 'المطور',
    doctor: 'دكتور',
    ta: 'معيد',
    student: 'طالب'
  }[role] || role;
}

export function fileDto(kind, id, name) {
  return name ? `/api/files/${kind}/${id}` : null;
}

export function parsePaging(req, fallbackLimit = 50, maxLimit = 200) {
  const limit = Math.min(Math.max(Number(req.query.limit) || fallbackLimit, 1), maxLimit);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}
