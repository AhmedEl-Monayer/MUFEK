import express from 'express';
import { all, deleteAsset, get, nowIso, run, setting, setSetting, tx } from '../db.js';
import { requireRole } from '../auth.js';
import {
  asyncHandler,
  bool,
  httpError,
  publicUser,
  text,
  validateNationalId,
  validatePassword,
  validatePhone,
  validateUsername
} from '../util.js';
import { decryptNationalId, hashNationalId, hashPassword, maskNationalId } from '../security.js';
import { encryptNationalId } from '../security.js';

const router = express.Router();
router.use(requireRole('developer'));

const ROLES = ['student', 'doctor', 'ta'];

function adminUser(row) {
  return publicUser(row, {
    nationalIdMasked: maskNationalId(decryptNationalId(row.national_id_enc)),
    coursesCount: row.courses_count ?? 0,
    taCoursesCount: row.ta_courses_count ?? 0,
    enrollmentsCount: row.enrollments_count ?? 0
  });
}

router.get('/stats', asyncHandler(async (req, res) => {
  const count = (sql, ...p) => get(sql, ...p)?.n || 0;
  const stats = {
    users: count('SELECT COUNT(*) AS n FROM users'),
    students: count("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
    doctors: count("SELECT COUNT(*) AS n FROM users WHERE role = 'doctor'"),
    tas: count("SELECT COUNT(*) AS n FROM users WHERE role = 'ta'"),
    activeUsers: count('SELECT COUNT(*) AS n FROM users WHERE is_active = 1'),
    courses: count('SELECT COUNT(*) AS n FROM courses'),
    activeCourses: count('SELECT COUNT(*) AS n FROM courses WHERE is_active = 1'),
    assignments: count('SELECT COUNT(*) AS n FROM assignments WHERE is_active = 1'),
    submissions: count('SELECT COUNT(*) AS n FROM submissions'),
    messages: count('SELECT COUNT(*) AS n FROM messages'),
    pendingRequests: count("SELECT COUNT(*) AS n FROM chat_requests WHERE status = 'pending'")
  };
  const recentUsers = all('SELECT * FROM users ORDER BY id DESC LIMIT 6').map(adminUser);
  const recentSubmissions = all(
    `SELECT s.id, s.submitted_at, s.status, u.full_name AS student_name, a.title AS assignment_title, c.name AS course_name
     FROM submissions s JOIN users u ON u.id = s.student_id
     JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
     ORDER BY s.id DESC LIMIT 6`
  );
  const topCourses = all(
    `SELECT c.id, c.name, c.code, c.is_active,
      (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) AS students_count,
      (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id AND a.is_active = 1) AS assignments_count
     FROM courses c ORDER BY students_count DESC LIMIT 5`
  );
  res.json({ stats, recentUsers, recentSubmissions, topCourses });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const role = String(req.query.role || '');
  const q = String(req.query.q || '').trim();
  const where = [];
  const params = [];
  if (role && ROLES.includes(role)) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (q) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = all(
    `SELECT u.*,
      (SELECT COUNT(*) FROM courses c WHERE c.doctor_id = u.id) AS courses_count,
      (SELECT COUNT(*) FROM course_tas t WHERE t.ta_id = u.id) AS ta_courses_count,
      (SELECT COUNT(*) FROM course_students s WHERE s.student_id = u.id) AS enrollments_count
     FROM users u ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY u.id DESC`,
    ...params
  );
  res.json({ users: rows.map(adminUser) });
}));

router.post('/users', asyncHandler(async (req, res) => {
  const username = validateUsername(req.body?.username);
  const nationalId = validateNationalId(req.body?.nationalId);
  const password = validatePassword(req.body?.password);
  const role = String(req.body?.role || '');
  if (!ROLES.includes(role)) throw httpError(400, 'نوع الحساب غير صالح');
  const fullName = text(req.body?.fullName, { min: 3, max: 120, label: 'الاسم الكامل', required: true });
  const phone = validatePhone(req.body?.phone, false);

  if (get('SELECT id FROM users WHERE lower(username) = lower(?)', username)) {
    throw httpError(409, 'اسم المستخدم مستخدم بالفعل');
  }
  const nidHash = hashNationalId(nationalId);
  if (get('SELECT id FROM users WHERE national_id_hash = ?', nidHash)) {
    throw httpError(409, 'الرقم القومي مسجل بالفعل');
  }
  const now = nowIso();
  const info = run(
    `INSERT INTO users(username, national_id_enc, national_id_hash, password_hash, role, full_name, phone,
      is_active, must_change_password, profile_completed, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`,
    username, encryptNationalId(nationalId), nidHash, await hashPassword(password), role, fullName, phone, now, now
  );
  const user = get('SELECT * FROM users WHERE id = ?', Number(info.lastInsertRowid));
  res.status(201).json({ user: adminUser(user), message: 'تم إنشاء الحساب بنجاح' });
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = get('SELECT * FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'المستخدم غير موجود');

  const fields = [];
  const params = [];
  if (req.body?.fullName !== undefined) {
    fields.push('full_name = ?');
    params.push(text(req.body.fullName, { min: 3, max: 120, label: 'الاسم الكامل', required: true }));
  }
  if (req.body?.phone !== undefined) {
    fields.push('phone = ?');
    params.push(validatePhone(req.body.phone, false));
  }
  if (req.body?.username !== undefined) {
    const username = validateUsername(req.body.username);
    const existing = get('SELECT id FROM users WHERE lower(username) = lower(?)', username);
    if (existing && existing.id !== id) throw httpError(409, 'اسم المستخدم مستخدم بالفعل');
    fields.push('username = ?');
    params.push(username);
  }
  if (req.body?.role !== undefined) {
    const role = String(req.body.role);
    if (!ROLES.includes(role)) throw httpError(400, 'نوع الحساب غير صالح');
    if (id === req.user.id) throw httpError(400, 'لا يمكنك تغيير نوع حسابك');
    if (role !== user.role) {
      if (user.role === 'doctor' && get('SELECT id FROM courses WHERE doctor_id = ? LIMIT 1', id)) {
        throw httpError(409, 'لا يمكن تغيير نوع الحساب قبل نقل ملكية المواد التي يدرسها');
      }
      if (user.role === 'ta' && get('SELECT id FROM course_tas WHERE ta_id = ? LIMIT 1', id)) {
        throw httpError(409, 'لا يمكن تغيير نوع الحساب قبل إزالته من المواد كمعيد');
      }
      if (user.role === 'student' && get('SELECT id FROM submissions WHERE student_id = ? LIMIT 1', id)) {
        throw httpError(409, 'لا يمكن تغيير نوع الحساب لوجود تسليمات مرتبطة به');
      }
      fields.push('role = ?');
      params.push(role);
    }
  }
  if (req.body?.isActive !== undefined) {
    const active = bool(req.body.isActive, true);
    if (id === req.user.id && !active) throw httpError(400, 'لا يمكنك تعطيل حسابك الشخصي');
    fields.push('is_active = ?');
    params.push(active ? 1 : 0);
    if (!active) run('DELETE FROM sessions WHERE user_id = ?', id);
  }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  fields.push('updated_at = ?');
  params.push(nowIso(), id);
  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...params);
  const fresh = get('SELECT * FROM users WHERE id = ?', id);
  res.json({ user: adminUser(fresh), message: 'تم تحديث الحساب' });
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = get('SELECT * FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'المستخدم غير موجود');
  const temp = `Mn@${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 90 + 10)}`;
  const password = req.body?.password ? validatePassword(req.body.password) : temp;
  run(
    'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?',
    await hashPassword(password), nowIso(), id
  );
  run('DELETE FROM sessions WHERE user_id = ?', id);
  res.json({
    ok: true,
    temporaryPassword: req.body?.password ? null : password,
    message: 'تم إعادة تعيين كلمة المرور وإلغاء جلسات المستخدم'
  });
}));

// حذف نهائي لحساب المستخدم وكل بياناته الخاصة، مع حماية حساب المطور.
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = get('SELECT * FROM users WHERE id = ?', id);
  if (!target) throw httpError(404, 'المستخدم غير موجود');
  if (target.role === 'developer' || id === req.user.id) {
    throw httpError(400, 'لا يمكن حذف حساب مطور أو حسابك الشخصي');
  }
  const confirm = String(req.body?.confirm || '').trim();
  if (confirm !== target.username) {
    throw httpError(400, 'اكتب اسم المستخدم بالضبط لتأكيد الحذف');
  }
  const purge = bool(req.body?.purgeCourses, false);

  const assets = new Set();
  const assignmentIds = new Set();
  const submissionIds = new Set();
  if (target.avatar) assets.add(target.avatar);

  const ownedCourses = all('SELECT id, image FROM courses WHERE doctor_id = ?', id);
  const createdAssignments = all('SELECT id, file FROM assignments WHERE created_by = ?', id);
  const ownSubmissions = all('SELECT id, file FROM submissions WHERE student_id = ?', id);
  ownSubmissions.forEach((row) => {
    submissionIds.add(row.id);
    if (row.file) assets.add(row.file);
  });

  let deletedCourses = 0;

  tx(() => {
    if (purge) {
      for (const course of ownedCourses) {
        const assignments = all('SELECT id, file FROM assignments WHERE course_id = ?', course.id);
        for (const assignment of assignments) {
          assignmentIds.add(assignment.id);
          if (assignment.file) assets.add(assignment.file);
          const subs = all('SELECT id, file FROM submissions WHERE assignment_id = ?', assignment.id);
          subs.forEach((row) => {
            submissionIds.add(row.id);
            if (row.file) assets.add(row.file);
          });
        }
        if (course.image) assets.add(course.image);
        run('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = ?)', course.id);
        run('DELETE FROM assignments WHERE course_id = ?', course.id);
        run('DELETE FROM courses WHERE id = ?', course.id);
        deletedCourses += 1;
      }
      for (const assignment of createdAssignments) {
        if (assignmentIds.has(assignment.id)) continue;
        assignmentIds.add(assignment.id);
        if (assignment.file) assets.add(assignment.file);
        const subs = all('SELECT id, file FROM submissions WHERE assignment_id = ?', assignment.id);
        subs.forEach((row) => {
          submissionIds.add(row.id);
          if (row.file) assets.add(row.file);
        });
        run('DELETE FROM submissions WHERE assignment_id = ?', assignment.id);
        run('DELETE FROM assignments WHERE id = ?', assignment.id);
      }
    } else {
      // الاحتفاظ بالبيانات الأكاديمية ونقل ملكيتها للمطور الحالي.
      if (ownedCourses.length) {
        run('UPDATE courses SET doctor_id = ?, updated_at = ? WHERE doctor_id = ?', req.user.id, nowIso(), id);
      }
      if (createdAssignments.length) {
        run('UPDATE assignments SET created_by = ? WHERE created_by = ?', req.user.id, id);
      }
    }

    run('UPDATE chat_requests SET decided_by = NULL WHERE decided_by = ?', id);
    run('UPDATE submissions SET reviewed_by = NULL WHERE reviewed_by = ?', id);
    run('DELETE FROM users WHERE id = ?', id);
    for (const name of assets) deleteAsset(name);
  });

  res.json({
    ok: true,
    message: 'تم حذف الحساب نهائياً',
    deletedCourses,
    deletedAssignments: assignmentIds.size,
    deletedSubmissions: submissionIds.size,
    deletedFiles: assets.size
  });
}));

