import { get, nowIso, run } from './db.js';
import { chatAudienceIds } from './access.js';

const clients = new Map();

export function addEventClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
  return () => {
    const set = clients.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  };
}

export function sendToUser(userId, event, payload) {
  const set = clients.get(Number(userId));
  if (!set) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      set.delete(res);
    }
  }
}

export function broadcastChat(chatId, event, payload, excludeUserId = null) {
  const chat = get('SELECT * FROM chats WHERE id = ?', chatId);
  if (!chat) return;
  for (const userId of chatAudienceIds(chat)) {
    if (excludeUserId && userId === excludeUserId) continue;
    sendToUser(userId, event, payload);
  }
}

export function notifyUsers(userIds, payload, options = {}) {
  const { type, title, body = '', link = '', dedupeKey = null } = payload;
  const excludeUserId = options.excludeUserId ?? payload.excludeUserId ?? null;
  const now = nowIso();
  const seen = new Set();
  for (const rawId of userIds || []) {
    const userId = Number(rawId);
    if (!userId || seen.has(userId) || userId === excludeUserId) continue;
    seen.add(userId);
    const user = get('SELECT id FROM users WHERE id = ? AND is_active = 1', userId);
    if (!user) continue;

    let row;
    const key = dedupeKey ? `${dedupeKey}:${userId}` : null;
    if (key) {
      run(
        `INSERT INTO notifications(user_id, type, title, body, link, is_read, dedupe_key, created_at)
         VALUES(?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(dedupe_key) DO UPDATE SET
           title = excluded.title, body = excluded.body, link = excluded.link,
           is_read = 0, created_at = excluded.created_at`,
        userId, type, title, body, link, key, now
      );
      row = get('SELECT * FROM notifications WHERE dedupe_key = ?', key);
    } else {
      const info = run(
        'INSERT INTO notifications(user_id, type, title, body, link, is_read, created_at) VALUES(?, ?, ?, ?, ?, 0, ?)',
        userId, type, title, body, link, now
      );
      row = get('SELECT * FROM notifications WHERE id = ?', Number(info.lastInsertRowid));
    }
    if (row) sendToUser(userId, 'notification', row);
  }
}
