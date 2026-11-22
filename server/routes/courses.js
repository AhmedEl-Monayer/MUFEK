import express from 'express';
import { all, get, nowIso, run, setting } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { courseAccess, courseMemberIds, requireCourseManager, requireCourseStaff, requireCourseView } from '../access.js';
import { notifyUsers } from '../notify.js';
import {
  asyncHandler,
  bool,
  httpError,
  optionalId,
  text
} from '../util.js';
import { courseUpload, removeUpload } from '../uploads.js';

const router = express.Router();
router.use(requireAuth);

function courseCounts(courseId) {
  return {
    studentsCount: get('SELECT COUNT(*) AS n FROM course_students WHERE course_id = ?', courseId).n,
    tasCount: get('SELECT COUNT(*) AS n FROM course_tas WHERE course_id = ?', courseId).n,
    assignmentsCount: get('SELECT COUNT(*) AS n FROM assignments WHERE course_id = ? AND is_active = 1', courseId).n
  };
}

function listDto(row, user) {
  const counts = courseCounts(row.id);
  const doctor = get('SELECT full_name, avatar FROM users WHERE id = ?', row.doctor_id);
  const membership = get('SELECT joined_at FROM course_students WHERE course_id = ? AND student_id = ?', row.id, user.id);
  const taRow = get('SELECT * FROM course_tas WHERE course_id = ? AND ta_id = ?', row.id, user.id);
  const general = get("SELECT id FROM chats WHERE course_id = ? AND type = 'general'", row.id);
  let myTaChat = null;
  if (membership) {
    myTaChat = get(
      `SELECT ch.id AS chat_id, ch.ta_id, u.full_name AS ta_name, cr.status
       FROM chat_requests cr JOIN chats ch ON ch.id = cr.chat_id JOIN users u ON u.id = ch.ta_id
       WHERE ch.course_id = ? AND cr.student_id = ? AND cr.status = 'approved' LIMIT 1`,
      row.id, user.id
    );
  }
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    image: row.image,
    isActive: !!row.is_active,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name || doctor?.full_name || '',
    doctorAvatar: doctor?.avatar || null,
    createdAt: row.created_at,
    ...counts,
    joined: !!membership,
    joinedAt: membership?.joined_at || null,
    myTa: taRow ? {
      id: taRow.id,
      sectionDay: taRow.section_day,
      sectionTime: taRow.section_time,
      sectionRoom: taRow.section_room,
      canCreateAssignments: !!taRow.can_create_assignments,
      canPostGeneral: !!taRow.can_post_general
    } : null,
    myTaChat,
    generalChatId: general?.id || null
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  let rows;
  if (user.role === 'developer') {
    rows = all(
      `SELECT c.*, u.full_name AS doctor_name FROM courses c JOIN users u ON u.id = c.doctor_id ORDER BY c.id DESC`
    );
  } else if (user.role === 'doctor') {
    rows = all(
      `SELECT c.*, u.full_name AS doctor_name FROM courses c JOIN users u ON u.id = c.doctor_id
       WHERE c.doctor_id = ? ORDER BY c.id DESC`,
      user.id
    );
  } else if (user.role === 'ta') {
    rows = all(
      `SELECT c.*, u.full_name AS doctor_name FROM courses c
       JOIN users u ON u.id = c.doctor_id
       JOIN course_tas t ON t.course_id = c.id AND t.ta_id = ?
       ORDER BY c.id DESC`,
      user.id
    );
  } else {
    rows = all(
      `SELECT c.*, u.full_name AS doctor_name FROM courses c JOIN users u ON u.id = c.doctor_id
       WHERE c.is_active = 1 ORDER BY c.id DESC`
    );
  }
  res.json({ courses: rows.map((row) => listDto(row, user)) });
}));

