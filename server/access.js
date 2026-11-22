import { all, get } from './db.js';
import { httpError } from './util.js';

export function courseAccess(courseId, user) {
  const course = get('SELECT * FROM courses WHERE id = ?', courseId);
  if (!course) throw httpError(404, 'المادة غير موجودة');
  const isDev = user.role === 'developer';
  const isOwner = user.role === 'doctor' && course.doctor_id === user.id;
  const taRow = get('SELECT * FROM course_tas WHERE course_id = ? AND ta_id = ?', courseId, user.id);
  const studentRow = get('SELECT * FROM course_students WHERE course_id = ? AND student_id = ?', courseId, user.id);
  return {
    course,
    isDev,
    isOwner,
    isManager: isDev || isOwner,
    isTa: !!taRow,
    taRow,
    isStudent: !!studentRow,
    studentRow,
    canView: isDev || isOwner || !!taRow || !!studentRow
  };
}

export function requireCourseView(ctx) {
  if (!ctx.canView) throw httpError(403, 'لا تملك صلاحية الوصول إلى هذه المادة');
  return ctx;
}

export function requireCourseManager(ctx) {
  if (!ctx.isManager) throw httpError(403, 'هذه العملية متاحة للدكتور المسؤول فقط');
  return ctx;
}

export function requireCourseStaff(ctx) {
  if (!(ctx.isManager || ctx.isTa)) throw httpError(403, 'هذه العملية متاحة لهيئة التدريس فقط');
  return ctx;
}

export function chatAccess(chatId, user) {
  const chat = get('SELECT * FROM chats WHERE id = ?', chatId);
  if (!chat) throw httpError(404, 'المحادثة غير موجودة');
  const ctx = courseAccess(chat.course_id, user);
  let isChatTa = false;
  let request = null;
  if (chat.type === 'ta') {
    isChatTa = chat.ta_id === user.id;
    request = get('SELECT * FROM chat_requests WHERE chat_id = ? AND student_id = ?', chat.id, user.id) || null;
  }
  const approved = request?.status === 'approved';
  const canRead = ctx.isDev || ctx.isOwner || (chat.type === 'general' ? ctx.isTa || ctx.isStudent : isChatTa || approved);
  return {
    chat,
    course: ctx.course,
    ctx,
    isChatTa,
    request,
    approved,
    canRead,
    canManage: ctx.isDev || ctx.isOwner || isChatTa
  };
}

export function requireChatRead(access) {
  if (!access.canRead) throw httpError(403, 'لا تملك صلاحية الوصول إلى هذه المحادثة');
  return access;
}

export function canWriteChat(access) {
  if (!access.canRead) return false;
  if (access.ctx.isDev) return true;
  if (access.chat.is_locked) return access.ctx.isOwner;
  if (access.ctx.isOwner) return true;
  if (access.chat.write_mode === 'readonly') return false;
  if (access.isChatTa) return true;
  if (access.chat.write_mode === 'staff') return false;
  if (access.ctx.isTa) return true;
  if (access.chat.type === 'general') return access.ctx.isStudent;
  return access.approved;
}

export function chatAudienceIds(chat) {
  const ids = new Set();
  const course = get('SELECT * FROM courses WHERE id = ?', chat.course_id);
  if (course) ids.add(course.doctor_id);
  for (const row of all('SELECT ta_id FROM course_tas WHERE course_id = ?', chat.course_id)) ids.add(row.ta_id);
  if (chat.type === 'general') {
    for (const row of all('SELECT student_id FROM course_students WHERE course_id = ?', chat.course_id)) ids.add(row.student_id);
  } else {
    if (chat.ta_id) ids.add(chat.ta_id);
    for (const row of all("SELECT student_id FROM chat_requests WHERE chat_id = ? AND status = 'approved'", chat.id)) {
      ids.add(row.student_id);
    }
  }
  return [...ids];
}

export function courseMemberIds(courseId) {
  const ids = new Set();
  const course = get('SELECT * FROM courses WHERE id = ?', courseId);
  if (!course) return [];
  ids.add(course.doctor_id);
  for (const row of all('SELECT ta_id FROM course_tas WHERE course_id = ?', courseId)) ids.add(row.ta_id);
  for (const row of all('SELECT student_id FROM course_students WHERE course_id = ?', courseId)) ids.add(row.student_id);
  return [...ids];
}

export function assignmentAccess(assignmentId, user) {
  const assignment = get('SELECT * FROM assignments WHERE id = ?', assignmentId);
  if (!assignment) throw httpError(404, 'التكليف غير موجود');
  const ctx = courseAccess(assignment.course_id, user);
  const isCreator = assignment.created_by === user.id;
  const isAssignedTa = assignment.ta_id === user.id;
  const canManage = ctx.isDev || ctx.isOwner || isCreator || isAssignedTa;

  let studentVisible = false;
  if (ctx.isStudent) {
    if (assignment.scope === 'general') {
      studentVisible = true;
    } else if (assignment.ta_id) {
      const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", assignment.course_id, assignment.ta_id);
      if (chat) {
        studentVisible = !!get(
          "SELECT 1 AS ok FROM chat_requests WHERE chat_id = ? AND student_id = ? AND status = 'approved'",
          chat.id,
          user.id
        );
      }
    }
  }

  const staffVisible = ctx.isDev || ctx.isOwner || isCreator || isAssignedTa ||
    (ctx.isTa && (assignment.scope === 'general' || assignment.ta_id === user.id));

  return { assignment, ctx, isCreator, isAssignedTa, canManage, studentVisible, staffVisible };
}

export function assignmentVisibleTo(assignment, user, ctx) {
  if (ctx.isDev || ctx.isOwner) return true;
  if (ctx.isTa) return assignment.scope === 'general' || assignment.ta_id === user.id;
  if (ctx.isStudent) {
    if (assignment.scope === 'general') return true;
    if (!assignment.ta_id) return false;
    const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", assignment.course_id, assignment.ta_id);
    if (!chat) return false;
    return !!get("SELECT 1 AS ok FROM chat_requests WHERE chat_id = ? AND student_id = ? AND status = 'approved'", chat.id, user.id);
  }
  return false;
}

export function eligibleStudentIds(assignment) {
  if (assignment.scope === 'general') {
    return all(
      `SELECT u.id FROM course_students cs JOIN users u ON u.id = cs.student_id
       WHERE cs.course_id = ? AND u.is_active = 1`,
      assignment.course_id
    ).map((r) => r.id);
  }
  if (!assignment.ta_id) return [];
  const chat = get("SELECT id FROM chats WHERE course_id = ? AND type = 'ta' AND ta_id = ?", assignment.course_id, assignment.ta_id);
  if (!chat) return [];
  return all(
    `SELECT u.id FROM chat_requests cr JOIN users u ON u.id = cr.student_id
     WHERE cr.chat_id = ? AND cr.status = 'approved' AND u.is_active = 1`,
    chat.id
  ).map((r) => r.id);
}
