import path from 'node:path';
import { CLOUD_MODE, DATA_DIR } from './config.js';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const CLOUD_DB = Boolean(TURSO_URL && TURSO_TOKEN);
const dbPath = path.join(DATA_DIR, 'elmanasa.db');

let db;
if (CLOUD_MODE) {
  const { default: LibsqlDatabase } = await import('libsql');
  db = CLOUD_DB
    ? new LibsqlDatabase(dbPath, {
        syncUrl: TURSO_URL,
        authToken: TURSO_TOKEN,
        syncPeriod: Number(process.env.TURSO_SYNC_SECONDS || 30)
      })
    : new LibsqlDatabase(dbPath);
  if (CLOUD_DB) {
    try {
      db.sync();
    } catch (error) {
      console.error('[Turso] أول مزامنة فشلت:', error.message);
    }
  }
} else {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(dbPath);
}

for (const pragma of [
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  'PRAGMA busy_timeout = 5000'
]) {
  try {
    db.exec(pragma);
  } catch (error) {
    if (!CLOUD_MODE) throw error;
  }
}

export { db };

// على Turso نزامن يدوياً بعد التهيئة وعند الإغلاق، إضافةً للمزامنة الدورية التلقائية.
export function syncDb() {
  if (CLOUD_DB && typeof db.sync === 'function') db.sync();
}

export const usingCloudDb = CLOUD_MODE;

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  national_id_enc TEXT NOT NULL,
  national_id_hash TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('developer','doctor','ta','student')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  profile_completed INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  image TEXT,
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_doctor ON courses(doctor_id);

CREATE TABLE IF NOT EXISTS course_tas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ta_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_day TEXT,
  section_time TEXT,
  section_room TEXT,
  can_create_assignments INTEGER NOT NULL DEFAULT 1,
  can_post_general INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  UNIQUE(course_id, ta_id)
);

CREATE TABLE IF NOT EXISTS course_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  UNIQUE(course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_course_students_student ON course_students(student_id);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('general','ta')),
  ta_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  write_mode TEXT NOT NULL DEFAULT 'all' CHECK (write_mode IN ('all','staff','readonly')),
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_general ON chats(course_id) WHERE type = 'general';
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_ta ON chats(course_id, ta_id) WHERE type = 'ta';

CREATE TABLE IF NOT EXISTS chat_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by INTEGER REFERENCES users(id),
  UNIQUE(chat_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_requests_student ON chat_requests(student_id);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'general' CHECK (scope IN ('general','ta')),
  ta_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  file TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_mime TEXT,
  published_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  allow_late INTEGER NOT NULL DEFAULT 0,
  max_grade REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_mime TEXT,
  submitted_at TEXT NOT NULL,
  is_late INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','graded')),
  grade REAL,
  feedback TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  UNIQUE(assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, id);

CREATE TABLE IF NOT EXISTS assets (
  name TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

function clean(row) {
  if (row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, '_metadata')) {
    delete row._metadata;
  }
  return row;
}

export const get = (sql, ...params) => clean(db.prepare(sql).get(...params));
export const all = (sql, ...params) => db.prepare(sql).all(...params).map(clean);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export function saveAsset(name, data, mime, size) {
  run(
    'INSERT OR REPLACE INTO assets(name, data, mime, size, created_at) VALUES(?,?,?,?,?)',
    name,
    data,
    mime || '',
    size || 0,
    nowIso()
  );
}

export function readAsset(name) {
  return get('SELECT data, mime, size FROM assets WHERE name = ?', name);
}

export function deleteAsset(name) {
  run('DELETE FROM assets WHERE name = ?', name);
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function setting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    String(value ?? '')
  );
}

export const nowIso = () => new Date().toISOString();
