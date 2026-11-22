import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, GraduationCap, IdCard, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Avatar, Button, ErrorNote, Field, FullLoader, Input } from '../components/ui.jsx';

export default function CompleteProfile() {
  const { updateUser } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const { data, loading } = useFetch('/profile');
  const profile = data?.user;
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ fullName: profile.fullName || '', phone: profile.phone || '' });
  }, [profile?.id]);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (loading) return <FullLoader label="جارٍ تحميل بياناتك..." />;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('avatar', file);
        const avatarResult = await api('/profile/avatar', { method: 'POST', form: fd });
        updateUser(avatarResult.user);
      }
      const result = await api('/profile', { method: 'PATCH', body: { fullName: form.fullName.trim(), phone: form.phone.trim() } });
      updateUser(result.user);
      if (result.user.profileCompleted) {
        push('تم استكمال ملفك الشخصي بنجاح. أهلاً بك في المنصة');
        navigate('/student', { replace: true });
      } else {
        setError('أضف صورة شخصية ورقم هاتف لإكمال الملف');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page" style={{ gridTemplateColumns: '1fr' }}>
      <section className="auth-panel" style={{ minHeight: '100vh' }}>
        <div className="auth-card profile-setup" style={{ maxWidth: 760 }}>
          <span className="eyebrow"><Sparkles size={13} /> خطوة واحدة قبل البدء</span>
          <h1>استكمل ملفك الشخصي</h1>
          <p className="auth-sub">
            أهلاً {profile?.fullName}. قبل استخدام المنصة نحتاج صورة شخصية ورقم هاتف صحيح،
            حتى يتعرف عليك دكاترة المواد ومعيدوك بسهولة.
          </p>

          <form onSubmit={save}>
            <div className="setup-grid">
              <div className="setup-avatar">
                <Avatar name={form.fullName || profile?.fullName} src={preview || profile?.avatar} size={116} ring />
                <label className="avatar-upload">
                  <Camera size={15} /> اختيار صورة شخصية
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                </label>
                <span className="tiny muted">JPG أو PNG أو WebP · حتى 5 ميجابايت</span>
                <span className="pill"><ShieldCheck size={13} /> صورة واضحة للوجه</span>
              </div>

              <div className="col gap-12">
                <div className="form-grid">
                  <Field label="الاسم الكامل" required className="span-2">
                    <Input icon={UserRound} value={form.fullName} onChange={update('fullName')} placeholder="الاسم كما في شؤون الطلاب" required />
                  </Field>
                  <Field label="رقم الهاتف" hint="سيظهر لمعيدك للتواصل الأكاديمي فقط" required>
                    <Input icon={Phone} value={form.phone} onChange={update('phone')} placeholder="01xxxxxxxxx" inputMode="tel" required />
                  </Field>
                  <Field label="اسم المستخدم">
                    <Input icon={GraduationCap} value={profile?.username || ''} disabled />
                  </Field>
                  <Field label="الرقم القومي" hint="محفوظ مشفراً ولا يظهر كاملاً" className="span-2">
                    <Input icon={IdCard} value={profile?.nationalIdMasked || '••••••••••••'} disabled />
                  </Field>
                </div>

                <div className="notice">
                  <CheckCircle2 size={17} />
                  <span>بياناتك محمية. الرقم القومي مشفّر، ولا يمكن لأي مستخدم آخر الوصول إلى ملفك أو محادثاتك.</span>
                </div>

                {error ? <ErrorNote>{error}</ErrorNote> : null}

                <div className="form-actions">
                  <Button type="submit" size="lg" loading={saving} icon={CheckCircle2}>حفظ ومتابعة</Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
