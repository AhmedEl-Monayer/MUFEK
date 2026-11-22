import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { CLOUD_MODE, MAX_FILE_MB, UPLOAD_DIR } from './config.js';
import { deleteAsset, saveAsset } from './db.js';
import { httpError } from './util.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const FOLDERS = {
  avatar: 'avatars',
  course: 'courses',
  assignment: 'assignments',
  submission: 'submissions'
};

function extensionFor(file) {
  const original = path.extname(file.originalname || '').toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(original)) return original;
  if (file.mimetype === 'application/pdf') return '.pdf';
  if (file.mimetype === 'image/png') return '.png';
  if (file.mimetype === 'image/jpeg') return '.jpg';
  if (file.mimetype === 'image/webp') return '.webp';
  if (file.mimetype.includes('zip')) return '.zip';
  return '';
}

export function fixOriginalName(name) {
  if (!name) return 'ملف';
  const looksMangled = /[ÃÂ][\u0080-\u00ff]/.test(name);
  if (looksMangled) {
    try {
      return Buffer.from(name, 'latin1').toString('utf8');
    } catch {
      return name;
    }
  }
  return name;
}

// على الاستضافة المجانية القرص مؤقت؛ نحفظ الملفات داخل قاعدة البيانات بدلاً منه.
function makeDbStorage() {
  return {
    _handleFile(req, file, cb) {
      const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensionFor(file)}`;
      const chunks = [];
      file.stream.on('data', (chunk) => chunks.push(chunk));
      file.stream.on('error', cb);
      file.stream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          saveAsset(name, buffer.toString('base64'), file.mimetype, buffer.length);
          cb(null, {
            filename: name,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: buffer.length
          });
        } catch (error) {
          cb(error);
        }
      });
    },
    _remove(req, file, cb) {
      try {
        if (file.filename) deleteAsset(path.basename(file.filename));
        cb();
      } catch (error) {
        cb(error);
      }
    }
  };
}

function makeUploader(kind, limitMb) {
  const folder = FOLDERS[kind];
  const storage = CLOUD_MODE
    ? makeDbStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, folder)),
        filename: (req, file, cb) => {
          const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensionFor(file)}`;
          cb(null, name);
        }
      });
  const allowed = kind === 'avatar' || kind === 'course' ? IMAGE_TYPES : DOC_TYPES;
  return multer({
    storage,
    limits: { fileSize: limitMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        return cb(httpError(400, kind === 'avatar' || kind === 'course'
          ? 'صورة غير صالحة. المسموح: JPG أو PNG أو WEBP'
          : 'نوع الملف غير مسموح. المسموح: PDF أو صور أو Word أو ZIP'));
      }
      cb(null, true);
    }
  });
}

export const avatarUpload = makeUploader('avatar', 4).single('avatar');
export const courseUpload = makeUploader('course', 4).single('image');
export const assignmentUpload = makeUploader('assignment', MAX_FILE_MB).single('file');
export const submissionUpload = makeUploader('submission', MAX_FILE_MB).single('file');

export function removeUpload(kind, filename) {
  if (!filename) return;
  if (CLOUD_MODE) {
    deleteAsset(path.basename(filename));
    return;
  }
  const folder = FOLDERS[kind] || kind;
  const safe = path.basename(filename);
  fs.rm(path.join(UPLOAD_DIR, folder, safe), { force: true }, () => {});
}

export function uploadPath(kind, filename) {
  const folder = FOLDERS[kind] || kind;
  return path.join(UPLOAD_DIR, folder, path.basename(filename));
}
