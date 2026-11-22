import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Copy, Eye, EyeOff, GraduationCap, KeyRound, ShieldCheck, UserPlus, Users, Wand2
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Button, Card, Field, Input, PageHead, Select
} from '../../components/ui.jsx';

const emptyForm = () => ({
  fullName: '',
  username: '',
  nationalId: '',
  phone: '',
  password: '',
  role: 'student'
});

const generatePassword = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const pick = (source) => source[Math.floor(Math.random() * source.length)];
  let value = '';
  for (let i = 0; i < 7; i += 1) value += pick(letters);
  for (let i = 0; i < 4; i += 1) value += pick(digits);
  return `${value.slice(0, 4)}@${value.slice(4)}`;
};

export default function AdminCreateUser() {
  const { push } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api('/admin/users', { method: 'POST', body: form });
      setCreated({ user: result.user, password: form.password });
      push(result.message || 'تم إنشاء الحساب');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    const text = `اسم المستخدم: ${created.user.username}\nكلمة المرور المؤقتة: ${created.password}\nالنوع: ${created.user.role}`;
    try {
      await navigator.clipboard.writeText(text);
      push('تم نسخ بيانات الدخول');
    } catch {
      push('تعذر النسخ التلقائي', 'error');
    }
  };

  if (created) {
    return (
      <div className="page">
        <PageHead
          eyebrow="إدارة الحسابات"
          title="تم إنشاء الحساب"
          subtitle="سلّم بيانات الدخول للمستخدم عبر قناة آمنة. يمكنه تغيير كلمة المرور من صفحة الملف الشخصي بعد الدخول."
        />
        <Card style={{ maxWidth: 620 }}>
          <div className="col gap-16">
            <div className="notice success">
              <CheckCircle2 size={17} />
              <span>تم إنشاء حساب {created.user.fullName} بنجاح، ويمكنه تسجيل الدخول الآن.</span>
            </div>

            <div className="info-row"><span className="info-label">الاسم</span><span className="info-value">{created.user.fullName}</span></div>
            <div className="info-row"><span className="info-label">اسم المستخدم</span><span className="info-value" style={{ direction: 'ltr' }}>{created.user.username}</span></div>
            <div className="info-row"><span className="info-label">كلمة المرور المؤقتة</span><span className="info-value" style={{ direction: 'ltr' }}>{created.password}</span></div>
            <div className="info-row"><span className="info-label">الرقم القومي</span><span className="info-value" style={{ direction: 'ltr' }}>{created.user.nationalIdMasked}</span></div>
            <div className="info-row"><span className="info-label">نوع الحساب</span><span className="info-value">{created.user.role === 'student' ? 'طالب' : created.user.role === 'doctor' ? 'دكتور' : 'معيد'}</span></div>

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <Button variant="ghost" icon={ArrowLeft} onClick={() => { setCreated(null); setForm(emptyForm()); }}>
                إنشاء حساب آخر
              </Button>
              <div className="row gap-8">
                <Button variant="secondary" icon={Copy} onClick={copyCredentials}>نسخ البيانات</Button>
                <Link to="/admin/users" className="btn btn-primary"><Users size={16} /> إدارة المستخدمين</Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة الحسابات"
        title="إنشاء حساب جديد"
        subtitle="الحسابات تُنشأ بواسطة المطور فقط. أدخل البيانات الأساسية، وسيستكمل الطالب ملفه عند أول دخول."
        actions={<Link to="/admin/users" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> رجوع للمستخدمين</Link>}
      />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <form onSubmit={submit} className="form-grid">
            <Field label="الاسم الكامل" required className="span-2">
              <Input value={form.fullName} onChange={change('fullName')} placeholder="مثال: أحمد محمد علي" required minLength={3} maxLength={120} />
            </Field>

            <Field label="اسم المستخدم" required hint="3-32 حرفاً، يمكن استخدام الحروف والأرقام والنقطة والشرطة.">
              <Input value={form.username} onChange={change('username')} placeholder="ahmed.ali" required dir="ltr" minLength={3} maxLength={32} />
            </Field>

            <Field label="الرقم القومي" required hint="14 رقماً، يُخزَّن مشفراً ولا يظهر كاملاً في أي واجهة.">
              <Input
                value={form.nationalId}
                onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value.replace(/\D/g, '').slice(0, 14) }))}
                placeholder="14 رقماً"
                required
                dir="ltr"
                inputMode="numeric"
                pattern="\d{14}"
                maxLength={14}
              />
            </Field>

            <Field label="رقم الهاتف">
              <Input value={form.phone} onChange={change('phone')} placeholder="01xxxxxxxxx" dir="ltr" maxLength={20} />
            </Field>

            <Field label="نوع الحساب" required>
              <Select value={form.role} onChange={change('role')}>
                <option value="student">طالب</option>
                <option value="doctor">دكتور</option>
                <option value="ta">معيد</option>
              </Select>
            </Field>

            <Field label="كلمة المرور" required hint="8 أحرف على الأقل وتتضمن حرفاً ورقماً." className="span-2">
              <div className="row gap-8">
                <span className="grow" style={{ position: 'relative' }}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={change('password')}
                    placeholder="كلمة مرور مؤقتة"
                    required
                    dir="ltr"
                    minLength={8}
                    maxLength={128}
                  />
                </span>
                <Button
                  variant="ghost"
                  icon={showPassword ? EyeOff : Eye}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                />
                <Button
                  variant="soft"
                  icon={Wand2}
                  onClick={() => {
                    const password = generatePassword();
                    setForm((current) => ({ ...current, password }));
                    setShowPassword(true);
                  }}
                >
                  توليد
                </Button>
              </div>
            </Field>

            <div className="span-2 notice">
              <ShieldCheck size={17} />
              <span>يمكن للمستخدم تغيير كلمة المرور من صفحة الملف الشخصي بعد الدخول. لا يمكن لأي حساب إنشاء حسابات أخرى.</span>
            </div>

            <div className="span-2 form-actions">
              <Button variant="ghost" onClick={() => setForm(emptyForm())}>تفريغ الحقول</Button>
              <Button type="submit" icon={UserPlus} loading={saving}>إنشاء الحساب</Button>
            </div>
          </form>
        </Card>

        <div className="col gap-16">
          <Card>
            <div className="section-title"><div><h3>ماذا يحدث بعد الإنشاء؟</h3></div></div>
            <div className="col gap-12" style={{ marginTop: 12 }}>
              <div className="role-card">
                <span className="role-card-icon"><GraduationCap size={19} /></span>
                <div>
                  <strong>الطالب</strong>
                  <p>يسجّل الدخول، يكمل ملفه (الصورة والهاتف ومراجعة البيانات)، ثم يستعرض المواد ويشترك فيها.</p>
                </div>
              </div>
              <div className="role-card">
                <span className="role-card-icon"><Users size={19} /></span>
                <div>
                  <strong>الدكتور</strong>
                  <p>يبدأ بإنشاء المواد وإضافة المعيدين والطلاب ونشر التكليفات وإدارة الشاتات.</p>
                </div>
              </div>
              <div className="role-card">
                <span className="role-card-icon"><KeyRound size={19} /></span>
                <div>
                  <strong>المعيد</strong>
                  <p>تتم إضافته لمواد الدكتور، ثم يدير شات سكشنه وطلبات الانضمام والتكليفات المسندة إليه.</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="notice warning">
            <ShieldCheck size={17} />
            <span>احتفظ بكلمة المرور المؤقتة في مكان آمن، ولن تظهر مرة أخرى بعد مغادرة الصفحة.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
