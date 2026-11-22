import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');
export const DIST_DIR = path.join(ROOT, 'dist');
export const CLOUD_MODE =
  process.env.DB_DRIVER === 'libsql' ||
  Boolean((process.env.TURSO_DATABASE_URL || '') && (process.env.TURSO_AUTH_TOKEN || ''));

for (const dir of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
for (const sub of ['avatars', 'courses', 'assignments', 'submissions']) {
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
}

function loadSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const file = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const SECRET = loadSecret();
// Abasthan يكتشف المنفذ 9400 التابع له؛ خلّي الافتراضي متوافق معاه.
export const PORT = Number(process.env.PORT || 9400);
export const IS_PROD = process.env.NODE_ENV === 'production';
export const SESSION_DAYS = 14;
export const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 20);
export const COOKIE_NAME = 'elmanasa_session';
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
