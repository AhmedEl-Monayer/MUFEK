import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Image as ImageIcon, Save, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Button, Card, ErrorNote, Field, FilePicker, Input, PageHead, SectionTitle, Textarea
} from '../../components/ui.jsx';

export default function CreateCourse() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 3) {
      setError('اسم المادة يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('code', form.code.trim());
      fd.append('description', form.description.trim());
      if (image) fd.append('image', image);
      const result = await api('/courses', { method: 'POST', form: fd });
      push(result.message || 'تم إنشاء المادة بنجاح');
      navigate(`/doctor/courses/${result.course.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="مادة جديدة"
        title="إنشاء مادة"
        subtitle="أنشئ مساحة مادة كاملة: شات عام تلقائي، إدارة معيدين وطلاب، وتكليفات وتسليمات."
        actions={<Link to="/doctor/courses" className="btn btn-ghost btn-sm"><BookOpen size={15} /> العودة للمواد</Link>}
      />

      <div className="assignment-body-grid">
        <Card>
          <SectionTitle title="بيانات المادة" subtitle="تظهر هذه البيانات لكل الطلاب في دليل المواد." />
          <form onSubmit={submit} className="col gap-14" style={{ marginTop: 14 }}>
            <div className="form-grid">
              <Field label="اسم المادة" required className="span-2">
                <Input value={form.name} onChange={update('name')} placeholder="مثال: تحليل الدوائر الكهربية" minLength={3} maxLength={120} required />
              </Field>
              <Field label="كود المادة" hint="يظهر كشارة على غلاف المادة">
                <Input value={form.code} onChange={update('code')} placeholder="مثال: ECE 201" maxLength={24} />
              </Field>
              <Field label="صورة المادة" hint="اختيارية — تظهر كغلاف للمادة">
                <FilePicker file={image} onChange={setImage} accept="image/png,image/jpeg,image/webp" label="اختيار صورة الغلاف" />
              </Field>
              <Field label="وصف المادة" className="span-2">
                <Textarea
                  value={form.description}
                  onChange={update('description')}
                  placeholder="اكتب وصفاً مختصراً للمادة ومحتواها..."
                  maxLength={3000}
                />
              </Field>
            </div>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="form-actions">
              <Link to="/doctor/courses" className="btn btn-ghost">إلغاء</Link>
              <Button type="submit" icon={Save} loading={saving}>إنشاء المادة</Button>
            </div>
          </form>
        </Card>

        <div className="col gap-16">
          <Card className="course-side-card">
            <h3>ماذا يحدث بعد الإنشاء؟</h3>
            <div className="row gap-8">
              <span className="stat-icon tone-blue" style={{ width: 38, height: 38, borderRadius: 11 }}><Users size={17} /></span>
              <div className="grow">
                <div className="small strong">شات عام تلقائي</div>
                <div className="tiny muted">لكل طلاب المادة وهيئة التدريس.</div>
              </div>
            </div>
            <div className="row gap-8">
              <span className="stat-icon tone-violet" style={{ width: 38, height: 38, borderRadius: 11 }}><GraduationCap size={17} /></span>
              <div className="grow">
                <div className="small strong">إضافة المعيدين</div>
                <div className="tiny muted">لكل معيد شات خاص بطلاب سكشنه.</div>
              </div>
            </div>
            <div className="row gap-8">
              <span className="stat-icon tone-amber" style={{ width: 38, height: 38, borderRadius: 11 }}><ImageIcon size={17} /></span>
              <div className="grow">
                <div className="small strong">تكليفات وتسليمات</div>
                <div className="tiny muted">مع مواعيد نهائية ودرجات وملاحظات.</div>
              </div>
            </div>
            <div className="notice">
              <BookOpen size={17} />
              <span>ستتمكن من تعديل بيانات المادة وإضافة معيدين فور إنشائها.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
