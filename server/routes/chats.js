import express from 'express';
import { all, get, nowIso, run } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  canWriteChat,
  chatAccess,
  chatAudienceIds,
  courseAccess,
  requireChatRead
} from '../access.js';
import { broadcastChat, notifyUsers } from '../notify.js';
import { asyncHandler, bool, httpError, text } from '../util.js';

const router = express.Router();
router.use(requireAuth);

function messageDto(row, userId) {
  return {
    id: row.id,
    chatId: row.chat_id,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.sender_id === userId,
    sender: {
      id: row.sender_id,
      fullName: row.sender_name,
      avatar: row.sender_avatar,
      role: row.sender_role
    }
  };
}

function chatDto(access, userId) {
  const { chat, course, ctx } = access;
  const ta = chat.ta_id ? get('SELECT id, full_name, avatar FROM users WHERE id = ?', chat.ta_id) : null;
  const taRow = chat.ta_id
    ? get('SELECT section_day, section_time, section_room FROM course_tas WHERE course_id = ? AND ta_id = ?', chat.course_id, chat.ta_id)
    : null;
  return {
    id: chat.id,
    courseId: chat.course_id,
    courseName: course.name,
    courseCode: course.code,
    type: chat.type,
    taId: chat.ta_id,
    taName: ta?.full_name || null,
    taAvatar: ta?.avatar || null,
    sectionDay: taRow?.section_day || null,
    sectionTime: taRow?.section_time || null,
    sectionRoom: taRow?.section_room || null,
    writeMode: chat.write_mode,
    isLocked: !!chat.is_locked,
    canWrite: canWriteChat(access),
    canManage: access.canManage,
    canRemoveMembers: !!ctx.isManager,
    isOwner: ctx.isOwner,
    isTa: ctx.isTa,
    myRequestStatus: access.request?.status || null,
    doctorId: course.doctor_id,
    doctorName: get('SELECT full_name FROM users WHERE id = ?', course.doctor_id)?.full_name || ''
  };
}

function chatNotificationLink(chat) {
  return `/chat/${chat.id}`;
}

router.get('/mine', asyncHandler(async (req, res) => {
  const user = req.user;
  let rows = [];
  if (user.role === 'developer') {
    rows = all('SELECT * FROM chats ORDER BY id DESC');
  } else if (user.role === 'doctor') {
    rows = all(
      `SELECT ch.* FROM chats ch JOIN courses c ON c.id = ch.course_id WHERE c.doctor_id = ? ORDER BY ch.id DESC`,
      user.id
    );
  } else if (user.role === 'ta') {
    rows = all(
      `SELECT ch.* FROM chats ch WHERE (ch.type = 'ta' AND ch.ta_id = ?)
       OR (ch.type = 'general' AND ch.course_id IN (SELECT course_id FROM course_tas WHERE ta_id = ?))
       ORDER BY ch.id DESC`,
      user.id, user.id
    );
  } else {
    rows = all(
      `SELECT ch.* FROM chats ch
       WHERE (ch.type = 'general' AND ch.course_id IN (SELECT course_id FROM course_students WHERE student_id = ?))
       OR (ch.type = 'ta' AND ch.id IN (SELECT chat_id FROM chat_requests WHERE student_id = ? AND status = 'approved'))
       ORDER BY ch.id DESC`,
      user.id, user.id
    );
  }
  const chats = [];
  for (const row of rows) {
    const access = chatAccess(row.id, user);
    if (!access.canRead) continue;
    const last = get(
      `SELECT m.*, u.full_name AS sender_name, u.avatar AS sender_avatar, u.role AS sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.chat_id = ? AND m.is_deleted = 0 ORDER BY m.id DESC LIMIT 1`,
      row.id
    );
    chats.push({
      ...chatDto(access, user.id),
      lastMessage: last ? { body: last.body, createdAt: last.created_at, senderName: last.sender_name } : null
    });
  }
  res.json({ chats });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  const chat = chatDto(access, req.user.id);
  const members = [];
  if (access.chat.type === 'general') {
    const course = access.course;
    const doctor = get('SELECT id, full_name, avatar, role FROM users WHERE id = ?', course.doctor_id);
    if (doctor) members.push(doctor);
    for (const row of all(
      `SELECT u.id, u.full_name, u.avatar, u.role FROM course_tas t JOIN users u ON u.id = t.ta_id WHERE t.course_id = ?`,
      course.id
    )) members.push(row);
    for (const row of all(
      `SELECT u.id, u.full_name, u.avatar, u.role FROM course_students cs JOIN users u ON u.id = cs.student_id WHERE cs.course_id = ?`,
      course.id
    )) members.push(row);
  } else {
    const doctor = get('SELECT id, full_name, avatar, role FROM users WHERE id = ?', access.course.doctor_id);
    if (doctor) members.push(doctor);
    const ta = get('SELECT id, full_name, avatar, role FROM users WHERE id = ?', access.chat.ta_id);
    if (ta) members.push(ta);
    for (const row of all(
      `SELECT u.id, u.full_name, u.avatar, u.role FROM chat_requests cr JOIN users u ON u.id = cr.student_id
       WHERE cr.chat_id = ? AND cr.status = 'approved'`,
      access.chat.id
    )) members.push(row);
  }
  const unique = [...new Map(members.map((m) => [m.id, m])).values()];
  res.json({ chat, members: unique });
}));

