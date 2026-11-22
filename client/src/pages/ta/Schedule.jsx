import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, CalendarClock, Clock, MapPin, Save, Users
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { Button, EmptyState, Field, FullLoader, Input, PageHead, StatCard } from '../../components/ui.jsx';

function ScheduleForm({ course, onSaved }) {
  const { push } = useToast();
  const [form, setForm] = useState({
    sectionDay: course.myTa?.sectionDay || '',
    sectionTime: course.myTa?.sectionTime || '',
    sectionRoom: course.myTa?.sectionRoom || ''
  });
  const [saving, setSaving] = useState(false);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api(`/courses/${course.id}/my-section`, {
        method: 'PATCH',
        body: form
      });
      push(result.message || 'تم حفظ موعد السكشن');
      onSaved?.();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="glass card" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="row gap-12" style={{ minWidth: 0 }}>
          <span className="stat-icon tone-teal" style={{ width: 44, height: 44, borderRadius: 14 }}>
            <BookOpen size={19} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>{course.name}</h3>
            <small className="muted tiny">{course.code || 'بدون كود'} · {course.doctorName || 'دكتور المادة'}</small>
          </div>
        </div>
        <span className="pill"><Users size={13} /> {course.studentsCount || 0} طالب</span>
      </div>

      <div className="form-grid">
        <Field label="يوم السكشن">
          <Input
            value={form.sectionDay}
            onChange={change('sectionDay')}
            placeholder="مثال: الأحد"
            maxLength={30}
          />
        </Field>
        <Field label="وقت السكشن">
          <Input
            value={form.sectionTime}
            onChange={change('sectionTime')}
            placeholder="مثال: 10:00 ص - 12:00 م"
            maxLength={40}
          />
        </Field>
        <Field label="مكان السكشن" className="span-2">
          <Input
            value={form.sectionRoom}
            onChange={change('sectionRoom')}
            placeholder="مثال: قاعة 204 - مبنى الهندسة"
            maxLength={60}
          />
        </Field>
      </div>

      <div className="form-actions">
        <Link to={`/ta/courses/${course.id}`} className="btn btn-ghost btn-sm">فتح المادة</Link>
        <Button type="submit" icon={Save} loading={saving}>حفظ الموعد</Button>
      </div>
    </form>
  );
}

export default function TaSchedule() {
  const { data, loading, error, reload } = useFetch('/courses');
  const courses = (data?.courses || []).filter((course) => course.myTa);
  const filled = courses.filter((course) => course.myTa?.sectionDay || course.myTa?.sectionTime || course.myTa?.sectionRoom);

  if (loading) return <FullLoader label="جارٍ تحميل مواعيد السكاشن..." />;

  return (
    <div className="page">
      <PageHead
        eyebrow="مواعيد السكاشن"
        title="جدول سكاشني"
        subtitle="حدّث يوم ووقت ومكان سكشن كل مادة. يصل إشعار فوري لكل طالب في شاتك عند حفظ أي تغيير."
        actions={<Link to="/ta/requests" className="btn btn-secondary btn-sm"><Users size={15} /> طلبات الانضمام</Link>}
      />

      <div className="grid grid-3">
        <StatCard icon={BookOpen} label="المواد" value={courses.length} tone="blue" />
        <StatCard icon={CalendarClock} label="مواعيد محددة" value={filled.length} tone="teal" />
        <StatCard icon={Clock} label="مواعيد ناقصة" value={courses.length - filled.length} tone="amber" />
      </div>

      {error ? (
        <EmptyState icon={CalendarClock} title="تعذر تحميل المواد" text={error} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="لا توجد مواد مسندة إليك"
          text="عند إضافتك كمعيد في مادة ستتمكن من تحديد موعد سكشنك من هنا."
        />
      ) : (
        <>
          <div className="notice">
            <MapPin size={17} />
            <span>موعد السكشن يظهر للطلاب في صفحة المادة، ويُستخدم في توجيه طلبات الانضمام لشاتك.</span>
          </div>
          <div className="auto-grid-wide">
            {courses.map((course) => (
              <ScheduleForm key={course.id} course={course} onSaved={() => reload({ silent: true })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
