import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CalendarClock, ClipboardList, MapPin, Search, Users
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, EmptyState, FullLoader, PageHead, SearchInput, StatCard } from '../../components/ui.jsx';

export default function TaCourses() {
  const { data, loading, error } = useFetch('/courses');
  const { data: dash } = useFetch('/dashboard');
  const [query, setQuery] = useState('');

  const courses = data?.courses || [];
  const extra = useMemo(
    () => new Map((dash?.courses || []).map((course) => [course.id, course])),
    [dash]
  );

  const visible = useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.trim().toLowerCase();
    return courses.filter((course) => [course.name, course.code, course.description, course.doctorName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [courses, query]);

  if (loading) return <FullLoader label="جارٍ تحميل موادك..." />;

  const myStudents = courses.reduce((sum, course) => sum + (extra.get(course.id)?.my_students || 0), 0);
  const pending = courses.reduce((sum, course) => sum + (extra.get(course.id)?.pending_requests || 0), 0);
  const myAssignments = courses.reduce((sum, course) => sum + (extra.get(course.id)?.my_assignments || 0), 0);

  return (
    <div className="page">
      <PageHead
        eyebrow="مساحة المعيد"
        title="موادي"
        subtitle="كل مادة تشرف عليها كمعيد، مع موعد سكشنك وطلاب شاتك وتكليفاتك المسندة."
        actions={(
          <>
            <Link to="/ta/requests" className="btn btn-secondary btn-sm"><Users size={15} /> طلبات الانضمام</Link>
            <Link to="/ta/schedule" className="btn btn-primary btn-sm"><CalendarClock size={15} /> مواعيد السكاشن</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={BookOpen} label="موادي" value={courses.length} tone="blue" hint="مواد معيد بها" />
        <StatCard icon={Users} label="طلاب شاتي" value={myStudents} tone="teal" hint="في كل السكاشن" />
        <StatCard icon={ClipboardList} label="طلبات معلقة" value={pending} tone="amber" hint="بانتظار قرارك" />
        <StatCard icon={ClipboardList} label="تكليفاتي" value={myAssignments} tone="violet" hint="مسندة إليك" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم المادة أو كودها..." />
          <span className="pill"><BookOpen size={13} /> {visible.length} مادة</span>
        </div>
      </div>

      {error ? (
        <EmptyState icon={BookOpen} title="تعذر تحميل المواد" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={courses.length === 0 ? BookOpen : Search}
          title={courses.length === 0 ? 'لم تتم إضافتك لمواد بعد' : 'لا توجد مواد مطابقة'}
          text={courses.length === 0
            ? 'سيقوم الدكتور المسؤول بإضافتك كمعيد في موادك، وستصلك رسالة فور ذلك.'
            : 'جرّب تغيير كلمة البحث.'}
        />
      ) : (
        <div className="auto-grid">
          {visible.map((course) => {
            const stats = extra.get(course.id) || {};
            const section = [stats.section_day || course.myTa?.sectionDay, stats.section_time || course.myTa?.sectionTime, stats.section_room || course.myTa?.sectionRoom]
              .filter(Boolean);
            return (
              <article key={course.id} className="glass card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="row gap-12" style={{ minWidth: 0 }}>
                    <span className="stat-icon tone-blue" style={{ width: 44, height: 44, borderRadius: 14 }}>
                      <BookOpen size={19} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15.5, fontWeight: 800 }}>{course.name}</h3>
                      <small className="muted tiny">{course.code || 'بدون كود'} · {course.doctorName || 'دكتور المادة'}</small>
                    </div>
                  </div>
                  <Badge tone={course.isActive ? 'success' : 'neutral'}>{course.isActive ? 'نشطة' : 'متوقفة'}</Badge>
                </div>

                <div className="ta-section">
                  <CalendarClock size={14} />
                  <span>{section.length ? section.join(' · ') : 'لم يتم تحديد موعد السكشن بعد'}</span>
                </div>

                <div className="course-meta">
                  <span><Users size={12} /> {stats.my_students ?? 0} طالب في شاتك</span>
                  <span><ClipboardList size={12} /> {stats.my_assignments ?? 0} تكليف</span>
                  <span><Users size={12} /> {stats.pending_requests ?? 0} طلب معلق</span>
                </div>

                <div className="course-foot">
                  <Link to={`/ta/courses/${course.id}`} className="btn btn-soft btn-sm">
                    <MapPin size={14} /> إدارة المادة
                  </Link>
                  {stats.pending_requests > 0 ? (
                    <Link to="/ta/requests" className="btn btn-ghost btn-sm">
                      {stats.pending_requests} طلب <ArrowLeft size={14} />
                    </Link>
                  ) : (
                    <Link to={`/ta/courses/${course.id}/assignments`} className="btn btn-ghost btn-sm">
                      التكليفات <ArrowLeft size={14} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