router.get('/:id/messages', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  const after = Number(req.query.after) || 0;
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
  let rows;
  if (after > 0) {
    rows = all(
      `SELECT m.*, u.full_name AS sender_name, u.avatar AS sender_avatar, u.role AS sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.chat_id = ? AND m.id > ? AND m.is_deleted = 0 ORDER BY m.id ASC LIMIT ?`,
      access.chat.id, after, limit
    );
  } else {
    rows = all(
      `SELECT * FROM (
        SELECT m.*, u.full_name AS sender_name, u.avatar AS sender_avatar, u.role AS sender_role
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.chat_id = ? AND m.is_deleted = 0 ORDER BY m.id DESC LIMIT ?
      ) ORDER BY id ASC`,
      access.chat.id, limit
    );
  }
  res.json({
    messages: rows.map((row) => messageDto(row, req.user.id)),
    canWrite: canWriteChat(access),
    chat: chatDto(access, req.user.id)
  });
}));

router.post('/:id/messages', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (!canWriteChat(access)) {
    throw httpError(403, access.chat.is_locked ? 'المحادثة مغلقة مؤقتاً' : 'الكتابة في هذه المحادثة غير متاحة لك');
  }
  const body = text(req.body?.body, { min: 1, max: 2000, label: 'الرسالة', required: true });
  const now = nowIso();
  const info = run(
    'INSERT INTO messages(chat_id, sender_id, body, created_at) VALUES(?, ?, ?, ?)',
    access.chat.id, req.user.id, body, now
  );
  const row = get(
    `SELECT m.*, u.full_name AS sender_name, u.avatar AS sender_avatar, u.role AS sender_role
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
    Number(info.lastInsertRowid)
  );
  const dto = messageDto(row, req.user.id);
  broadcastChat(access.chat.id, 'message', { message: dto, chatId: access.chat.id }, req.user.id);

  const recipients = chatAudienceIds(access.chat).filter((id) => id !== req.user.id);
  notifyUsers(recipients, {
    type: 'message',
    title: access.chat.type === 'general' ? `رسالة جديدة في ${access.course.name}` : `رسالة جديدة من ${req.user.full_name}`,
    body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
    link: chatNotificationLink(access.chat),
    dedupeKey: `chat:${access.chat.id}`
  });
  res.status(201).json({ message: dto });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية إدارة هذه المحادثة');
  const fields = [];
  const params = [];
  if (req.body?.writeMode !== undefined) {
    const mode = String(req.body.writeMode);
    if (!['all', 'staff', 'readonly'].includes(mode)) throw httpError(400, 'صلاحية الكتابة غير صالحة');
    fields.push('write_mode = ?');
    params.push(mode);
  }
  if (req.body?.isLocked !== undefined) {
    fields.push('is_locked = ?');
    params.push(bool(req.body.isLocked) ? 1 : 0);
  }
  if (!fields.length) throw httpError(400, 'لا توجد تغييرات لحفظها');
  params.push(access.chat.id);
  run(`UPDATE chats SET ${fields.join(', ')} WHERE id = ?`, ...params);
  const fresh = get('SELECT * FROM chats WHERE id = ?', access.chat.id);
  const updatedAccess = chatAccess(fresh.id, req.user);
  const dto = chatDto(updatedAccess, req.user.id);
  broadcastChat(fresh.id, 'chat:update', { chat: dto });
  res.json({ chat: dto, message: 'تم تحديث إعدادات المحادثة' });
}));

router.get('/:id/requests', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية عرض طلبات هذه المحادثة');
  const status = String(req.query.status || '');
  const rows = all(
    `SELECT cr.*, u.full_name, u.username, u.avatar, u.phone
     FROM chat_requests cr JOIN users u ON u.id = cr.student_id
     WHERE cr.chat_id = ? ${['pending', 'approved', 'rejected'].includes(status) ? 'AND cr.status = ?' : ''}
     ORDER BY cr.created_at DESC`,
    ...( ['pending', 'approved', 'rejected'].includes(status) ? [access.chat.id, status] : [access.chat.id] )
  );
  res.json({
    requests: rows.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.full_name,
      username: row.username,
      avatar: row.avatar,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at
    }))
  });
}));

router.post('/:id/requests', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (req.user.role !== 'student') throw httpError(403, 'طلبات الانضمام متاحة للطلاب فقط');
  if (access.chat.type !== 'ta') throw httpError(400, 'لا يمكن إرسال طلب لهذه المحادثة');
  if (!access.ctx.isStudent) throw httpError(403, 'يجب الاشتراك في المادة أولاً');
  if (access.request?.status === 'approved') throw httpError(409, 'أنت عضو في هذا الشات بالفعل');
  if (access.request?.status === 'pending') throw httpError(409, 'طلبك قيد المراجعة بالفعل');

  const other = get(
    `SELECT cr.status, u.full_name AS ta_name FROM chat_requests cr
     JOIN chats ch ON ch.id = cr.chat_id JOIN users u ON u.id = ch.ta_id
     WHERE ch.course_id = ? AND cr.student_id = ? AND cr.chat_id <> ? AND cr.status IN ('pending','approved')
     ORDER BY CASE cr.status WHEN 'approved' THEN 0 ELSE 1 END LIMIT 1`,
    access.course.id, req.user.id, access.chat.id
  );
  if (other) {
    throw httpError(409, other.status === 'approved'
      ? `أنت مرتبط بالفعل بشات المعيد ${other.ta_name}. لتغيير المعيد تواصل مع الدكتور المسؤول`
      : `لديك طلب قيد المراجعة لدى المعيد ${other.ta_name}. يمكنك إلغاؤه أولاً`);
  }

  const now = nowIso();
  if (access.request) {
    run("UPDATE chat_requests SET status = 'pending', created_at = ?, decided_at = NULL, decided_by = NULL WHERE id = ?", now, access.request.id);
  } else {
    run("INSERT INTO chat_requests(chat_id, student_id, status, created_at) VALUES(?, ?, 'pending', ?)", access.chat.id, req.user.id, now);
  }
  notifyUsers([access.chat.ta_id], {
    type: 'join_request',
    title: 'طلب انضمام جديد',
    body: `${req.user.full_name} يطلب الانضمام إلى شاتك في مادة ${access.course.name}`,
    link: `/ta/requests`
  });
  res.status(201).json({ ok: true, message: 'تم إرسال طلب الانضمام إلى المعيد' });
}));

router.delete('/:id/requests', asyncHandler(async (req, res) => {
  const access = chatAccess(Number(req.params.id), req.user);
  const isPendingRequester = access.request?.student_id === req.user.id && access.request?.status === 'pending';
  if (!access.canRead && !isPendingRequester) {
    throw httpError(403, 'لا تملك صلاحية الوصول إلى هذه المحادثة');
  }
  if (!isPendingRequester) {
    throw httpError(400, 'لا يوجد طلب معلق لإلغائه');
  }
  run("UPDATE chat_requests SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ?", nowIso(), req.user.id, access.request.id);
  res.json({ ok: true, message: 'تم إلغاء طلب الانضمام' });
}));

router.patch('/:id/requests/:requestId', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (!access.canManage) throw httpError(403, 'لا تملك صلاحية إدارة الطلبات');
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'حالة الطلب غير صالحة');
  const request = get('SELECT * FROM chat_requests WHERE id = ? AND chat_id = ?', Number(req.params.requestId), access.chat.id);
  if (!request) throw httpError(404, 'الطلب غير موجود');
  if (request.status === status) return res.json({ ok: true });
  const student = get('SELECT * FROM users WHERE id = ?', request.student_id);
  if (!student) throw httpError(404, 'الطالب غير موجود');
  if (status === 'approved') {
    if (!get('SELECT 1 AS ok FROM course_students WHERE course_id = ? AND student_id = ?', access.course.id, request.student_id)) {
      throw httpError(409, 'الطالب لم يعد مشتركاً في المادة');
    }
    const other = get(
      `SELECT ch.id, u.full_name AS ta_name FROM chat_requests cr
       JOIN chats ch ON ch.id = cr.chat_id JOIN users u ON u.id = ch.ta_id
       WHERE ch.course_id = ? AND cr.student_id = ? AND cr.chat_id <> ? AND cr.status = 'approved' LIMIT 1`,
      access.course.id, request.student_id, access.chat.id
    );
    if (other) {
      throw httpError(409, `الطالب مرتبط بالفعل بالمعيد ${other.ta_name}. يجب على الدكتور إزالته أولاً`);
    }
  }
  const now = nowIso();
  run('UPDATE chat_requests SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?', status, now, req.user.id, request.id);
  if (status === 'approved') {
    run(
      `UPDATE chat_requests SET status = 'rejected', decided_at = ?, decided_by = ?
       WHERE student_id = ? AND status = 'pending' AND chat_id IN (SELECT id FROM chats WHERE course_id = ?) AND id <> ?`,
      now, req.user.id, request.student_id, access.course.id, request.id
    );
  }
  notifyUsers([request.student_id], {
    type: status === 'approved' ? 'join_approved' : 'join_rejected',
    title: status === 'approved' ? 'تم قبول طلب الانضمام' : 'تم رفض طلب الانضمام',
    body: status === 'approved'
      ? `تم قبولك في شات المعيد ${access.chat.ta_id === req.user.id ? req.user.full_name : get('SELECT full_name FROM users WHERE id = ?', access.chat.ta_id)?.full_name || ''} لمادة ${access.course.name}`
      : `تم رفض طلب انضمامك إلى شات المعيد في مادة ${access.course.name}`,
    link: `/student/courses/${access.course.id}/tas`
  });
  res.json({ ok: true, message: status === 'approved' ? 'تم قبول الطالب في الشات' : 'تم رفض الطلب' });
}));

router.delete('/:id/members/:studentId', asyncHandler(async (req, res) => {
  const access = requireChatRead(chatAccess(Number(req.params.id), req.user));
  if (!(access.ctx.isManager)) throw httpError(403, 'هذه العملية متاحة للدكتور المسؤول فقط');
  const studentId = Number(req.params.studentId);
  const request = get("SELECT * FROM chat_requests WHERE chat_id = ? AND student_id = ? AND status = 'approved'", access.chat.id, studentId);
  if (!request) throw httpError(404, 'الطالب غير عضو في هذا الشات');
  run('DELETE FROM chat_requests WHERE id = ?', request.id);
  notifyUsers([studentId], {
    type: 'chat_removed',
    title: 'إزالة من شات المعيد',
    body: `تمت إزالتك من شات المعيد في مادة ${access.course.name}. يمكنك اختيار معيد آخر`,
    link: `/student/courses/${access.course.id}/tas`
  });
  res.json({ ok: true, message: 'تمت إزالة الطالب من الشات' });
}));

export default router;
