import express from 'express';
import { all, get, nowIso, run, setting } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  assignmentAccess,
  assignmentVisibleTo,
  courseAccess,
  eligibleStudentIds,
  requireCourseManager
} from '../access.js';
import { notifyUsers } from '../notify.js';
import {
  asyncHandler,
  bool,
  httpError,
  isoDate,
  numberOrNull,
  optionalId,
  text
} from '../util.js';
import { assignmentUpload, removeUpload, submissionUpload } from '../uploads.js';

const router = express.Router();
router.use(requireAuth);

function assignmentDto(row, user) {
  const course = get('SELECT * FROM courses WHERE id = ?', row.course_id);
  const creator = get('SELECT id, full_name, role FROM users WHERE id = ?', row.created_by);
  const ta = row.ta_id ? get('SELECT id, full_name, avatar FROM users WHERE id = ?', row.ta_id) : null;
  const submission = user.role === 'student'
    ? get('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', row.id, user.id)
    : null;
  const now = Date.now();
  const due = new Date(row.due_at).getTime();
  let status = 'pending';
  if (submission) status = submission.status;
  else if (now > due) status = 'expired';
  const canSubmit = user.role === 'student' && !!row.is_active &&
    new Date(row.published_at).getTime() <= now &&
    (now <= due || !!row.allow_late) &&
    submission?.status !== 'graded';
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: course?.name || '',
    courseCode: course?.code || '',
    scope: row.scope,
    taId: row.ta_id,
    taName: ta?.full_name || null,
    taAvatar: ta?.avatar || null,
    createdBy: row.created_by,
    creatorName: creator?.full_name || '',
    creatorRole: creator?.role || '',
    title: row.title,
    description: row.description || '',
    file: row.file,
    fileName: row.file_name,
    fileSize: row.file_size,
    publishedAt: row.published_at,
    dueAt: row.due_at,
    allowLate: !!row.allow_late,
    maxGrade: row.max_grade,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    status,
    submission: submission ? {
      id: submission.id,
      fileName: submission.file_name,
      submittedAt: submission.submitted_at,
      isLate: !!submission.is_late,
      status: submission.status,
      grade: submission.grade,
      feedback: submission.feedback
    } : null,
    canSubmit,
    submissionsCount: row.submissions_count ?? undefined,
    gradedCount: row.graded_count ?? undefined,
    eligibleCount: row.eligible_count ?? undefined
  };
}