// إحصاءات التخزين وتنظيف الملفات غير المرتبطة بأي سجل.
router.get('/storage', asyncHandler(async (req, res) => {
  const rows = all('SELECT name, size FROM assets');
  const bytes = rows.reduce((sum, row) => sum + Number(row.size || 0), 0);
  res.json({
    files: rows.length,
    bytes,
    megabytes: Math.round((bytes / 1024 / 1024) * 10) / 10,
    limitMb: Number(process.env.MAX_FILE_MB || 20)
  });
}));

router.post('/storage/cleanup', asyncHandler(async (req, res) => {
  const referenced = new Set([
    ...all('SELECT avatar AS name FROM users WHERE avatar IS NOT NULL').map((r) => r.name),
    ...all('SELECT image AS name FROM courses WHERE image IS NOT NULL').map((r) => r.name),
    ...all('SELECT file AS name FROM assignments WHERE file IS NOT NULL').map((r) => r.name),
    ...all('SELECT file AS name FROM submissions WHERE file IS NOT NULL').map((r) => r.name)
  ]);
  const orphans = all('SELECT name, size FROM assets').filter((row) => !referenced.has(row.name));
  let bytes = 0;
  tx(() => {
    for (const row of orphans) {
      deleteAsset(row.name);
      bytes += Number(row.size || 0);
    }
  });
  res.json({
    ok: true,
    removed: orphans.length,
    megabytes: Math.round((bytes / 1024 / 1024) * 10) / 10,
    message: orphans.length ? 'تم حذف الملفات غير المستخدمة' : 'لا توجد ملفات غير مستخدمة'
  });
}));

