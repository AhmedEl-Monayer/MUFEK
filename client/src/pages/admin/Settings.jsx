import { useEffect, useState } from 'react';
import {
  BellRing, Building2, HardDrive, Mail, RefreshCw, Save, Settings2, ShieldCheck, Sparkles,
  Timer, ToggleLeft, Trash2, UserRoundCog
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { Button, Card, Field, FullLoader, Input, PageHead, Progress, SectionTitle } from '../../components/ui.jsx';
import { DEVELOPER_NAME, DEVELOPER_NAME_AR } from '../../lib/credits.js';

const DEFAULTS = {
  platform_name: 'منصة هندسة المنوفية',
  faculty_name: 'كلية الهندسة',
  university_name: 'جامعة المنوفية',
  support_email: '',
  reminder_hours: '24',
  default_allow_late: '1',
  allow_student_leave: '1'
};

function SwitchRow({ title, hint, checked, onChange, disabled }) {
  return (
    <div className="settings-row">
      <div>
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
        <span />
      </label>
    </div>
  );
}

export default function AdminSettings() {
  const { setSettings } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch('/admin/settings');
  const { data: storage, loading: storageLoading, reload: reloadStorage } = useFetch('/admin/storage');
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm({ ...DEFAULTS, ...data.settings });
  }, [data]);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api('/admin/settings', { method: 'PATCH', body: form });
      push(result.message || 'تم حفظ الإعدادات');
      setForm((current) => ({ ...current, ...result.settings }));
      setSettings((current) => ({
        ...current,
        platformName: result.settings.platform_name || current.platformName,
        facultyName: result.settings.faculty_name || current.facultyName,
        universityName: result.settings.university_name || current.universityName,
        supportEmail: result.settings.support_email || ''
      }));
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const cleanStorage = async () => {
    setCleaning(true);
    try {
      const result = await api('/admin/storage/cleanup', { method: 'POST' });
      push(result.message || 'تم تنظيف التخزين');
      await reloadStorage({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setCleaning(false);
    }
  };

  if (loading || storageLoading) return <FullLoader label="جارٍ تحميل إعدادات المنصة..." />;

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة النظام"
        title="إعدادات المنصة"
        subtitle="بيانات المؤسسة وسلوك المواعيد النهائية وسياسات الانضمام والاشتراك. تُطبَّق التغييرات على كل المستخدمين فوراً."
        actions={<Button type="submit" form="settings-form" icon={Save} loading={saving}>حفظ الإعدادات</Button>}
      />

      {error ? <div className="notice danger"><ShieldCheck size={17} /><span>{error}</span></div> : null}

      <form id="settings-form" onSubmit={save} className="grid-2" style={{ alignItems: 'start' }}>
        <div className="col gap-16">
          <Card>
            <SectionTitle title="هوية المنصة" subtitle="تظهر في الشريط الجانبي وصفحات الدخول." />
            <div className="col gap-14" style={{ marginTop: 14 }}>
              <Field label="اسم المنصة" required>
                <Input value={form.platform_name} onChange={change('platform_name')} icon={Settings2} required maxLength={120} />
              </Field>
              <Field label="اسم الكلية" required>
                <Input value={form.faculty_name} onChange={change('faculty_name')} icon={Building2} required maxLength={120} />
              </Field>
              <Field label="اسم الجامعة" required>
                <Input value={form.university_name} onChange={change('university_name')} icon={Building2} required maxLength={120} />
              </Field>
              <Field label="البريد الإلكتروني للدعم" hint="يظهر في صفحات المساعدة واستعادة كلمة المرور.">
                <Input
                  type="email"
                  value={form.support_email}
                  onChange={change('support_email')}
                  icon={Mail}
                  dir="ltr"
                  placeholder="support@example.edu"
                  maxLength={120}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle title="مطور المنصة" subtitle="هوية الجهة التي صمّمت هذه المنصة وأنشأتها." />
            <div className="credit-box">
              <span className="info-icon"><Sparkles size={18} /></span>
              <div>
                <strong dir="ltr">{DEVELOPER_NAME}</strong>
                <small>{DEVELOPER_NAME_AR}</small>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="المواعيد النهائية" subtitle="تحكم في تنبيهات التسليم والسماح بالتأخير." />
            <div className="col gap-14" style={{ marginTop: 14 }}>
              <Field label="عدد ساعات التنبيه قبل الموعد النهائي" hint="يُرسل تنبيه للتكليفات التي لم يتم تسليمها قبل الموعد بهذه المدة.">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={form.reminder_hours}
                  onChange={change('reminder_hours')}
                  icon={Timer}
                />
              </Field>
              <SwitchRow
                title="السماح بالتسليم المتأخر افتراضياً"
                hint="عند تفعيله، يكون خيار السماح بالتأخير مفعلاً في نموذج نشر التكليف الجديد، ويمكن تغييره لكل تكليف."
                checked={form.default_allow_late === '1'}
                onChange={(value) => setForm((current) => ({ ...current, default_allow_late: value ? '1' : '0' }))}
              />
            </div>
          </Card>
        </div>

        <div className="col gap-16">
          <Card>
            <SectionTitle title="سياسات الاشتراك" subtitle="تحكم في قدرة الطالب على إدارة اشتراكه." />
            <div className="col gap-14" style={{ marginTop: 14 }}>
              <SwitchRow
                title="السماح للطالب بإلغاء الاشتراك"
                hint="عند التعطيل، يظل الطالب مشتركاً حتى تقوم إدارة المادة بإزالته."
                checked={form.allow_student_leave === '1'}
                onChange={(value) => setForm((current) => ({ ...current, allow_student_leave: value ? '1' : '0' }))}
              />
              <div className="notice warning">
                <BellRing size={17} />
                <span>تعطيل إلغاء الاشتراك يمنع الطالب من مغادرة المادة بنفسه، لكنه لا يمنع إدارة المادة من إزالته.</span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="مساحة التخزين"
              subtitle="الصور تُضغط تلقائياً قبل الرفع، ويمكنك حذف الملفات غير المرتبطة بأي مادة أو تسليم."
              action={(
                <Button size="sm" variant="soft" icon={RefreshCw} loading={cleaning} onClick={cleanStorage}>
                  تنظيف
                </Button>
              )}
            />
            <div className="col gap-8" style={{ marginTop: 14 }}>
              <div className="info-row">
                <span className="info-icon"><HardDrive size={16} /></span>
                <span className="info-label">الملفات المحفوظة</span>
                <span className="info-value">{storage?.files ?? 0} ملف</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><Trash2 size={16} /></span>
                <span className="info-label">المساحة المستخدمة</span>
                <span className="info-value">{storage?.megabytes ?? 0} ميجابايت</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><ShieldCheck size={16} /></span>
                <span className="info-label">أقصى حجم للملف الواحد</span>
                <span className="info-value">{storage?.limitMb ?? 20} ميجابايت</span>
              </div>
              <Progress value={storage?.megabytes || 0} max={5120} tone="success" />
              <div className="notice warning">
                <HardDrive size={17} />
                <span>الخطة المجانية توفر 5 جيجابايت. الضغط والتنظيف يحافظان على المساحة دون بطاقة ائتمان.</span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="كيف تُطبَّق الإعدادات؟" />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              <div className="info-row">
                <span className="info-icon"><UserRoundCog size={16} /></span>
                <span className="info-label">هوية المنصة</span>
                <span className="info-value">تظهر لكل المستخدمين بعد الحفظ</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><Timer size={16} /></span>
                <span className="info-label">تنبيه الموعد</span>
                <span className="info-value">يُفحص دورياً على الخادم</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><ToggleLeft size={16} /></span>
                <span className="info-label">التسليم المتأخر</span>
                <span className="info-value">قيمة افتراضية قابلة للتغيير لكل تكليف</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><ShieldCheck size={16} /></span>
                <span className="info-label">إلغاء الاشتراك</span>
                <span className="info-value">يُفحص على الخادم قبل التنفيذ</span>
              </div>
            </div>
          </Card>

          <div className="notice success">
            <ShieldCheck size={17} />
            <span>هذه الإعدادات محفوظة في قاعدة البيانات وليست قيماً ثابتة في الواجهة.</span>
          </div>
        </div>
      </form>
    </div>
  );
}
