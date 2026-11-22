import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, GraduationCap, IdCard, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';

export default function Forgot() {
  const { push } = useToast();
  const [form, setForm] = useState({ username: '', nationalId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: { username: form.username.trim(), nationalId: form.nationalId.trim() }
      });
      setResult(data);
      push('تم التحقق من هويتك بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.token);
      push('تم نسخ رمز الاستعادة');
    } catch {
      push('تعذر النسخ، انسخ الرمز يدوياً', 'error');
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-brand">
          <span className="brand-mark"><GraduationCap size={25} /></span>
          <div>
            <strong>استعادة كلمة المرور</strong>
            <small>كلية الهندسة · جامعة المنوفية</small>
          </div>
        </div>
        <div>
          <h2>تحقق من هويتك<br /><span>باسم المستخدم والرقم القومي</span></h2>
          <p>
            لحماية حسابك، نتحقق من اسم المستخدم والرقم القومي المسجل. بعد التحقق ستحصل على
            رمز استعادة صالح لمدة ساعة واحدة لتعيين كلمة مرور جديدة.
          </p>
        </div>
        <div className="auth-features">
          <div className="auth-feature"><ShieldCheck size={17} /><span>الرقم القومي مشفّر ولا يظهر كاملاً</span></div>
          <div className="auth-feature"><KeyRound size={17} /><span>رمز استعادة لمرة واحدة فقط</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow"><KeyRound size={13} /> استعادة الحساب</span>
          <h1>نسيت كلمة المرور؟</h1>
          <p className="auth-sub">أدخل بياناتك للتحقق من ملكية الحساب.</p>

          {result ? (
            <div className="col gap-12">
              <div className="notice success"><ShieldCheck size={17} /> تم التحقق من هويتك. استخدم الرمز التالي لتعيين كلمة مرور جديدة.</div>
              <Card glass={false} style={{ padding: 16 }}>
                <div className="field-label" style={{ marginBottom: 7 }}>رمز الاستعادة</div>
                <div className="auth-token">{result.token}</div>
                <div className="row between" style={{ marginTop: 12 }}>
                  <span className="tiny muted">ينتهي في {new Date(result.expiresAt).toLocaleString('ar-EG-u-nu-latn')}</span>
                  <Button variant="soft" size="sm" icon={Copy} onClick={copy}>نسخ الرمز</Button>
                </div>
              </Card>
              <Link to={`/reset?token=${encodeURIComponent(result.token)}`} className="btn btn-primary btn-lg btn-block">
                <span>متابعة لتعيين كلمة المرور</span>
                <ArrowLeft size={17} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <Field label="اسم المستخدم" required>
                <Input icon={UserRound} value={form.username} onChange={update('username')} placeholder="اسم المستخدم" autoComplete="username" required />
              </Field>
              <Field label="الرقم القومي" hint="14 رقماً كما هو مسجل في شؤون الطلاب" required>
                <Input
                  icon={IdCard}
                  value={form.nationalId}
                  onChange={update('nationalId')}
                  placeholder="30001011234567"
                  inputMode="numeric"
                  maxLength={14}
                  required
                />
              </Field>
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <Button type="submit" size="lg" loading={loading} icon={ArrowLeft} className="btn-block">تحقق من الهوية</Button>
            </form>
          )}

          <div className="auth-foot">
            <Link to="/login" className="strong"><ArrowRight size={12} style={{ verticalAlign: '-2px' }} /> العودة لتسجيل الدخول</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
