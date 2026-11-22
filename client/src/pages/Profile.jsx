import { useEffect, useState } from 'react';
import { AtSign, BadgeCheck, CalendarDays, Camera, IdCard, KeyRound, LockKeyhole, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { fmtDate, fmtDateTime, roleLabel } from '../lib/format.js';
import { Avatar, Badge, Button, Card, ErrorNote, Field, FullLoader, InfoRow, Input, PageHead, SectionTitle } from '../components/ui.jsx';

export default function Profile() {
  const { updateUser } = useAuth();
  const { push } = useToast();
  const { data, loading, reload } = useFetch('/profile');
  const profile = data?.user;
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (profile) setForm({ fullName: profile.fullName || '', phone: profile.phone || '' });
  }, [profile?.id]);

  if (loading) return <FullLoader label="جارٍ تحميل الملف الشخصي..." />;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const updatePassword = (key) => (event) => setPasswords((current) => ({ ...current, [key]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      const result = await api('/profile', { method: 'PATCH', body: { fullName: form.fullName.trim(), phone: form.phone.trim() } });
      updateUser(result.user);
      await reload({ silent: true });
      push('تم حفظ بياناتك الشخصية');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const result = await api('/profile/avatar', { method: 'POST', form: fd });
      updateUser(result.user);
      await reload({ silent: true });
      push('تم تحديث الصورة الشخصية');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('كلمتا المرور غير متطابقتين');
      return;
    }
    setSavingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      push('تم تغيير كلمة المرور بنجاح');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="حسابي"
        title="الملف الشخصي والإعدادات"
        subtitle="حدّث بياناتك وصورتك الشخصية، وتحكم في أمان حسابك."
      />

      {profile?.mustChangePassword ? (
        <div className="notice warning">
          <ShieldCheck size={17} />
          <span>تم إعادة تعيين كلمة المرور بواسطة الإدارة. يُفضّل تعيين كلمة مرور جديدة الآن من قسم الأمان.</span>
        </div>
      ) : null}

      <div className="profile-grid">
        <Card className="profile-card">
          <Avatar name={profile?.fullName} src={profile?.avatar} size={96} ring />
          <h3>{profile?.fullName}</h3>
          <p>@{profile?.username}</p>
          <Badge tone="primary" icon={BadgeCheck}>{roleLabel(profile?.role)}</Badge>
          {profile?.profileCompleted ? <Badge tone="success">ملف مكتمل</Badge> : <Badge tone="warning">ملف غير مكتمل</Badge>}
          <label className="avatar-upload">
            <Camera size={15} /> {uploading ? 'جارٍ الرفع...' : 'تغيير الصورة الشخصية'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={uploading} />
          </label>
          <span className="tiny muted">JPG أو PNG أو WebP · حتى 5 ميجابايت</span>
        </Card>

        <div className="col gap-16">
          <Card>
            <SectionTitle title="البيانات الأساسية" subtitle="تظهر لزملائك وهيئة التدريس في المواد المشتركة." />
            <form onSubmit={saveProfile} style={{ marginTop: 14 }}>
              <div className="form-grid">
                <Field label="الاسم الكامل" required>
                  <Input icon={UserRound} value={form.fullName} onChange={update('fullName')} required />
                </Field>
                <Field label="رقم الهاتف" required={profile?.role === 'student'}>
                  <Input icon={Phone} value={form.phone} onChange={update('phone')} inputMode="tel" />
                </Field>
                <Field label="اسم المستخدم">
                  <Input icon={AtSign} value={profile?.username || ''} disabled />
                </Field>
                <Field label="الرقم القومي" hint="محفوظ مشفراً في قاعدة البيانات">
                  <Input icon={IdCard} value={profile?.nationalIdMasked || '—'} disabled />
                </Field>
              </div>
              {profileError ? <div className="mt-12"><ErrorNote>{profileError}</ErrorNote></div> : null}
              <div className="form-actions" style={{ marginTop: 14 }}>
                <Button type="submit" icon={BadgeCheck} loading={savingProfile}>حفظ التغييرات</Button>
              </div>
            </form>
          </Card>

          <Card>
            <SectionTitle title="بيانات الحساب" subtitle="معلومات ثابتة يديرها مسؤول المنصة." />
            <div style={{ marginTop: 10 }}>
              <InfoRow icon={UserRound} label="نوع الحساب" value={roleLabel(profile?.role)} />
              <InfoRow icon={CalendarDays} label="تاريخ إنشاء الحساب" value={fmtDate(profile?.createdAt)} />
              <InfoRow icon={KeyRound} label="آخر تسجيل دخول" value={fmtDateTime(profile?.lastLoginAt)} />
              <InfoRow icon={ShieldCheck} label="حالة الحساب" value={profile?.isActive ? 'نشط' : 'معطل'} />
            </div>
          </Card>

          <Card>
            <SectionTitle title="الأمان" subtitle="غيّر كلمة المرور بشكل دوري لحماية حسابك." />
            <form onSubmit={changePassword} style={{ marginTop: 14 }}>
              <div className="form-grid">
                <Field label="كلمة المرور الحالية" required className="span-2">
                  <Input icon={LockKeyhole} type="password" value={passwords.currentPassword} onChange={updatePassword('currentPassword')} autoComplete="current-password" required />
                </Field>
                <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل وتحتوي على حروف وأرقام" required>
                  <Input icon={KeyRound} type="password" value={passwords.newPassword} onChange={updatePassword('newPassword')} autoComplete="new-password" required />
                </Field>
                <Field label="تأكيد كلمة المرور" required>
                  <Input icon={KeyRound} type="password" value={passwords.confirm} onChange={updatePassword('confirm')} autoComplete="new-password" required />
                </Field>
              </div>
              {passwordError ? <div className="mt-12"><ErrorNote>{passwordError}</ErrorNote></div> : null}
              <div className="form-actions" style={{ marginTop: 14 }}>
                <Button type="submit" variant="secondary" icon={ShieldCheck} loading={savingPassword}>تغيير كلمة المرور</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
