import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpenCheck, GraduationCap, KeyRound, LockKeyhole, MessagesSquare,
  ShieldCheck, Sparkles, UserRound, Users
} from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';
import { Button, ErrorNote, Field, Input } from '../components/ui.jsx';
import { DEVELOPER_CREDIT, DEVELOPER_NAME_AR } from '../lib/credits.js';

const FEATURES = [
  { icon: MessagesSquare, text: 'محادثات أكاديمية فورية لكل مادة وسكشن' },
  { icon: BookOpenCheck, text: 'تكليفات وتسليمات مع متابعة الدرجات' },
  { icon: Users, text: 'مساحات مستقلة للدكتور والمعيد والطالب' },
  { icon: ShieldCheck, text: 'صلاحيات دقيقة وحماية كاملة للبيانات' }
];

export default function Login() {
  const { login, settings } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.username.trim(), form.password);
      if (user.role === 'student' && !user.profileCompleted) navigate('/complete-profile', { replace: true });
      else navigate(homeFor(user.role), { replace: true });
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
            <strong>{settings.platformName}</strong>
            <small>{settings.facultyName} · {settings.universityName}</small>
          </div>
        </div>

        <div>
          <h2>مساحة أكاديمية واحدة<br /><span>تجمع كل هندسة المنوفية</span></h2>
          <p>
            تواصل مع دكاترة موادك ومعيديك، تابع التكليفات وسلّم حلولك، وابقَ على اطلاع
            بكل جديد في مساحة عمل مصممة خصيصاً لكلية الهندسة.
          </p>
        </div>

        <div className="auth-features">
          {FEATURES.map((feature) => (
            <div className="auth-feature" key={feature.text}>
              <feature.icon size={17} />
              <span>{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="auth-hero-foot">
          <span className="dot" />
          <span>الدخول متاح للحسابات التي ينشئها مسؤول المنصة فقط</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow"><Sparkles size={13} /> تسجيل الدخول</span>
          <h1>أهلاً بعودتك</h1>
          <p className="auth-sub">أدخل بيانات حسابك الجامعي للمتابعة إلى مساحة العمل الخاصة بك.</p>

          <form onSubmit={submit}>
            <Field label="اسم المستخدم" required>
              <Input
                icon={UserRound}
                value={form.username}
                onChange={update('username')}
                placeholder="مثال: omar"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="كلمة المرور" required>
              <Input
                icon={LockKeyhole}
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <Button type="submit" size="lg" loading={loading} icon={ArrowLeft} className="btn-block">
              دخول إلى المنصة
            </Button>

            <div className="auth-links">
              <Link to="/forgot"><KeyRound size={12} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} /> نسيت كلمة المرور؟</Link>
              <span className="muted">لا يوجد تسجيل ذاتي</span>
            </div>
          </form>

          <div className="auth-foot">
            إذا لم يكن لديك حساب، تواصل مع مسؤول المنصة لإنشاء حسابك برقمك القومي.
            <br />© {new Date().getFullYear()} {settings.facultyName} · {settings.universityName}
            <br /><span className="dev-credit" dir="ltr">{DEVELOPER_CREDIT}</span>
            <span className="dev-credit">{DEVELOPER_NAME_AR}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