function notifyAssignmentAudience(assignment, actorId, isUpdate = false) {
  const course = get('SELECT * FROM courses WHERE id = ?', assignment.course_id);
  const doctor = course.doctor_id;
  const taIds = all('SELECT ta_id FROM course_tas WHERE course_id = ?', assignment.course_id).map((r) => r.ta_id);
  const studentIds = eligibleStudentIds(assignment);
  const recipients = [...new Set([...studentIds, doctor, ...taIds, assignment.ta_id].filter(Boolean))];
  notifyUsers(recipients, {
    type: isUpdate ? 'assignment_update' : 'assignment_new',
    title: isUpdate ? 'تحديث تكليف' : 'تكليف جديد',
    body: `${assignment.title} - ${course.name}`,
    link: `/assignment/${assignment.id}`
  }, { excludeUserId: actorId });
}

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  const courseFilter = optionalId(req.query.courseId);
  const archived = bool(req.query.archived, false);
  const where = [];
  const params = [];

  if (user.role === 'student') {
    where.push('a.is_active = 1');
    where.push('a.published_at <= ?');
    params.push(nowIso());
    where.push('a.course_id IN (SELECT course_id FROM course_students WHERE student_id = ?)');
    params.push(user.id);
  } else if (user.role === 'doctor') {
    where.push('a.course_id IN (SELECT id FROM courses WHERE doctor_id = ?)');
    params.push(user.id);
    if (!archived) where.push('a.is_active = 1');
  } else if (user.role === 'ta') {
    where.push('a.course_id IN (SELECT course_id FROM course_tas WHERE ta_id = ?)');
    params.push(user.id);
    where.push("(a.scope = 'general' OR a.ta_id = ?)");
    params.push(user.id);
    if (!archived) where.push('a.is_active = 1');
  } else {
    if (!archived) where.push('a.is_active = 1');
  }
  if (courseFilter) {
    where.push('a.course_id = ?');
    params.push(courseFilter);
  }
  const rows = all(
    `SELECT a.*, (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submissions_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'graded') AS graded_count
     FROM assignments a
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.is_active DESC, a.due_at ASC`,
    ...params
  );
  const visible = [];
  for (const row of rows) {
    const ctx = courseAccess(row.course_id, user);
    if (user.role === 'student' && !assignmentVisibleTo(row, user, ctx)) continue;
    if (user.role !== 'student') row.eligible_count = eligibleStudentIds(row).length;
    visible.push(assignmentDto(row, user));
  }
  res.json({ assignments: visible });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const access = assignmentAccess(Number(req.params.id), req.user);
  const { assignment, ctx } = access;
  if (req.user.role === 'student') {
    if (!access.studentVisible) throw httpError(403, 'هذا التكليف غير متاح لك');
    if (new Date(assignment.published_at).getTime() > Date.now()) throw httpError(403, 'لم يتم نشر التكليف بعد');
  } else if (!access.staffVisible && !access.canManage) {
    throw httpError(403, 'لا تملك صلاحية الوصول إلى هذا التكليف');
  }
  const counts = access.canManage
    ? {
      eligible_count: eligibleStudentIds(assignment).length,
      submissions_count: get('SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ?', assignment.id).n,
      graded_count: get("SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ? AND status = 'graded'", assignment.id).n
    }
    : {};
  const row = { ...assignment, ...counts };
  res.json({ assignment: assignmentDto(row, req.user), canManage: access.canManage, canViewSubmissions: access.canManage });
}));

