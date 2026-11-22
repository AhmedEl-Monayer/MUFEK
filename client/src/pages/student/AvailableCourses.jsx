import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Compass, Plus, Search, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import CourseCard from '../../components/CourseCard.jsx';
import {
  Button, ConfirmModal, EmptyState, FullLoader, PageHead, SearchInput, StatCard
} from '../../components/ui.jsx';

export default function AvailableCourses() {
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const courses = data?.courses || [];

  const visible = useMemo(() => courses.filter((course) => {
    if (filter === 'joined' && !course.joined) return false;
    if (filter === 'available' && course.joined) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [course.name, course.code, course.description, course.doctorName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [courses, filter, query]);

  if (loading) return <FullLoader label="جارٍ تحميل المواد المتاحة..." />;

  const joinedCount = courses.filter((course) => course.joined).length;

  const join = async (course) => {
    setBusyId(course.id);
    try {
      const result = await api(`/courses/${course.id}/join`, { method: 'POST' });
      push(result.message || 'تم الاشتراك في المادة');
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

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

  return (
    <div className="page">
      <PageHead
        eyebrow="دليل المواد"
        title="المواد المتاحة"
        subtitle="استعرض كل مواد كلية الهندسة، واشترك في المواد التي تدرسها هذا الفصل."
        actions={<Link to="/student/my-courses" className="btn btn-secondary btn-sm"><BookOpen size={15} /> موادي</Link>}
      />

      <div className="grid grid-3">
        <StatCard icon={Compass} label="كل المواد" value={courses.length} tone="blue" />
        <StatCard icon={CheckCircle2} label="مواد مشترك بها" value={joinedCount} tone="emerald" />
        <StatCard icon={Users} label="متاحة للاشتراك" value={courses.length - joinedCount} tone="amber" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل ({courses.length})</button>
            <button className={`chip ${filter === 'joined' ? 'active' : ''}`} onClick={() => setFilter('joined')}>مشترك بها ({joinedCount})</button>
            <button className={`chip ${filter === 'available' ? 'active' : ''}`} onClick={() => setFilter('available')}>متاحة ({courses.length - joinedCount})</button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم المادة أو الدكتور..." />
        </div>
      </div>

      {error ? (
        <EmptyState icon={BookOpen} title="تعذر تحميل المواد" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد مواد مطابقة"
          text="جرّب تغيير عوامل التصفية أو كلمة البحث."
        />
      ) : (
        <div className="auto-grid">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/student/courses/${course.id}`}
              showJoinState
              action={(
                <div className="row gap-6">
                  {course.joined ? (
                    <Link to={`/student/courses/${course.id}`} className="btn btn-soft btn-sm">
                      <BookOpen size={14} /> فتح
                    </Link>
                  ) : null}
                  {course.joined ? (
                    <Button size="sm" variant="danger" onClick={() => setLeaveTarget(course)}>إلغاء</Button>
                  ) : (
                    <Button
                      size="sm"
                      icon={Plus}
                      loading={busyId === course.id}
                      onClick={() => join(course)}
                    >
                      اشتراك
                    </Button>
                  )}
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
