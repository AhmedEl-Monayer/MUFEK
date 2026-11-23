import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CLOUD_MODE } from '../config.js';
import { get, readAsset } from '../db.js';
import { requireAuth } from '../auth.js';
import { assignmentAccess } from '../access.js';
import { httpError } from '../util.js';
import { uploadPath } from '../uploads.js';

const router = express.Router();
router.use(requireAuth);

function sendBuffer(res, key, displayName, inline, cache = 'private, max-age=300') {
  const asset = readAsset(path.basename(key));
  if (!asset) throw httpError(404, 'الملف غير موجود على الخادم');
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', asset.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(displayName || key || 'file')}`);
  return res.send(Buffer.from(asset.data, 'base64'));
}

function send(res, kind, filename, originalName, { inline = false, cache = 'private, max-age=300' } = {}) {
  if (!filename) throw httpError(404, 'الملف غير موجود');
  if (CLOUD_MODE) return sendBuffer(res, filename, originalName, inline, cache);
  const filePath = uploadPath(kind, filename);
  if (!fs.existsSync(filePath)) throw httpError(404, 'الملف غير موجود على الخادم');
  res.setHeader('Cache-Control', cache);
  if (inline) {
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(originalName || filename)}`);
    return res.sendFile(filePath);
  }
  return res.download(filePath, originalName || filename);
}

router.get('/avatar/:name', (req, res, next) => {
  try {
    const name = path.basename(req.params.name);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) throw httpError(400, 'اسم الملف غير صالح');
    if (CLOUD_MODE) {
      const asset = readAsset(name);
      if (!asset) throw httpError(404, 'الصورة غير موجودة');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader('Content-Type', asset.mime || 'image/jpeg');
      return res.send(Buffer.from(asset.data, 'base64'));
    }
    const filePath = uploadPath('avatar', name);
    if (!fs.existsSync(filePath)) throw httpError(404, 'الصورة غير موجودة');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

router.get('/course/:id', (req, res, next) => {
  try {
    const course = get('SELECT image FROM courses WHERE id = ?', Number(req.params.id));
    if (!course) throw httpError(404, 'المادة غير موجودة');
    const inline = req.query.download !== '1';
    const cache = req.query.v
      ? 'private, max-age=31536000, immutable'
      : 'private, max-age=300';
    send(res, 'course', course.image, `course-${course.id}`, { inline, cache });
  } catch (error) {
    next(error);
  }
});

router.get('/assignment/:id', (req, res, next) => {
  try {
    const access = assignmentAccess(Number(req.params.id), req.user);
    if (req.user.role === 'student') {
      if (!access.studentVisible) throw httpError(403, 'لا تملك صلاحية الوصول إلى هذا الملف');
      if (new Date(access.assignment.published_at).getTime() > Date.now()) {
        throw httpError(403, 'لم يتم نشر التكليف بعد');
      }
    } else if (!access.staffVisible && !access.canManage) {
      throw httpError(403, 'لا تملك صلاحية الوصول إلى هذا الملف');
    }
    const inline = req.query.download !== '1' && /pdf|image/.test(access.assignment.file_mime || '');
    send(res, 'assignment', access.assignment.file, access.assignment.file_name, { inline });
  } catch (error) {
    next(error);
  }
});

router.get('/submission/:id', (req, res, next) => {
  try {
    const submission = get('SELECT * FROM submissions WHERE id = ?', Number(req.params.id));
    if (!submission) throw httpError(404, 'التسليم غير موجود');
    const access = assignmentAccess(submission.assignment_id, req.user);
    if (req.user.id !== submission.student_id && !access.canManage) {
      throw httpError(403, 'لا تملك صلاحية الوصول إلى هذا الملف');
    }
    const inline = req.query.download !== '1' && /pdf|image/.test(submission.file_mime || '');
    send(res, 'submission', submission.file, submission.file_name, { inline });
  } catch (error) {
    next(error);
  }
});

export default router;
