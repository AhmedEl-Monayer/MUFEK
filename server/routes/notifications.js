import express from 'express';
import { all, get, nowIso, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler, httpError, parsePaging } from '../util.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { limit } = parsePaging(req, 40, 100);
  const unreadOnly = req.query.unread === '1';
  const rows = all(
    `SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}
     ORDER BY is_read ASC, id DESC LIMIT ?`,
    req.user.id, limit
  );
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      isRead: !!row.is_read,
      createdAt: row.created_at
    })),
    unread
  });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', req.user.id);
  res.json({ ok: true });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  const row = get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  if (!row) throw httpError(404, 'الإشعار غير موجود');
  run('UPDATE notifications SET is_read = 1 WHERE id = ?', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM notifications WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

router.delete('/', asyncHandler(async (req, res) => {
  run('DELETE FROM notifications WHERE user_id = ? AND is_read = 1', req.user.id);
  res.json({ ok: true });
}));

export default router;
