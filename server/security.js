import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SECRET } from './config.js';

const nidKey = crypto.scryptSync(SECRET, 'elmanasa:national-id:v1', 32);

export function encryptNationalId(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', nidKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptNationalId(payload) {
  try {
    const [iv, tag, data] = String(payload).split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', nidKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function hashNationalId(value) {
  return crypto.createHmac('sha256', SECRET).update(`nid:${value}`).digest('hex');
}

export function maskNationalId(value) {
  if (!value) return '';
  return `${value.slice(0, 3)}••••••••${value.slice(-2)}`;
}

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
