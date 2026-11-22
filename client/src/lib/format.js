const LOCALE = 'ar-EG-u-nu-latn';

export const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

export const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};

export const fmtTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(d);
};

export const fmtDay = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return 'اليوم';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'أمس';
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
};

export function relativeTime(value) {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const units = [
    ['year', 365 * 24 * 3600 * 1000],
    ['month', 30 * 24 * 3600 * 1000],
    ['day', 24 * 3600 * 1000],
    ['hour', 3600 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000]
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return '';
}

export function timeLeft(value) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return { expired: true, text: 'انتهى الوقت', days: 0, hours: 0, minutes: 0 };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  let text;
  if (days > 0) text = `${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : days <= 10 ? 'أيام' : 'يوماً'} و ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات'}`;
  else if (hours > 0) text = `${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات'} و ${minutes} دقيقة`;
  else text = `${minutes} دقيقة`;
  return { expired: false, text, days, hours, minutes };
}

export const fileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  const first = parts[0].replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)/, '').trim() || parts[0];
  const second = parts[1] || '';
  return `${first.charAt(0)}${second.charAt(0)}`.trim();
};

export const roleLabel = (role) => ({
  developer: 'المطور',
  doctor: 'دكتور',
  ta: 'معيد',
  student: 'طالب'
}[role] || role);

export const statusMeta = (status) => ({
  pending: { label: 'لم يتم الحل', tone: 'warning' },
  submitted: { label: 'تم التسليم', tone: 'info' },
  reviewed: { label: 'تمت المراجعة', tone: 'accent' },
  graded: { label: 'تم التصحيح', tone: 'success' },
  expired: { label: 'انتهى الوقت', tone: 'danger' }
}[status] || { label: status, tone: 'neutral' });

export const requestStatusMeta = (status) => ({
  pending: { label: 'قيد المراجعة', tone: 'warning' },
  approved: { label: 'مقبول', tone: 'success' },
  rejected: { label: 'مرفوض', tone: 'danger' }
}[status] || { label: 'لم يُطلب الانضمام', tone: 'neutral' });

export function toDateTimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const plural = (count, one, two, many) => {
  if (count === 1) return one;
  if (count === 2) return two;
  return many || one;
};
