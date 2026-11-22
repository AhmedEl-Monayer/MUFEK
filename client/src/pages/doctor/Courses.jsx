import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, Plus, Search, Settings2, Users } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import CourseCard from '../../components/CourseCard.jsx';
import {
  EmptyState, FullLoader, PageHead, SearchInput, StatCard
} from '../../components/ui.jsx';

export default function DoctorCourses() {
  const { data, loading, error } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const courses = data?.courses || [];

  const visible = useMemo(() => courses.filter((course) => {
    if (filter === 'active' && !course.isActive) return false;
    if (filter === 'inactive' && course.isActive) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [course.name, course.code, course.description, course.doctorName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [courses, filter, query]);

  if (loading) return <FullLoader label="جارٍ تحميل موادك..." />;

  const totalStudents = courses.reduce((sum, course) => sum + (course.studentsCount || 0), 0);
  const totalAssignments = courses.reduce((sum, course) => sum + (course.assignmentsCount || 0), 0);

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة المواد"
        title="موادي"
        subtitle="أنشئ موادك، وأضف المعيدين والطلاب، وتابع التكليفات والتسليمات من مساحة كل مادة."
        actions={<Link to="/doctor/courses/new" className="btn btn-primary btn-sm"><Plus size={15} /> إنشاء مادة</Link>}
      />

      <div className="grid grid-4">
        <StatCard icon={BookOpen} label="المواد" value={courses.length} tone="blue" />
        <StatCard icon={Users} label="الطلاب" value={totalStudents} tone="teal" />
        <StatCard icon={ClipboardList} label="التكليفات" value={totalAssignments} tone="amber" />
        <StatCard icon={Settings2} label="مواد نشطة" value={courses.filter((course) => course.isActive).length} tone="emerald" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل ({courses.length})</button>
            <button className={`chip ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>نشطة ({courses.filter((course) => course.isActive).length})</button>
            <button className={`chip ${filter === 'inactive' ? 'active' : ''}`} onClick={() => setFilter('inactive')}>متوقفة ({courses.filter((course) => !course.isActive).length})</button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم المادة أو الكود..." />
        </div>
      </div>

      {error ? (
        <EmptyState icon={BookOpen} title="تعذر تحميل المواد" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={courses.length === 0 ? BookOpen : Search}
          title={courses.length === 0 ? 'لم تنشئ مواد بعد' : 'لا توجد مواد مطابقة'}
          text={courses.length === 0
            ? 'ابدأ بإنشاء أول مادة لك، ثم أضف المعيدين والطلاب.'
            : 'جرّب تغيير عوامل التصفية أو كلمة البحث.'}
          action={courses.length === 0 ? <Link to="/doctor/courses/new" className="btn btn-primary btn-sm"><Plus size={14} /> إنشاء مادة</Link> : null}
        />
      ) : (
        <div className="auto-grid">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/doctor/courses/${course.id}`}
              action={<Link to={`/doctor/courses/${course.id}`} className="btn btn-soft btn-sm"><Settings2 size={14} /> إدارة المادة</Link>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