router.get('/courses', asyncHandler(async (req, res) => {
  const courses = all(
    `SELECT c.*, u.full_name AS doctor_name,
      (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) AS students_count,
      (SELECT COUNT(*) FROM course_tas t WHERE t.course_id = c.id) AS tas_count,
      (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id AND a.is_active = 1) AS assignments_count
     FROM courses c JOIN users u ON u.id = c.doctor_id ORDER BY c.id DESC`
  );
  res.json({ courses });
}));

router.get('/assignments', asyncHandler(async (req, res) => {
  const assignments = all(
    `SELECT a.*, c.name AS course_name, c.code AS course_code,
      u.full_name AS creator_name, t.full_name AS ta_name,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submissions_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'graded') AS graded_count
     FROM assignments a JOIN courses c ON c.id = a.course_id
     JOIN users u ON u.id = a.created_by LEFT JOIN users t ON t.id = a.ta_id
     ORDER BY a.id DESC`
  );
  res.json({ assignments });
}));

const SETTING_KEYS = new Set([
  'platform_name', 'faculty_name', 'university_name', 'support_email',
  'reminder_hours', 'default_allow_late', 'allow_student_leave'
]);

router.get('/settings', asyncHandler(async (req, res) => {
  const rows = all('SELECT key, value FROM settings');
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ settings });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const body = req.body || {};
  for (const [key, value] of Object.entries(body)) {
    if (!SETTING_KEYS.has(key)) continue;
    setSetting(key, String(value ?? '').slice(0, 500));
  }
  const rows = all('SELECT key, value FROM settings');
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])), message: 'تم حفظ الإعدادات' });
}));

router.get('/roles', asyncHandler(async (req, res) => {
  res.json({
    roles: [
      { id: 'developer', name: 'المطور', description: 'إدارة كاملة للمنصة والحسابات والإعدادات' },
      { id: 'doctor', name: 'دكتور', description: 'إنشاء المواد وإدارة المعيدين والطلاب والتكليفات' },
      { id: 'ta', name: 'معيد', description: 'إدارة شات السكشن وطلبات الانضمام والتكليفات المسندة' },
      { id: 'student', name: 'طالب', description: 'الاشتراك في المواد والتفاعل مع الشاتات وتسليم التكليفات' }
    ]
  });
}));

export default router;
