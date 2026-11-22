import { useMemo, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import AssignmentCard from '../../components/AssignmentCard.jsx';
import CreateAssignmentModal from '../../components/CreateAssignmentModal.jsx';
import { Button, EmptyState, FullLoader, PageHead, SearchInput, Select } from '../../components/ui.jsx';

export default function StaffAssignments() {
  const { data, loading, reload } = useFetch('/assignments');
  const { data: coursesData } = useFetch('/courses');
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');

  const assignments = data?.assignments || [];
  const courses = coursesData?.courses || [];

  const visible = useMemo(() => assignments.filter((item) => {
    if (courseId && item.courseId !== Number(courseId)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.title, item.courseName, item.taName, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [assignments, courseId, query]);

  if (loading) return <FullLoader label="جارٍ تحميل التكليفات..." />;

  const pending = assignments.reduce((sum, item) => sum + ((item.submissionsCount || 0) - (item.gradedCount || 0)), 0);

  return (
    <div className="page">
      <PageHead
        eyebrow="المتابعة الأكاديمية"
        title="التكليفات"
        subtitle={`تابع كل تكليفات موادك، وأنشئ تكليفاً عاماً أو خاصاً بشات معيد. ${pending > 0 ? `لديك ${pending} تسليم بانتظار المراجعة.` : ''}`}
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>نشر تكليف جديد</Button>}
      />

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث بعنوان التكليف أو المادة..." />
          <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">كل المواد</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </Select>
          <span className="pill"><ClipboardList size={13} /> {visible.length} تكليف</span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد تكليفات مطابقة"
          text="جرّب تغيير عوامل التصفية أو أنشئ تكليفاً جديداً لطلابك."
          action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>نشر تكليف جديد</Button>}
        />
      ) : (
        <div className="auto-grid-wide">
          {visible.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} />
          ))}
        </div>
      )}

      <CreateAssignmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => reload({ silent: true })}
      />
    </div>
  );
}
