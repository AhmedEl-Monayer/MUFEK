import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { ALLOWED_ORIGINS, DIST_DIR, IS_PROD, PORT } from './config.js';
import { all, db, get, nowIso, run, setting, syncDb } from './db.js';
import { attachUser, requireAuth } from './auth.js';
import { addEventClient, notifyUsers } from './notify.js';
import { eligibleStudentIds } from './access.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import courseRoutes from './routes/courses.js';
import chatRoutes from './routes/chats.js';
import assignmentRoutes, { submissionsRouter } from './routes/assignments.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import fileRoutes from './routes/files.js';
import dashboardRoutes from './routes/dashboard.js';
import { seedBase } from './seed.js';

// أول تشغيل على استضافة جديدة: إنشاء حساب المطور تلقائياً من متغيرات البيئة.
if (!get('SELECT 1 AS ok FROM users LIMIT 1')) {
  console.log('قاعدة البيانات فارغة — جارٍ إنشاء حساب المطور...');
  await seedBase();
  syncDb();
}

const app = express();
const HOST = process.env.HOST || process.env.IP || '0.0.0.0';
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

// Basic CSRF protection: state-changing browser requests must come from the same host.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    const parsed = new URL(origin);
    const host = String(req.headers.host || '').split(':')[0];
    if (
      parsed.hostname === host ||
      ['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      ALLOWED_ORIGINS.includes(origin)
    ) {
      return next();
    }
  } catch {
    // fall through
  }
  return res.status(403).json({ error: 'طلب غير موثوق' });
});

app.use('/api', attachUser);

function healthHandler(req, res) {
  try {
    get('SELECT 1 AS ok');
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false });
  }
}

// Abasthan وبعض الاستضافات تفحص /healthz أو /health؛ وفّر نفس الاستجابة.
app.get('/api/health', healthHandler);
app.get('/healthz', healthHandler);
app.get('/health', healthHandler);

app.get('/api/public/settings', (req, res) => {
  res.json({
    settings: {
      platformName: setting('platform_name', 'منصة هندسة المنوفية'),
      facultyName: setting('faculty_name', 'كلية الهندسة'),
      universityName: setting('university_name', 'جامعة المنوفية'),
      supportEmail: setting('support_email', '')
    }
  });
});

// Students must finish their profile before using the platform.
app.use('/api', (req, res, next) => {
  if (!req.user || req.user.role !== 'student' || req.user.profile_completed) return next();
  const p = req.originalUrl.replace(/^\/api/, '').split('?')[0];
  const allowed = ['/auth', '/profile', '/events', '/public', '/notifications', '/files/avatar'];
  if (allowed.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) return next();
  return res.status(403).json({ error: 'يجب استكمال الملف الشخصي أولاً', code: 'PROFILE_INCOMPLETE' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionsRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/events', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ userId: req.user.id })}\n\n`);
  const remove = addEventClient(req.user.id, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      // ignore
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    remove();
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

if (fs.existsSync(DIST_DIR)) {
  // ملفات Vite باسماء مجزّأة (hashed)؛ تخزينها طويلاً يقلّل زمن التحميل.
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1y', immutable: true }));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send('API تعمل. شغّل الواجهة عبر Vite في وضع التطوير أو نفّذ npm run build.');
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'حجم الملف أكبر من المسموح'
      : 'تعذر رفع الملف';
    return res.status(400).json({ error: message });
  }
  if (err?.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint/i.test(err.message)) {
    return res.status(409).json({ error: 'هذه البيانات مسجلة بالفعل' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'حدث خطأ غير متوقع في الخادم' : err.message });
});

function runDueReminders() {
  try {
    const hours = Math.max(1, Number(setting('reminder_hours', '24')) || 24);
    const now = nowIso();
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const dueAssignments = all(
      'SELECT * FROM assignments WHERE is_active = 1 AND published_at <= ? AND due_at > ? AND due_at <= ?',
      now, now, until
    );
    for (const assignment of dueAssignments) {
      const pending = eligibleStudentIds(assignment).filter(
        (studentId) => !get('SELECT 1 AS ok FROM submissions WHERE assignment_id = ? AND student_id = ?', assignment.id, studentId)
      );
      for (const studentId of pending) {
        notifyUsers([studentId], {
          type: 'assignment_due',
          title: 'اقتراب موعد التسليم',
          body: `باقي أقل من ${hours} ساعة لتسليم: ${assignment.title}`,
          link: `/assignment/${assignment.id}`,
          dedupeKey: `due:${assignment.id}`
        });
      }
    }
  } catch (error) {
    console.error('reminder job failed', error);
  }
}

runDueReminders();
setInterval(runDueReminders, 30 * 60 * 1000).unref?.();
setInterval(() => {
  try {
    run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
    run('DELETE FROM password_resets WHERE expires_at < ?', nowIso());
  } catch (error) {
    console.error('cleanup failed', error);
  }
}, 24 * 60 * 60 * 1000).unref?.();

function onListening() {
  if (IS_PROD && !process.env.APP_SECRET) {
    console.warn('[تحذير] APP_SECRET غير مضبوط؛ يتم استخدام المفتاح المحفوظ في مجلد البيانات. ثبّته كمتغير بيئة قبل الإنتاج.');
  }
  console.log(`El-Manasa API listening on http://${HOST || 'localhost'}:${PORT}${IS_PROD ? ' (production)' : ''}`);
}

const server = HOST
  ? app.listen(PORT, HOST, onListening)
  : app.listen(PORT, onListening);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => {
      try {
        syncDb();
      } catch {
        // ignore
      }
      try {
        db.close();
      } catch {
        // ignore
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref?.();
  });
}
