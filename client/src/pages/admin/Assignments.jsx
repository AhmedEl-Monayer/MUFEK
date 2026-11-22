import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, CheckCircle2, ClipboardCheck, ClipboardList, FileCheck2, Plus, Search, Users
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, roleLabel, statusMeta } from '../../lib/format.js';
import AssignmentCard from '../../components/AssignmentCard.jsx';
import CreateAssignmentModal from '../../components/CreateAssignmentModal.jsx';
import {
  Badge, Button, EmptyState, FullLoader, PageHead, SearchInput, Select, StatCard
} from '../../components/ui.jsx';

export default function AdminAssignments() {
  const { data, loading, error, reload } = useFetch('/assignments?archived=1');
  const { data: coursesData } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [filter, setFilter] = useState('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState('table');

  const assignments = data?.assignments || [];
  const courses = coursesData?.courses || [];

  const visible = useMemo(() => assignments.filter((item) => {
    if (filter === 'active' && !item.isActive) return false;
    if (filter === 'archived' && item.isActive) return false;
    if (courseId && item.courseId !== Number(courseId)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.title, item.courseName, item.taName, item.creatorName, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [assignments, filter, courseId, query]);

  if (loading) return <FullLoader label="جارٍ تحميل التكليفات..." />;

  const totals = assignments.reduce((acc, item) => ({
    submissions: acc.submissions + (item.submissionsCount || 0),
    graded: acc.graded + (item.gradedCount || 0)
  }), { submissions: 0, graded: 0 });

  return (
    <div className="page">
      <PageHead
        eyebrow="إشراف عام"
        title="كل التكليفات"
        subtitle="راجع التكليفات النشطة والمؤرشفة في كل المواد، وافتح أي تكليف لمراجعة تسليماته."
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>نشر تكليف</Button>}
      />

      <div className="grid grid-4">
        <StatCard icon={ClipboardList} label="كل التكليفات" value={assignments.length} tone="blue" />
        <StatCard icon={CheckCircle2} label="نشطة" value={assignments.filter((item) => item.isActive).length} tone="emerald" />
        <StatCard icon={FileCheck2} label="التسليمات" value={totals.submissions} tone="amber" />
        <StatCard icon={ClipboardCheck} label="تم تصحيحها" value={totals.graded} tone="violet" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>نشطة</button>
            <button className={`chip ${filter === 'archived' ? 'active' : ''}`} onClick={() => setFilter('archived')}>مؤرشفة</button>
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل</button>
          </div>
          <div className="filters">
            <SearchInput value={query} onChange={setQuery} placeholder="ابحث بعنوان التكليف..." />
            <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">كل المواد</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </Select>
            <div className="chip-tabs">
              <button className={`chip ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>جدول</button>
              <button className={`chip ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>بطاقات</button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState icon={ClipboardList} title="تعذر تحميل التكليفات" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={assignments.length === 0 ? ClipboardList : Search}
          title={assignments.length === 0 ? 'لا توجد تكليفات' : 'لا توجد تكليفات مطابقة'}
          text={assignments.length === 0
            ? 'لم ينشر أي دكتور أو معيد تكليفاً بعد.'
            : 'جرّب تغيير عامل التصفية أو كلمة البحث.'}
        />
      ) : view === 'cards' ? (
        <div className="auto-grid-wide">
          {visible.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} />
          ))}
        </div>
      ) : (
        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التكليف</th>
                  <th>المادة</th>
                  <th>النطاق</th>
                  <th>الناشر</th>
                  <th>موعد التسليم</th>
                  <th>التسليمات</th>
                  <th>الحالة</th>
                  <th style={{ textAlign: 'end' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const submitted = item.submissionsCount || 0;
                  const graded = item.gradedCount || 0;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="user-cell">
                          <span className="stat-icon tone-amber" style={{ width: 34, height: 34, borderRadius: 10 }}>
                            <ClipboardList size={16} />
                          </span>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{fmtDateTime(item.createdAt)}</small>
                          </div>
                        </div>
                      </td>
                      <td className="small">{item.courseName}</td>
                      <td>
                        <Badge tone={item.scope === 'ta' ? 'accent' : 'primary'}>
                          {item.scope === 'ta' ? `خاص بالمعيد${item.taName ? `: ${item.taName}` : ''}` : 'عام'}
                        </Badge>
                      </td>
                      <td className="small">
                        {item.creatorName}
                        <span className="tiny muted"> · {roleLabel(item.creatorRole)}</span>
                      </td>
                      <td className="small">{fmtDateTime(item.dueAt)}</td>
                      <td>
                        <Badge tone={submitted === 0 ? 'neutral' : graded === submitted ? 'success' : 'warning'} icon={Users}>
                          {graded} / {submitted}
                        </Badge>
                      </td>
                      <td>
                        {item.isActive
                          ? <Badge tone="success">نشط</Badge>
                          : <Badge tone="neutral" icon={Archive}>مؤرشف</Badge>}
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/assignment/${item.id}`} className="btn btn-soft btn-sm">
                            <Search size={14} /> مراجعة
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
