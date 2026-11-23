import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ClipboardList, FolderKanban, Plus, Search, Settings2, ToggleLeft, ToggleRight, Users
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDate } from '../../lib/format.js';
import { prepareCourseImage } from '../../lib/image.js';
import {
  Badge, Button, EmptyState, Field, FilePicker, FullLoader, Input, Modal, PageHead, SearchInput,
  Select, StatCard, Textarea
} from '../../components/ui.jsx';

const emptyForm = () => ({ name: '', code: '', description: '', doctorId: '', image: null });

export default function AdminCourses() {
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch('/admin/courses');
  const { data: doctorsData } = useFetch('/admin/users?role=doctor');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const courses = data?.courses || [];
  const doctors = doctorsData?.users || [];

  const visible = useMemo(() => courses.filter((course) => {
    if (filter === 'active' && !course.is_active) return false;
    if (filter === 'inactive' && course.is_active) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [course.name, course.code, course.description, course.doctor_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [courses, filter, query]);

  const openCreate = () => {
    setForm({ ...emptyForm(), doctorId: doctors[0] ? String(doctors[0].id) : '' });
    setCreateOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      body.append('name', form.name);
      body.append('code', form.code);
      body.append('description', form.description);
      if (form.doctorId) body.append('doctorId', form.doctorId);
      if (form.image) body.append('image', form.image);
      const result = await api('/courses', { method: 'POST', form: body });
      push(result.message || 'تم إنشاء المادة');
      setCreateOpen(false);
      setForm(emptyForm());
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (course) => {
    setBusyId(course.id);
    try {
      const result = await api(`/courses/${course.id}`, {
        method: 'PATCH',
        body: { isActive: !course.is_active }
      });
      push(result.message || 'تم تحديث حالة المادة');
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FullLoader label="جارٍ تحميل المواد..." />;

  const totals = {
    students: courses.reduce((sum, course) => sum + (course.students_count || 0), 0),
    assignments: courses.reduce((sum, course) => sum + (course.assignments_count || 0), 0)
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة المواد"
        title="المواد"
        subtitle="كل المواد على المنصة مع الدكتور المسؤول وأعداد الطلاب والمعيدين والتكليفات."
        actions={(
          <Button icon={Plus} onClick={openCreate} disabled={doctors.length === 0}>
            إنشاء مادة
          </Button>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={FolderKanban} label="المواد" value={courses.length} tone="blue" />
        <StatCard icon={BookOpen} label="مواد نشطة" value={courses.filter((course) => course.is_active).length} tone="emerald" />
        <StatCard icon={Users} label="إجمالي الطلاب" value={totals.students} tone="teal" />
        <StatCard icon={ClipboardList} label="التكليفات" value={totals.assignments} tone="amber" />
      </div>

      {doctors.length === 0 ? (
        <div className="notice warning">
          <Users size={17} />
          <span>لا يوجد حساب دكتور نشط. أنشئ حساب دكتور أولاً لتتمكن من إسناد المواد إليه.</span>
        </div>
      ) : null}

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل ({courses.length})</button>
            <button className={`chip ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>نشطة ({courses.filter((course) => course.is_active).length})</button>
            <button className={`chip ${filter === 'inactive' ? 'active' : ''}`} onClick={() => setFilter('inactive')}>متوقفة ({courses.filter((course) => !course.is_active).length})</button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم المادة أو الدكتور..." />
        </div>
      </div>

      {error ? (
        <EmptyState icon={FolderKanban} title="تعذر تحميل المواد" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={courses.length === 0 ? FolderKanban : Search}
          title={courses.length === 0 ? 'لا توجد مواد بعد' : 'لا توجد مواد مطابقة'}
          text={courses.length === 0
            ? 'أنشئ مادة جديدة وأسندها لدكتور مسؤول.'
            : 'جرّب تغيير عامل التصفية أو كلمة البحث.'}
          action={courses.length === 0 && doctors.length > 0 ? <Button icon={Plus} onClick={openCreate}>إنشاء مادة</Button> : null}
        />
      ) : (
        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المادة</th>
                  <th>الدكتور المسؤول</th>
                  <th>الطلاب</th>
                  <th>المعيدون</th>
                  <th>التكليفات</th>
                  <th>الحالة</th>
                  <th>تاريخ الإنشاء</th>
                  <th style={{ textAlign: 'end' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <div className="user-cell">
                        <span className="stat-icon tone-blue" style={{ width: 34, height: 34, borderRadius: 10 }}>
                          <BookOpen size={16} />
                        </span>
                        <div>
                          <strong>{course.name}</strong>
                          <small>{course.code || 'بدون كود'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="small">{course.doctor_name}</td>
                    <td className="small strong">{course.students_count}</td>
                    <td className="small strong">{course.tas_count}</td>
                    <td className="small strong">{course.assignments_count}</td>
                    <td>
                      <Badge tone={course.is_active ? 'success' : 'neutral'}>{course.is_active ? 'نشطة' : 'متوقفة'}</Badge>
                    </td>
                    <td className="small">{fmtDate(course.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={course.is_active ? ToggleRight : ToggleLeft}
                          loading={busyId === course.id}
                          onClick={() => toggleActive(course)}
                        >
                          {course.is_active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                        <Link to={`/admin/courses/${course.id}`} className="btn btn-soft btn-sm">
                          <Settings2 size={14} /> إدارة
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء مادة جديدة"
        subtitle="ستُنشأ معها مجموعة الشات العام للمادة تلقائياً."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button type="submit" form="create-course-form" loading={saving}>إنشاء المادة</Button>
          </>
        )}
      >
        <form id="create-course-form" onSubmit={submit} className="form-grid">
          <Field label="اسم المادة" required className="span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="مثال: تحليل الدوائر الكهربية"
              required
              minLength={3}
              maxLength={120}
            />
          </Field>
          <Field label="كود المادة">
            <Input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="EPE 201"
              dir="ltr"
              maxLength={24}
            />
          </Field>
          <Field label="الدكتور المسؤول" required>
            <Select
              value={form.doctorId}
              onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
              required
            >
              <option value="">اختر الدكتور</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
            </Select>
          </Field>
          <Field label="وصف المادة" className="span-2">
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="وصف مختصر لمحتوى المادة..."
              maxLength={3000}
            />
          </Field>
          <Field label="غلاف المادة" className="span-2" hint="اختياري · JPG أو PNG أو WEBP حتى 4 ميجابايت.">
            <FilePicker
              file={form.image}
              onChange={(file) => setForm((current) => ({ ...current, image: file }))}
              prepare={prepareCourseImage}
              accept="image/jpeg,image/png,image/webp"
              hint="تُصغّر الصورة تلقائياً لتوفير المساحة"
              label="اختر صورة الغلاف"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
