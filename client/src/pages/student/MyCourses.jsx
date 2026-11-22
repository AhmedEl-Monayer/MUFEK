import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, Compass, Search, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import CourseCard from '../../components/CourseCard.jsx';
import {
  Button, ConfirmModal, EmptyState, FullLoader, PageHead, SearchInput, StatCard
} from '../../components/ui.jsx';

export default function MyCourses() {
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const courses = (data?.courses || []).filter((course) => course.joined);

  const visible = useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.trim().toLowerCase();
    return courses.filter((course) => [course.name, course.code, course.doctorName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [courses, query]);

  if (loading) return <FullLoader label="جارٍ تحميل موادك..." />;

  const leave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      const result = await api(`/courses/${leaveTarget.id}/join`, { method: 'DELETE' });
      push(result.message || 'تم إلغاء الاشتراك');
      setLeaveTarget(null);
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setLeaving(false);
    }
  };

  const totalTas = courses.reduce((sum, course) => sum + (course.tasCount || 0), 0);
  const totalAssignments = courses.reduce((sum, course) => sum + (course.assignmentsCount || 0), 0);

  return (
    <div className="page">
      <PageHead
        eyebrow="مساحتي الأكاديمية"
        title="موادي"
        subtitle="كل المواد التي اشتركت بها، مع الوصول السريع للشات العام والتكليفات والسكاشن."
        actions={<Link to="/student/courses" className="btn btn-secondary btn-sm"><Compass size={15} /> المواد المتاحة</Link>}
      />

      <div className="grid grid-3">
        <StatCard icon={BookOpen} label="المواد" value={courses.length} tone="blue" />
        <StatCard icon={Users} label="المعيدون" value={totalTas} tone="violet" />
        <StatCard icon={ClipboardList} label="التكليفات" value={totalAssignments} tone="amber" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث في موادك..." />
          <span className="pill"><BookOpen size={13} /> {visible.length} مادة</span>
        </div>
      </div>

      {error ? (
        <EmptyState icon={BookOpen} title="تعذر تحميل المواد" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={courses.length === 0 ? Compass : Search}
          title={courses.length === 0 ? 'لم تشترك في أي مادة بعد' : 'لا توجد مواد مطابقة'}
          text={courses.length === 0
            ? 'ابدأ باستعراض المواد المتاحة واختر المواد التي تدرسها هذا الفصل.'
            : 'جرّب تغيير كلمة البحث.'}
          action={courses.length === 0 ? <Link to="/student/courses" className="btn btn-primary btn-sm"><Compass size={14} /> استعراض المواد</Link> : null}
        />
      ) : (
        <div className="auto-grid">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/student/courses/${course.id}`}
              action={(
                <div className="row gap-6">
                  <Link to={`/student/courses/${course.id}`} className="btn btn-soft btn-sm">
                    <BookOpen size={14} /> فتح
                  </Link>
                  <Button size="sm" variant="danger" onClick={() => setLeaveTarget(course)}>إلغاء</Button>
                </div>
              )}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(leaveTarget)}
        onClose={() => setLeaveTarget(null)}
        onConfirm={leave}
        loading={leaving}
        title="إلغاء الاشتراك في المادة"
        message={`سيتم إلغاء اشتراكك في مادة ${leaveTarget?.name || ''} وإلغاء طلبات شات المعيد المرتبطة بها. هل تريد المتابعة؟`}
        confirmLabel="إلغاء الاشتراك"
      />
    </div>
  );
}