router.post('/', requireRole('doctor', 'developer'), courseUpload, asyncHandler(async (req, res) => {
  const name = text(req.body?.name, { min: 3, max: 120, label: 'اسم المادة', required: true });
  const code = text(req.body?.code, { max: 24, label: 'كود المادة' });
  const description = text(req.body?.description, { max: 3000, label: 'الوصف' });
  let doctorId = req.user.id;
  if (req.user.role === 'developer' && req.body?.doctorId) {
    doctorId = Number(req.body.doctorId);
    const doctor = get("SELECT id FROM users WHERE id = ? AND role = 'doctor' AND is_active = 1", doctorId);
    if (!doctor) throw httpError(400, 'الدكتور المحدد غير صالح');
  }
  if (req.user.role !== 'developer' && req.user.role !== 'doctor') throw httpError(403, 'غير مصرح');

  const now = nowIso();
  const info = run(
    'INSERT INTO courses(name, code, description, image, doctor_id, is_active, created_at, updated_at) VALUES(?, ?, ?, ?, ?, 1, ?, ?)',
    name, code, description, req.file?.filename || null, doctorId, now, now
  );
  const courseId = Number(info.lastInsertRowid);
  run("INSERT INTO chats(course_id, type, write_mode, is_locked, created_at) VALUES(?, 'general', 'all', 0, ?)", courseId, now);
  res.status(201).json({
    course: listDto(get('SELECT * FROM courses WHERE id = ?', courseId), req.user),
    message: 'تم إنشاء مجموعة المادة بنجاح'
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const ctx = requireCourseView(courseAccess(Number(req.params.id), req.user));
  const course = get(
    `SELECT c.*, u.full_name AS doctor_name, u.avatar AS doctor_avatar, u.phone AS doctor_phone
     FROM courses c JOIN users u ON u.id = c.doctor_id WHERE c.id = ?`,
    ctx.course.id
  );
  const base = listDto(course, req.user);
  const tas = all(
    `SELECT t.*, u.full_name, u.username, u.avatar, u.phone, ch.id AS chat_id
     FROM course_tas t JOIN users u ON u.id = t.ta_id
     LEFT JOIN chats ch ON ch.course_id = t.course_id AND ch.type = 'ta' AND ch.ta_id = t.ta_id
     WHERE t.course_id = ? ORDER BY u.full_name`,
    course.id
  ).map((row) => {
    const request = req.user.role === 'student'
      ? get('SELECT status FROM chat_requests WHERE chat_id = ? AND student_id = ?', row.chat_id, req.user.id)
      : null;
    return {
      id: row.ta_id,
      courseTaId: row.id,
      fullName: row.full_name,
      username: row.username,
      avatar: row.avatar,
      phone: row.phone,
      chatId: row.chat_id,
      sectionDay: row.section_day,
      sectionTime: row.section_time,
      sectionRoom: row.section_room,
      canCreateAssignments: !!row.can_create_assignments,
      canPostGeneral: !!row.can_post_general,
      addedAt: row.added_at,
      requestStatus: request?.status || null
    };
  });
  const generalChat = get("SELECT * FROM chats WHERE course_id = ? AND type = 'general'", course.id);
  const myTaRequest = req.user.role === 'student'
    ? get(
      `SELECT cr.*, ch.ta_id, u.full_name AS ta_name FROM chat_requests cr
       JOIN chats ch ON ch.id = cr.chat_id JOIN users u ON u.id = ch.ta_id
       WHERE ch.course_id = ? AND cr.student_id = ? ORDER BY cr.id DESC LIMIT 1`,
      course.id, req.user.id
    )
    : null;
  res.json({
    course: {
      ...base,
      doctorPhone: course.doctor_phone,
      tas,
      generalChat: generalChat ? {
        id: generalChat.id,
        writeMode: generalChat.write_mode,
        isLocked: !!generalChat.is_locked
      } : null,
      myTaRequest: myTaRequest || null,
      permissions: {
        canManage: ctx.isManager,
        isTa: ctx.isTa,
        isOwner: ctx.isOwner,
        canLeave: setting('allow_student_leave', '1') === '1'
      }
    }
  });
}));

router.patch('/:id', requireRole('doctor', 'developer'), courseUpload, asyncHandler(async (req, res) => {
  const ctx = requireCourseManager(courseAccess(Number(req.params.id), req.user));
  const course = ctx.course;
  const fields = [];
  const params = [];
  if (req.body?.name !== undefined) {
    fields.push('name = ?');
    params.push(text(req.body.name, { min: 3, max: 120, label: 'اسم المادة', required: true }));
  }
  if (req.body?.code !== undefined) {
    fields.push('code = ?');
    params.push(text(req.body.code, { max: 24, label: 'كود المادة' }));
  }
  if (req.body?.description !== undefined) {
    fields.push('description = ?');
    params.push(text(req.body.description, { max: 3000, label: 'الوصف' }));
  }
  if (req.body?.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(bool(req.body.isActive, true) ? 1 : 0);
  }
  if (req.file) {
    fields.push('image = ?');
    params.push(req.file.filename);
  }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  fields.push('updated_at = ?');
  params.push(nowIso(), course.id);
  run(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, ...params);
  if (req.file && course.image) removeUpload('course', course.image);
  const fresh = get('SELECT * FROM courses WHERE id = ?', course.id);
  notifyUsers(courseMemberIds(course.id), {
    type: 'course_update',
    title: 'تحديث بيانات المادة',
    body: `تم تحديث بيانات مادة ${fresh.name}`,
    link: req.user.role === 'student' ? `/student/courses/${course.id}` : `/doctor/courses/${course.id}`
  }, { excludeUserId: req.user.id });
  res.json({ course: listDto(fresh, req.user), message: 'تم تحديث المادة' });
}));

router.post('/:id/join', requireRole('student'), asyncHandler(async (req, res) => {
  const ctx = courseAccess(Number(req.params.id), req.user);
  if (!ctx.course.is_active) throw httpError(403, 'هذه المادة غير متاحة للاشتراك حالياً');
  if (ctx.isStudent) throw httpError(409, 'أنت مشترك في هذه المادة بالفعل');
  run('INSERT INTO course_students(course_id, student_id, joined_at) VALUES(?, ?, ?)', ctx.course.id, req.user.id, nowIso());
  notifyUsers([ctx.course.doctor_id], {
    type: 'course_join',
    title: 'طالب جديد في المادة',
    body: `${req.user.full_name} اشترك في مادة ${ctx.course.name}`,
    link: `/doctor/courses/${ctx.course.id}`
  });
  res.json({ ok: true, message: 'تم الاشتراك في المادة' });
}));

router.delete('/:id/join', requireRole('student'), asyncHandler(async (req, res) => {
  const ctx = courseAccess(Number(req.params.id), req.user);
  if (!ctx.isStudent) throw httpError(400, 'أنت غير مشترك في هذه المادة');
  if (setting('allow_student_leave', '1') !== '1') {
    throw httpError(403, 'إلغاء الاشتراك غير متاح لهذه المادة. تواصل مع الدكتور');
  }
  run('DELETE FROM course_students WHERE course_id = ? AND student_id = ?', ctx.course.id, req.user.id);
  run(
    `DELETE FROM chat_requests WHERE student_id = ? AND chat_id IN (SELECT id FROM chats WHERE course_id = ?)`,
    req.user.id, ctx.course.id
  );
  notifyUsers([ctx.course.doctor_id], {
    type: 'course_leave',
    title: 'إلغاء اشتراك طالب',
    body: `${req.user.full_name} ألغى اشتراكه في مادة ${ctx.course.name}`,
    link: `/doctor/courses/${ctx.course.id}`
  });
  res.json({ ok: true, message: 'تم إلغاء الاشتراك' });
}));

router.get('/:id/students', requireRole('doctor', 'ta', 'developer'), asyncHandler(async (req, res) => {
  const ctx = requireCourseStaff(courseAccess(Number(req.params.id), req.user));
  const students = all(
    `SELECT u.id, u.full_name, u.username, u.avatar, u.phone, cs.joined_at,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id
        WHERE s.student_id = u.id AND a.course_id = ?) AS submissions_count
     FROM course_students cs JOIN users u ON u.id = cs.student_id
     WHERE cs.course_id = ? ORDER BY cs.joined_at DESC`,
    ctx.course.id, ctx.course.id
  ).map((row) => {
    const taChat = get(
      `SELECT ch.ta_id, u2.full_name AS ta_name, cr.status FROM chat_requests cr
       JOIN chats ch ON ch.id = cr.chat_id JOIN users u2 ON u2.id = ch.ta_id
       WHERE ch.course_id = ? AND cr.student_id = ? AND cr.status = 'approved' LIMIT 1`,
      ctx.course.id, row.id
    );
    return {
      id: row.id,
      fullName: row.full_name,
      username: row.username,
      avatar: row.avatar,
      phone: row.phone,
      joinedAt: row.joined_at,
      submissionsCount: row.submissions_count,
      taName: taChat?.ta_name || null,
      taId: taChat?.ta_id || null
    };
  });
  res.json({ students });
}));

router.delete('/:id/students/:studentId', requireRole('doctor', 'developer'), asyncHandler(async (req, res) => {
  const ctx = requireCourseManager(courseAccess(Number(req.params.id), req.user));
  const studentId = Number(req.params.studentId);
  const membership = get('SELECT * FROM course_students WHERE course_id = ? AND student_id = ?', ctx.course.id, studentId);
  if (!membership) throw httpError(404, 'الطالب غير مشترك في المادة');
  run('DELETE FROM course_students WHERE course_id = ? AND student_id = ?', ctx.course.id, studentId);
  run(
    `DELETE FROM chat_requests WHERE student_id = ? AND chat_id IN (SELECT id FROM chats WHERE course_id = ?)`,
    studentId, ctx.course.id
  );
  notifyUsers([studentId], {
    type: 'course_removed',
    title: 'تمت إزالتك من المادة',
    body: `تمت إزالتك من مادة ${ctx.course.name} بواسطة إدارة المادة`,
    link: '/student/courses'
  });
  res.json({ ok: true, message: 'تمت إزالة الطالب من المادة' });
}));

router.get('/:id/tas', asyncHandler(async (req, res) => {
  const ctx = requireCourseView(courseAccess(Number(req.params.id), req.user));
  const tas = all(
    `SELECT t.*, u.full_name, u.username, u.avatar, u.phone, ch.id AS chat_id,
      (SELECT COUNT(*) FROM chat_requests cr WHERE cr.chat_id = ch.id AND cr.status = 'pending') AS pending_count,
      (SELECT COUNT(*) FROM chat_requests cr WHERE cr.chat_id = ch.id AND cr.status = 'approved') AS members_count
     FROM course_tas t JOIN users u ON u.id = t.ta_id
     LEFT JOIN chats ch ON ch.course_id = t.course_id AND ch.type = 'ta' AND ch.ta_id = t.ta_id
     WHERE t.course_id = ? ORDER BY u.full_name`,
    ctx.course.id
  ).map((row) => ({
    id: row.ta_id,
    fullName: row.full_name,
    username: row.username,
    avatar: row.avatar,
    phone: row.phone,
    chatId: row.chat_id,
    sectionDay: row.section_day,
    sectionTime: row.section_time,
    sectionRoom: row.section_room,
    canCreateAssignments: !!row.can_create_assignments,
    canPostGeneral: !!row.can_post_general,
    addedAt: row.added_at,
    pendingCount: row.pending_count || 0,
    membersCount: row.members_count || 0,
    requestStatus: req.user.role === 'student'
      ? get('SELECT status FROM chat_requests WHERE chat_id = ? AND student_id = ?', row.chat_id, req.user.id)?.status || null
      : null
  }));
  res.json({ tas });
}));

router.get('/:id/available-tas', requireRole('doctor', 'developer'), asyncHandler(async (req, res) => {
  const ctx = requireCourseManager(courseAccess(Number(req.params.id), req.user));
  const tas = all(
    `SELECT id, full_name, username, avatar, phone FROM users
     WHERE role = 'ta' AND is_active = 1 AND id NOT IN (SELECT ta_id FROM course_tas WHERE course_id = ?)
     ORDER BY full_name`,
    ctx.course.id
  );
  res.json({ tas });
}));

router.post('/:id/tas', requireRole('doctor', 'developer'), asyncHandler(async (req, res) => {
  const ctx = requireCourseManager(courseAccess(Number(req.params.id), req.user));
  const taId = Number(req.body?.taId);
  const ta = get("SELECT * FROM users WHERE id = ? AND role = 'ta' AND is_active = 1", taId);
  if (!ta) throw httpError(400, 'المعيد غير موجود أو غير مفعل');
  if (get('SELECT id FROM course_tas WHERE course_id = ? AND ta_id = ?', ctx.course.id, taId)) {
    throw httpError(409, 'هذا المعيد مضاف بالفعل للمادة');
  }
  const now = nowIso();
  run(
    `INSERT INTO course_tas(course_id, ta_id, section_day, section_time, section_room,
      can_create_assignments, can_post_general, added_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.course.id, taId,
    text(req.body?.sectionDay, { max: 30, label: 'يوم السكشن' }),
    text(req.body?.sectionTime, { max: 40, label: 'وقت السكشن' }),
    text(req.body?.sectionRoom, { max: 60, label: 'مكان السكشن' }),
    bool(req.body?.canCreateAssignments, true) ? 1 : 0,
    bool(req.body?.canPostGeneral, false) ? 1 : 0,
    now
  );
  let chat = get("SELECT * FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", ctx.course.id, taId);
  if (!chat) {
    const info = run("INSERT INTO chats(course_id, type, ta_id, write_mode, is_locked, created_at) VALUES(?, 'ta', ?, 'all', 0, ?)", ctx.course.id, taId, now);
    chat = get('SELECT * FROM chats WHERE id = ?', Number(info.lastInsertRowid));
  }
  notifyUsers([taId], {
    type: 'ta_added',
    title: 'إضافة إلى مادة جديدة',
    body: `تمت إضافتك كمعيد لمادة ${ctx.course.name}`,
    link: `/ta/courses/${ctx.course.id}`
  });
  res.status(201).json({ ok: true, chatId: chat.id, message: 'تمت إضافة المعيد وإنشاء شات خاص به' });
}));

router.patch('/:id/tas/:taId', asyncHandler(async (req, res) => {
  const ctx = courseAccess(Number(req.params.id), req.user);
  const taId = Number(req.params.taId);
  const isSelf = ctx.isTa && req.user.id === taId;
  if (!ctx.isManager && !isSelf) throw httpError(403, 'لا تملك صلاحية تعديل بيانات هذا المعيد');
  const row = get('SELECT * FROM course_tas WHERE course_id = ? AND ta_id = ?', ctx.course.id, taId);
  if (!row) throw httpError(404, 'المعيد غير مضاف لهذه المادة');

  const fields = [];
  const params = [];
  const sectionChanged = ['sectionDay', 'sectionTime', 'sectionRoom'].some((k) => req.body?.[k] !== undefined);
  if (req.body?.sectionDay !== undefined) { fields.push('section_day = ?'); params.push(text(req.body.sectionDay, { max: 30, label: 'يوم السكشن' })); }
  if (req.body?.sectionTime !== undefined) { fields.push('section_time = ?'); params.push(text(req.body.sectionTime, { max: 40, label: 'وقت السكشن' })); }
  if (req.body?.sectionRoom !== undefined) { fields.push('section_room = ?'); params.push(text(req.body.sectionRoom, { max: 60, label: 'مكان السكشن' })); }
  if (ctx.isManager) {
    if (req.body?.canCreateAssignments !== undefined) { fields.push('can_create_assignments = ?'); params.push(bool(req.body.canCreateAssignments) ? 1 : 0); }
    if (req.body?.canPostGeneral !== undefined) { fields.push('can_post_general = ?'); params.push(bool(req.body.canPostGeneral) ? 1 : 0); }
  }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  params.push(row.id);
  run(`UPDATE course_tas SET ${fields.join(', ')} WHERE id = ?`, ...params);

  if (sectionChanged) {
    const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", ctx.course.id, taId);
    const memberIds = chat
      ? all("SELECT student_id FROM chat_requests WHERE chat_id = ? AND status = 'approved'", chat.id).map((r) => r.student_id)
      : [];
    notifyUsers(memberIds, {
      type: 'section_update',
      title: 'تحديث موعد السكشن',
      body: `تم تحديث موعد سكشن مادة ${ctx.course.name}`,
      link: `/student/courses/${ctx.course.id}/tas`
    });
    if (ctx.isManager && taId !== req.user.id) {
      notifyUsers([taId], {
        type: 'section_update',
        title: 'تحديث بيانات السكشن',
        body: `تم تحديث بيانات سكشنك في مادة ${ctx.course.name}`,
        link: `/ta/courses/${ctx.course.id}`
      });
    }
  }
  const fresh = get('SELECT * FROM course_tas WHERE id = ?', row.id);
  res.json({
    ta: {
      id: fresh.ta_id,
      sectionDay: fresh.section_day,
      sectionTime: fresh.section_time,
      sectionRoom: fresh.section_room,
      canCreateAssignments: !!fresh.can_create_assignments,
      canPostGeneral: !!fresh.can_post_general
    },
    message: 'تم حفظ بيانات المعيد'
  });
}));

router.delete('/:id/tas/:taId', requireRole('doctor', 'developer'), asyncHandler(async (req, res) => {
  const ctx = requireCourseManager(courseAccess(Number(req.params.id), req.user));
  const taId = Number(req.params.taId);
  const row = get('SELECT * FROM course_tas WHERE course_id = ? AND ta_id = ?', ctx.course.id, taId);
  if (!row) throw httpError(404, 'المعيد غير مضاف لهذه المادة');
  const activeAssignments = get(
    "SELECT COUNT(*) AS n FROM assignments WHERE course_id = ? AND ta_id = ? AND scope = 'ta' AND is_active = 1",
    ctx.course.id, taId
  ).n;
  if (activeAssignments > 0) {
    throw httpError(409, 'لا يمكن إزالة المعيد قبل حذف أو إعادة إسناد التكليفات الخاصة به');
  }
  const chat = get("SELECT * FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", ctx.course.id, taId);
  if (chat) {
    const members = all("SELECT student_id FROM chat_requests WHERE chat_id = ? AND status = 'approved'", chat.id).map((r) => r.student_id);
    notifyUsers(members, {
      type: 'chat_closed',
      title: 'إغلاق شات المعيد',
      body: `تم إغلاق شات المعيد في مادة ${ctx.course.name}`,
      link: `/student/courses/${ctx.course.id}/tas`
    });
    run('DELETE FROM chats WHERE id = ?', chat.id);
  }
  run('DELETE FROM course_tas WHERE id = ?', row.id);
  notifyUsers([taId], {
    type: 'ta_removed',
    title: 'إزالة من المادة',
    body: `تمت إزالتك من مادة ${ctx.course.name}`,
    link: '/ta/courses'
  });
  res.json({ ok: true, message: 'تمت إزالة المعيد وإغلاق شاته' });
}));

router.patch('/:id/my-section', requireRole('ta'), asyncHandler(async (req, res) => {
  const ctx = courseAccess(Number(req.params.id), req.user);
  if (!ctx.isTa) throw httpError(403, 'أنت لست معيداً في هذه المادة');
  const fields = [];
  const params = [];
  if (req.body?.sectionDay !== undefined) { fields.push('section_day = ?'); params.push(text(req.body.sectionDay, { max: 30, label: 'يوم السكشن' })); }
  if (req.body?.sectionTime !== undefined) { fields.push('section_time = ?'); params.push(text(req.body.sectionTime, { max: 40, label: 'وقت السكشن' })); }
  if (req.body?.sectionRoom !== undefined) { fields.push('section_room = ?'); params.push(text(req.body.sectionRoom, { max: 60, label: 'مكان السكشن' })); }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  params.push(ctx.taRow.id);
  run(`UPDATE course_tas SET ${fields.join(', ')} WHERE id = ?`, ...params);
  const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", ctx.course.id, req.user.id);
  const members = chat ? all("SELECT student_id FROM chat_requests WHERE chat_id = ? AND status = 'approved'", chat.id).map((r) => r.student_id) : [];
  notifyUsers(members, {
    type: 'section_update',
    title: 'تحديث موعد السكشن',
    body: `تم تحديث موعد سكشن مادة ${ctx.course.name}`,
    link: `/student/courses/${ctx.course.id}/tas`
  }, { excludeUserId: req.user.id });
  res.json({ ok: true, message: 'تم حفظ موعد السكشن' });
}));

export default router;
