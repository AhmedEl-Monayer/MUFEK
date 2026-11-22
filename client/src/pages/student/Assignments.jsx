import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock, FileCheck2, Search } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import AssignmentCard from '../../components/AssignmentCard.jsx';
import {
  EmptyState, FullLoader, PageHead, SearchInput, Select, StatCard
} from '../../components/ui.jsx';

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'لم يتم الحل' },
  { id: 'submitted', label: 'تم التسليم' },
  { id: 'graded', label: 'تم التصحيح' },
  { id: 'expired', label: 'انتهى الوقت' }
];

export default function StudentAssignments() {
  const { data, loading, error } = useFetch('/assignments');
  const { data: coursesData } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('all');

  const assignments = data?.assignments || [];
  const courses = (coursesData?.courses || []).filter((course) => course.joined);

  const visible = useMemo(() => assignments.filter((item) => {
    if (courseId && item.courseId !== Number(courseId)) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.title, item.courseName, item.taName, item.creatorName, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [assignments, courseId, status, query]);

  if (loading) return <FullLoader label="جارٍ تحميل تكليفاتك..." />;

  const counts = {
    pending: assignments.filter((item) => item.status === 'pending').length,
    submitted: assignments.filter((item) => item.status === 'submitted' || item.status === 'reviewed').length,
    graded: assignments.filter((item) => item.status === 'graded').length,
    expired: assignments.filter((item) => item.status === 'expired').length
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="المتابعة الأكاديمية"
        title="التكليفات"
        subtitle="كل تكليفات موادك في مكان واحد، مرتبة حسب موعد التسليم مع حالة كل تكليف."
      />

      <div className="grid grid-4">
        <StatCard icon={ClipboardList} label="كل التكليفات" value={assignments.length} tone="blue" />
        <StatCard icon={Clock} label="بانتظار الحل" value={counts.pending} tone="amber" />
        <StatCard icon={FileCheck2} label="تم تسليمها" value={counts.submitted} tone="teal" />
        <StatCard icon={CheckCircle2} label="تم تصحيحها" value={counts.graded} tone="emerald" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                className={`chip ${status === item.id ? 'active' : ''}`}
                onClick={() => setStatus(item.id)}
              >
                {item.label}
                {item.id !== 'all' ? ` (${counts[item.id] ?? 0})` : ` (${assignments.length})`}
              </button>
            ))}
          </div>
          <div className="filters">
            <SearchInput value={query} onChange={setQuery} placeholder="ابحث بعنوان التكليف..." />
            <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">كل المواد</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState icon={ClipboardList} title="تعذر تحميل التكليفات" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد تكليفات مطابقة"
          text="جرّب تغيير عوامل التصفية أو كلمة البحث. تظهر هنا تكليفات المواد المشترك بها فقط."
        />
      ) : (
        <div className="auto-grid-wide">
          {visible.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
