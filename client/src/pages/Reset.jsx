import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, GraduationCap, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Field, Input } from '../components/ui.jsx';

export default function Reset() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ token: params.get('token') || '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token: form.token.trim(), password: form.password } });
      push('تم تعيين كلمة المرور الجديدة. يمكنك الدخول الآن');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-brand">
          <span className="brand-mark"><GraduationCap size={25} /></span>
          <div>
            <strong>تعيين كلمة مرور جديدة</strong>
            <small>كلية الهندسة · جامعة المنوفية</small>
          </div>
        </div>
        <div>
          <h2>اختر كلمة مرور<br /><span>قوية وآمنة لحسابك</span></h2>
          <p>استخدم 8 أحرف على الأقل تحتوي على حروف وأرقام. سيتم إنهاء جميع الجلسات السابقة بعد تغيير كلمة المرور.</p>
        </div>
        <div className="auth-features">
          <div className="auth-feature"><ShieldCheck size={17} /><span>تشفير كامل لكلمة المرور</span></div>
          <div className="auth-feature"><LockKeyhole size={17} /><span>إنهاء الجلسات القديمة تلقائياً</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow"><KeyRound size={13} /> خطوة أخيرة</span>
          <h1>كلمة مرور جديدة</h1>
          <p className="auth-sub">أدخل رمز الاستعادة الذي حصلت عليه ثم اختر كلمة المرور الجديدة.</p>

          <form onSubmit={submit}>
            <Field label="رمز الاستعادة" required>
              <Input
                icon={KeyRound}
                value={form.token}
                onChange={update('token')}
                placeholder="الصق الرمز هنا"
                style={{ direction: 'ltr', textAlign: 'left' }}
                required
              />
            </Field>
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل وتحتوي على حروف وأرقام" required>
              <Input icon={LockKeyhole} type="password" value={form.password} onChange={update('password')} placeholder="••••••••" autoComplete="new-password" required />
            </Field>
            <Field label="تأكيد كلمة المرور" required>
              <Input icon={LockKeyhole} type="password" value={form.confirm} onChange={update('confirm')} placeholder="••••••••" autoComplete="new-password" required />
            </Field>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button type="submit" size="lg" loading={loading} icon={ArrowLeft} className="btn-block">تعيين كلمة المرور</Button>
          </form>

          <div className="auth-foot">
            <Link to="/login" className="strong"><ArrowRight size={12} style={{ verticalAlign: '-2px' }} /> العودة لتسجيل الدخول</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
