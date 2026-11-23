import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, FileUp, Loader2, Search, X } from 'lucide-react';
import { fileSize, initials } from '../lib/format.js';

export const cn = (...parts) => parts.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', !children && 'btn-icon', className)}
      {...rest}
      disabled={loading || rest.disabled}
    >
      {loading ? <Loader2 size={17} className="spin" /> : Icon ? <Icon size={17} /> : null}
      {children ? <span>{children}</span> : null}
      {IconRight ? <IconRight size={16} /> : null}
    </button>
  );
}

export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('btn', `btn-${variant}`, 'btn-icon', size === 'sm' && 'btn-sm', className)}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} />
    </button>
  );
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={cn('field', className)}>
      {label ? <span className="field-label">{label}{required ? <em>*</em> : null}</span> : null}
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error"><AlertCircle size={13} /> {error}</span> : null}
    </label>
  );
}

export function Input({ icon: Icon, className = '', ...rest }) {
  if (Icon) {
    return (
      <span className="input-wrap">
        <Icon size={17} className="input-icon" />
        <input className={cn('input input-with-icon', className)} {...rest} />
      </span>
    );
  }
  return <input className={cn('input', className)} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={cn('input textarea', className)} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return <select className={cn('input select', className)} {...rest}>{children}</select>;
}

export function SearchInput({ value, onChange, placeholder = 'بحث...' }) {
  return (
    <span className="search-input">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </span>
  );
}

export function Badge({ tone = 'neutral', children, icon: Icon, className = '' }) {
  return (
    <span className={cn('badge', `badge-${tone}`, className)}>
      {Icon ? <Icon size={12} /> : null}
      {children}
    </span>
  );
}

export function Card({ children, className = '', glass = true, ...rest }) {
  return <div className={cn(glass ? 'glass card' : 'card', className)} {...rest}>{children}</div>;
}

export function Avatar({ name, src, size = 42, className = '', ring = false }) {
  const hue = [...String(name || '؟')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, size * 0.34),
    background: `linear-gradient(140deg, hsl(${hue} 85% 92%), hsl(${(hue + 40) % 360} 75% 82%))`,
    color: `hsl(${hue} 45% 30%)`
  };
  const raw = src ? String(src) : '';
  const url = raw ? (raw.startsWith('/api') ? raw : `/api/files/avatar/${raw}?v=${encodeURIComponent(raw)}`) : null;
  return (
    <span className={cn('avatar', ring && 'avatar-ring', className)} style={style}>
      {url ? <img src={url} alt={name || ''} loading="lazy" /> : <span>{initials(name)}</span>}
    </span>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className={cn('modal', `modal-${size}`)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton icon={X} label="إغلاق" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title = 'تأكيد العملية', message, confirmLabel = 'تأكيد', tone = 'danger', loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  );
}

export function EmptyState({ icon: Icon, title, text, action, compact = false }) {
  return (
    <div className={cn('empty-state', compact && 'empty-compact')}>
      {Icon ? <span className="empty-icon"><Icon size={compact ? 22 : 28} /></span> : null}
      <h4>{title}</h4>
      {text ? <p>{text}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'جارٍ التحميل...' }) {
  return <span className="spinner-inline"><Loader2 size={18} className="spin" /> {label}</span>;
}

export function FullLoader({ label = 'جارٍ تحميل مساحة العمل...' }) {
  return (
    <div className="full-loader">
      <div className="loader-logo"><Loader2 size={26} className="spin" /></div>
      <p>{label}</p>
    </div>
  );
}

export function Skeleton({ className = '', style }) {
  return <span className={cn('skeleton', className)} style={style} />;
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={cn('tabs', className)} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            className={cn('tab', value === tab.id && 'active')}
            onClick={() => onChange(tab.id)}
          >
            {Icon ? <Icon size={16} /> : null}
            <span>{tab.label}</span>
            {tab.badge ? <span className="tab-badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'blue', loading = false, onClick }) {
  return (
    <div className={cn('glass stat-card', `tone-${tone}`, onClick && 'clickable')} onClick={onClick}>
      <span className="stat-icon"><Icon size={21} /></span>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        {loading ? <Skeleton style={{ width: 46, height: 24 }} /> : <strong className="stat-value">{value ?? 0}</strong>}
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </div>
    </div>
  );
}

export function PageHead({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-title">
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value = 0, max = 100, tone = 'blue' }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('progress', `progress-${tone}`)}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function FilePicker({ file, onChange, accept, label = 'اختر ملفاً', hint, required = false, prepare }) {
  const pick = async (event) => {
    const picked = event.target.files?.[0] || null;
    if (!picked) return onChange(null);
    if (!prepare) return onChange(picked);
    try {
      onChange(await prepare(picked));
    } catch {
      onChange(picked);
    }
  };
  return (
    <label className={cn('file-picker', file && 'has-file')}>
      <input
        type="file"
        accept={accept}
        required={required}
        onChange={pick}
      />
      <span className="file-picker-icon">{file ? <CheckCircle2 size={22} /> : <FileUp size={22} />}</span>
      <span className="file-picker-body">
        <strong>{file ? file.name : label}</strong>
        <small>{file ? fileSize(file.size) : (hint || 'PDF أو صور أو Word · حتى 20 ميجابايت')}</small>
      </span>
      <span className="file-picker-action">{file ? 'تغيير' : 'تصفح'}</span>
    </label>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="error-note"><AlertCircle size={16} /><span>{children}</span></div>;
}

export function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="info-row">
      {Icon ? <span className="info-icon"><Icon size={16} /></span> : null}
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}