router.post('/', requireRole('doctor', 'ta', 'developer'), assignmentUpload, asyncHandler(async (req, res) => {
  const courseId = Number(req.body?.courseId);
  const ctx = courseAccess(courseId, req.user);
  let scope = req.body?.scope === 'ta' ? 'ta' : 'general';
  let taId = optionalId(req.body?.taId);

  if (req.user.role === 'doctor') requireCourseManager(ctx);
  if (req.user.role === 'developer') {
    // allowed
  } else if (req.user.role === 'ta') {
    if (!ctx.isTa) throw httpError(403, 'أنت لست معيداً في هذه المادة');
    if (!ctx.taRow.can_create_assignments) throw httpError(403, 'الدكتور لم يمنحك صلاحية إنشاء التكليفات');
    if (scope === 'general' && !ctx.taRow.can_post_general) {
      throw httpError(403, 'نشر التكليفات العامة يتطلب موافقة الدكتور');
    }
    taId = req.user.id;
  }
  if (scope === 'ta') {
    if (!taId) throw httpError(400, 'اختر المعيد المسؤول عن التكليف');
    const taRow = get('SELECT * FROM course_tas WHERE course_id = ? AND ta_id = ?', courseId, taId);
    if (!taRow) throw httpError(400, 'المعيد المحدد غير مضاف لهذه المادة');
    if (req.user.role === 'ta' && taId !== req.user.id) throw httpError(403, 'يمكنك إنشاء تكليفات خاصة بك فقط');
  } else {
    taId = null;
  }

  const title = text(req.body?.title, { min: 3, max: 160, label: 'عنوان التكليف', required: true });
  const description = text(req.body?.description, { max: 5000, label: 'وصف التكليف' });
  const publishedAt = isoDate(req.body?.publishedAt) || nowIso();
  const dueAt = isoDate(req.body?.dueAt, { label: 'موعد التسليم', required: true });
  if (new Date(dueAt).getTime() <= new Date(publishedAt).getTime()) {
    throw httpError(400, 'موعد التسليم يجب أن يكون بعد وقت النشر');
  }
  const allowLate = bool(req.body?.allowLate, setting('default_allow_late', '0') === '1') ? 1 : 0;
  const maxGrade = numberOrNull(req.body?.maxGrade, { min: 0, max: 1000 });
  const now = nowIso();
  const info = run(
    `INSERT INTO assignments(course_id, scope, ta_id, created_by, title, description, file, file_name, file_size, file_mime,
      published_at, due_at, allow_late, max_grade, is_active, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    courseId, scope, taId, req.user.id, title, description,
    req.file?.filename || null, req.file ? req.file.originalname : null, req.file?.size || null, req.file?.mimetype || null,
    publishedAt, dueAt, allowLate, maxGrade, now, now
  );
  const assignment = get('SELECT * FROM assignments WHERE id = ?', Number(info.lastInsertRowid));
  if (new Date(publishedAt).getTime() <= Date.now()) notifyAssignmentAudience(assignment, req.user.id);
  res.status(201).json({ assignment: assignmentDto(assignment, req.user), message: 'تم نشر التكليف بنجاح' });
}));

router.patch('/:id', requireRole('doctor', 'ta', 'developer'), assignmentUpload, asyncHandler(async (req, res) => {
  const access = assignmentAccess(Number(req.params.id), req.user);
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية تعديل هذا التكليف');
  const assignment = access.assignment;
  const fields = [];
  const params = [];
  if (req.body?.title !== undefined) { fields.push('title = ?'); params.push(text(req.body.title, { min: 3, max: 160, label: 'عنوان التكليف', required: true })); }
  if (req.body?.description !== undefined) { fields.push('description = ?'); params.push(text(req.body.description, { max: 5000, label: 'الوصف' })); }
  if (req.body?.publishedAt !== undefined) { fields.push('published_at = ?'); params.push(isoDate(req.body.publishedAt, { label: 'وقت النشر', required: true })); }
  if (req.body?.dueAt !== undefined) { fields.push('due_at = ?'); params.push(isoDate(req.body.dueAt, { label: 'موعد التسليم', required: true })); }
  if (req.body?.allowLate !== undefined) { fields.push('allow_late = ?'); params.push(bool(req.body.allowLate) ? 1 : 0); }
  if (req.body?.maxGrade !== undefined) { fields.push('max_grade = ?'); params.push(numberOrNull(req.body.maxGrade)); }
  if (req.body?.scope !== undefined && access.ctx.isManager) {
    const scope = req.body.scope === 'ta' ? 'ta' : 'general';
    let taId = scope === 'ta' ? optionalId(req.body?.taId) : null;
    if (scope === 'ta') {
      if (!taId) throw httpError(400, 'اختر المعيد المسؤول');
      if (!get('SELECT id FROM course_tas WHERE course_id = ? AND ta_id = ?', assignment.course_id, taId)) {
        throw httpError(400, 'المعيد المحدد غير مضاف لهذه المادة');
      }
    }
    fields.push('scope = ?', 'ta_id = ?');
    params.push(scope, taId);
  }
  if (req.file) {
    fields.push('file = ?', 'file_name = ?', 'file_size = ?', 'file_mime = ?');
    params.push(req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);
  }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  fields.push('updated_at = ?');
  params.push(nowIso(), assignment.id);
  run(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`, ...params);
  if (req.file && assignment.file) removeUpload('assignment', assignment.file);
  const fresh = get('SELECT * FROM assignments WHERE id = ?', assignment.id);
  notifyAssignmentAudience(fresh, req.user.id, true);
  res.json({ assignment: assignmentDto(fresh, req.user), message: 'تم تحديث التكليف' });
}));

