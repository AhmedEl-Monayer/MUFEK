import express from 'express';
import { all, get, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../util.js';

const router = express.Router();
router.use(requireAuth);

const iso = () => nowIso();

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  const now = iso();

  if (user.role === 'student') {
    const courses = all(
      `SELECT c.id, c.name, c.code, c.image, u.full_name AS doctor_name,
        (SELECT COUNT(*) FROM course_tas t WHERE t.course_id = c.id) AS tas_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id AND a.is_active = 1) AS assignments_count
       FROM courses c JOIN course_students cs ON cs.course_id = c.id JOIN users u ON u.id = c.doctor_id
       WHERE cs.student_id = ? ORDER BY cs.joined_at DESC`,
      user.id
    );
    const visibility = `a.course_id IN (SELECT course_id FROM course_students WHERE student_id = ?)
      AND (a.scope = 'general' OR a.ta_id IN (
        SELECT ch.ta_id FROM chat_requests cr JOIN chats ch ON ch.id = cr.chat_id
        WHERE cr.student_id = ? AND cr.status = 'approved' AND ch.course_id = a.course_id))`;
    const upcoming = all(
      `SELECT a.id, a.title, a.due_at, a.allow_late, a.max_grade, c.name AS course_name, c.id AS course_id,
        (SELECT u.full_name FROM users u WHERE u.id = a.ta_id) AS ta_name
       FROM assignments a JOIN courses c ON c.id = a.course_id
       WHERE a.is_active = 1 AND a.published_at <= ? AND a.due_at > ? AND ${visibility}
       AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ?)
       ORDER BY a.due_at ASC LIMIT 5`,
      now, now, user.id, user.id, user.id
    );
    const pending = get(
      `SELECT COUNT(*) AS n FROM assignments a WHERE a.is_active = 1 AND a.published_at <= ? AND a.due_at > ? AND ${visibility}
       AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ?)`,
      now, now, user.id, user.id, user.id
    ).n;
    const submitted = get('SELECT COUNT(*) AS n FROM submissions WHERE student_id = ?', user.id).n;
    const graded = get("SELECT COUNT(*) AS n FROM submissions WHERE student_id = ? AND status = 'graded'", user.id).n;
    const avg = get('SELECT AVG(grade) AS avg FROM submissions WHERE student_id = ? AND grade IS NOT NULL', user.id).avg;
    const recentSubmissions = all(
      `SELECT s.id, s.status, s.submitted_at, s.grade, a.id AS assignment_id, a.title AS assignment_title, c.name AS course_name
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
       WHERE s.student_id = ? ORDER BY s.submitted_at DESC LIMIT 5`,
      user.id
    );
    return res.json({
      role: 'student',
      stats: { courses: courses.length, pending, submitted, graded, average: avg == null ? null : Math.round(avg * 10) / 10 },
      courses,
      upcoming,
      recentSubmissions
    });
  }

  if (user.role === 'doctor') {
    const courses = all(
      `SELECT c.id, c.name, c.code, c.image, c.is_active,
        (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) AS students_count,
        (SELECT COUNT(*) FROM course_tas t WHERE t.course_id = c.id) AS tas_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id AND a.is_active = 1) AS assignments_count,
        (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id
          WHERE a.course_id = c.id AND s.status = 'submitted') AS pending_submissions
       FROM courses c WHERE c.doctor_id = ? ORDER BY c.id DESC`,
      user.id
    );
    const stats = {
      courses: courses.length,
      students: courses.reduce((sum, c) => sum + c.students_count, 0),
      tas: courses.reduce((sum, c) => sum + c.tas_count, 0),
      assignments: courses.reduce((sum, c) => sum + c.assignments_count, 0),
      pendingSubmissions: courses.reduce((sum, c) => sum + c.pending_submissions, 0)
    };
    const recentSubmissions = all(
      `SELECT s.id, s.status, s.submitted_at, s.grade, u.full_name AS student_name, u.avatar,
        a.id AS assignment_id, a.title AS assignment_title, c.name AS course_name
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = s.student_id
       WHERE c.doctor_id = ? ORDER BY s.submitted_at DESC LIMIT 6`,
      user.id
    );
    const upcoming = all(
      `SELECT a.id, a.title, a.due_at, c.name AS course_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submitted_count
       FROM assignments a JOIN courses c ON c.id = a.course_id
       WHERE c.doctor_id = ? AND a.is_active = 1 AND a.due_at > ? ORDER BY a.due_at ASC LIMIT 5`,
      user.id, now
    );
    return res.json({ role: 'doctor', stats, courses, recentSubmissions, upcoming });
  }

  if (user.role === 'ta') {
    const courses = all(
      `SELECT c.id, c.name, c.code, c.image, t.section_day, t.section_time, t.section_room,
        (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) AS students_count,
        (SELECT COUNT(*) FROM chat_requests cr JOIN chats ch ON ch.id = cr.chat_id
          WHERE ch.course_id = c.id AND ch.ta_id = ? AND cr.status = 'pending') AS pending_requests,
        (SELECT COUNT(*) FROM chat_requests cr JOIN chats ch ON ch.id = cr.chat_id
          WHERE ch.course_id = c.id AND ch.ta_id = ? AND cr.status = 'approved') AS my_students,
        (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id AND a.is_active = 1 AND a.ta_id = ?) AS my_assignments
       FROM courses c JOIN course_tas t ON t.course_id = c.id AND t.ta_id = ?
       ORDER BY c.id DESC`,
      user.id, user.id, user.id, user.id
    );
    const pendingRequests = all(
      `SELECT cr.id, cr.created_at, u.full_name AS student_name, u.avatar, ch.id AS chat_id,
        c.id AS course_id, c.name AS course_name
       FROM chat_requests cr JOIN chats ch ON ch.id = cr.chat_id JOIN courses c ON c.id = ch.course_id
       JOIN users u ON u.id = cr.student_id
       WHERE ch.ta_id = ? AND cr.status = 'pending' ORDER BY cr.created_at DESC LIMIT 5`,
      user.id
    );
    const stats = {
      courses: courses.length,
      myStudents: courses.reduce((sum, c) => sum + c.my_students, 0),
      pendingRequests: courses.reduce((sum, c) => sum + c.pending_requests, 0),
      assignments: get(
        "SELECT COUNT(*) AS n FROM assignments WHERE ta_id = ? AND is_active = 1",
        user.id
      ).n,
      pendingSubmissions: get(
        `SELECT COUNT(*) AS n FROM submissions s JOIN assignments a ON a.id = s.assignment_id
         WHERE a.ta_id = ? AND a.is_active = 1 AND s.status = 'submitted'`,
        user.id
      ).n
    };
    const recentSubmissions = all(
      `SELECT s.id, s.status, s.submitted_at, s.grade, u.full_name AS student_name, u.avatar,
        a.id AS assignment_id, a.title AS assignment_title, c.name AS course_name
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = s.student_id
       WHERE a.ta_id = ? ORDER BY s.submitted_at DESC LIMIT 6`,
      user.id
    );
    return res.json({ role: 'ta', stats, courses, pendingRequests, recentSubmissions });
  }

  const count = (sql, ...params) => get(sql, ...params)?.n || 0;
  const stats = {
    users: count('SELECT COUNT(*) AS n FROM users'),
    students: count("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
    doctors: count("SELECT COUNT(*) AS n FROM users WHERE role = 'doctor'"),
    tas: count("SELECT COUNT(*) AS n FROM users WHERE role = 'ta'"),
    courses: count('SELECT COUNT(*) AS n FROM courses'),
    assignments: count('SELECT COUNT(*) AS n FROM assignments WHERE is_active = 1'),
    submissions: count('SELECT COUNT(*) AS n FROM submissions'),
    pendingRequests: count("SELECT COUNT(*) AS n FROM chat_requests WHERE status = 'pending'")
  };
  const recentUsers = all('SELECT id, full_name, username, role, avatar, created_at FROM users ORDER BY id DESC LIMIT 5');
  const recentSubmissions = all(
    `SELECT s.id, s.status, s.submitted_at, u.full_name AS student_name, a.id AS assignment_id,
      a.title AS assignment_title, c.name AS course_name
     FROM submissions s JOIN users u ON u.id = s.student_id JOIN assignments a ON a.id = s.assignment_id
     JOIN courses c ON c.id = a.course_id ORDER BY s.id DESC LIMIT 5`
  );
  res.json({ role: 'developer', stats, recentUsers, recentSubmissions });
}));

export default router;