router.delete('/:id', requireRole('doctor', 'ta', 'developer'), asyncHandler(async (req, res) => {
  const access = assignmentAccess(Number(req.params.id), req.user);
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية حذف هذا التكليف');
  run('UPDATE assignments SET is_active = 0, updated_at = ? WHERE id = ?', nowIso(), access.assignment.id);
  res.json({ ok: true, message: 'تم حذف التكليف. التسليمات السابقة محفوظة في السجل' });
}));

router.post('/:id/submit', requireRole('student'), submissionUpload, asyncHandler(async (req, res) => {
  const access = assignmentAccess(Number(req.params.id), req.user);
  const { assignment } = access;
  if (!assignment.is_active) throw httpError(403, 'هذا التكليف غير متاح');
  if (!access.studentVisible) throw httpError(403, 'هذا التكليف غير متاح لك');
  if (new Date(assignment.published_at).getTime() > Date.now()) throw httpError(403, 'لم يتم نشر التكليف بعد');
  if (!req.file) throw httpError(400, 'اختر ملف الحل أولاً');
  const now = nowIso();
  const late = Date.now() > new Date(assignment.due_at).getTime();
  if (late && !assignment.allow_late) {
    removeUpload('submission', req.file.filename);
    throw httpError(403, 'انتهى موعد التسليم ولا يُسمح بالتسليم المتأخر');
  }
  const existing = get('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', assignment.id, req.user.id);
  if (existing?.status === 'graded') {
    removeUpload('submission', req.file.filename);
    throw httpError(409, 'تم تصحيح تسليمك بالفعل، لا يمكن تعديله');
  }
  if (existing) {
    run(
      `UPDATE submissions SET file = ?, file_name = ?, file_size = ?, file_mime = ?, submitted_at = ?, is_late = ?,
       status = 'submitted', grade = NULL, feedback = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?`,
      req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, now, late ? 1 : 0, existing.id
    );
    removeUpload('submission', existing.file);
  } else {
    run(
      `INSERT INTO submissions(assignment_id, student_id, file, file_name, file_size, file_mime, submitted_at, is_late, status)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      assignment.id, req.user.id, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, now, late ? 1 : 0
    );
  }
  const course = get('SELECT * FROM courses WHERE id = ?', assignment.course_id);
  const staff = [...new Set([course.doctor_id, assignment.created_by, assignment.ta_id].filter(Boolean))];
  notifyUsers(staff, {
    type: 'submission_new',
    title: late ? 'تسليم متأخر جديد' : 'تسليم جديد',
    body: `${req.user.full_name} سلّم حل تكليف ${assignment.title}`,
    link: `/assignment/${assignment.id}`
  }, { excludeUserId: req.user.id });
  const fresh = get('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', assignment.id, req.user.id);
  res.status(201).json({
    submission: {
      id: fresh.id,
      fileName: fresh.file_name,
      submittedAt: fresh.submitted_at,
      isLate: !!fresh.is_late,
      status: fresh.status
    },
    message: late ? 'تم تسليم الحل متأخراً' : 'تم تسليم الحل بنجاح'
  });
}));

router.get('/:id/submissions', asyncHandler(async (req, res) => {
  const access = assignmentAccess(Number(req.params.id), req.user);
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية عرض تسليمات هذا التكليف');
  const assignment = access.assignment;
  const students = all(
    `SELECT u.id, u.full_name, u.username, u.avatar, u.phone FROM course_students cs
     JOIN users u ON u.id = cs.student_id WHERE cs.course_id = ? AND u.is_active = 1 ORDER BY u.full_name`,
    assignment.course_id
  ).filter((student) => {
    if (assignment.scope === 'general') return true;
    if (!assignment.ta_id) return false;
    const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", assignment.course_id, assignment.ta_id);
    return chat && get("SELECT 1 AS ok FROM chat_requests WHERE chat_id = ? AND student_id = ? AND status = 'approved'", chat.id, student.id);
  });
  const submissions = all(
    `SELECT s.*, u.full_name, u.username, u.avatar FROM submissions s JOIN users u ON u.id = s.student_id
     WHERE s.assignment_id = ?`,
    assignment.id
  );
  const byStudent = new Map(submissions.map((s) => [s.student_id, s]));
  const rows = students.map((student) => {
    const sub = byStudent.get(student.id);
    return {
      studentId: student.id,
      studentName: student.full_name,
      username: student.username,
      avatar: student.avatar,
      phone: student.phone,
      submitted: !!sub,
      submission: sub ? {
        id: sub.id,
        fileName: sub.file_name,
        submittedAt: sub.submitted_at,
        isLate: !!sub.is_late,
        status: sub.status,
        grade: sub.grade,
        feedback: sub.feedback
      } : null
    };
  });
  res.json({
    assignment: assignmentDto(assignment, req.user),
    rows,
    summary: {
      eligible: rows.length,
      submitted: rows.filter((r) => r.submitted).length,
      graded: rows.filter((r) => r.submission?.status === 'graded').length,
      late: rows.filter((r) => r.submission?.isLate).length
    }
  });
}));

export default router;

export const submissionsRouter = express.Router();
submissionsRouter.use(requireAuth);

submissionsRouter.get('/mine', requireRole('student'), asyncHandler(async (req, res) => {
  const rows = all(
    `SELECT s.*, a.title AS assignment_title, a.due_at, a.max_grade, c.name AS course_name, c.id AS course_id
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
     WHERE s.student_id = ? ORDER BY s.submitted_at DESC`,
    req.user.id
  );
  res.json({
    submissions: rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      courseId: row.course_id,
      courseName: row.course_name,
      dueAt: row.due_at,
      fileName: row.file_name,
      submittedAt: row.submitted_at,
      isLate: !!row.is_late,
      status: row.status,
      grade: row.grade,
      maxGrade: row.max_grade,
      feedback: row.feedback
    }))
  });
}));

submissionsRouter.patch('/:id', requireRole('doctor', 'ta', 'developer'), asyncHandler(async (req, res) => {
  const submission = get('SELECT * FROM submissions WHERE id = ?', Number(req.params.id));
  if (!submission) throw httpError(404, 'التسليم غير موجود');
  const access = assignmentAccess(submission.assignment_id, req.user);
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية تصحيح هذا التسليم');
  const status = String(req.body?.status || '');
  if (!['submitted', 'reviewed', 'graded'].includes(status)) throw httpError(400, 'حالة التسليم غير صالحة');
  const max = access.assignment.max_grade;
  let grade = submission.grade;
  if (req.body?.grade !== undefined) {
    grade = req.body.grade === '' || req.body.grade == null ? null : Number(req.body.grade);
    if (grade != null && (!Number.isFinite(grade) || grade < 0)) throw httpError(400, 'الدرجة غير صالحة');
    if (grade != null && max != null && grade > max) throw httpError(400, `الدرجة يجب ألا تتجاوز ${max}`);
  }
  const feedback = req.body?.feedback !== undefined
    ? text(req.body.feedback, { max: 3000, label: 'الملاحظات' })
    : (submission.feedback || '');
  const now = nowIso();
  run(
    'UPDATE submissions SET status = ?, grade = ?, feedback = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
    status, grade, feedback, req.user.id, now, submission.id
  );
  const student = get('SELECT * FROM users WHERE id = ?', submission.student_id);
  notifyUsers([submission.student_id], {
    type: 'submission_review',
    title: status === 'graded' ? 'تم تصحيح تكليفك' : 'تمت مراجعة تسليمك',
    body: `${access.assignment.title}${grade != null ? ` - الدرجة: ${grade}` : ''}`,
    link: `/assignment/${access.assignment.id}`
  });
  res.json({
    submission: {
      id: submission.id,
      status,
      grade,
      feedback,
      studentName: student?.full_name || ''
    },
    message: 'تم حفظ التصحيح'
  });
}));
