import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, FileCheck2, FileText, Search, Users } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime } from '../../lib/format.js';
import { Badge, EmptyState, FullLoader, PageHead, SearchInput, Select, StatCard } from '../../components/ui.jsx';

export default function StaffSubmissions() {
  const { data, loading } = useFetch('/assignments');
  const { data: coursesData } = useFetch('/courses');
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');

  const assignments = data?.assignments || [];
  const courses = coursesData?.courses || [];

  const visible = useMemo(() => assignments.filter((item) => {
    if (courseId && item.courseId !== Number(courseId)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.title, item.courseName, item.taName].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  }), [assignments, courseId, query]);

  if (loading) return <FullLoader label="جارٍ تحميل التسليمات..." />;

  const totals = assignments.reduce((acc, item) => ({
    submitted: acc.submitted + (item.submissionsCount || 0),
    graded: acc.graded + (item.gradedCount || 0)
  }), { submitted: 0, graded: 0 });
  const pending = totals.submitted - totals.graded;

  return (
    <div className="page">
      <PageHead
        eyebrow="التسليمات"
        title="مراجعة تسليمات الطلاب"
        subtitle="افتح أي تكليف لمراجعة ملفات الطلاب وتسجيل الدرجات والملاحظات."
      />

      <div className="grid grid-3">
        <StatCard icon={FileCheck2} label="إجمالي التسليمات" value={totals.submitted} tone="blue" />
        <StatCard icon={ClipboardCheck} label="بانتظار المراجعة" value={pending} tone="amber" />
        <StatCard icon={CheckCircle2} label="تم تصحيحها" value={totals.graded} tone="emerald" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث في التكليفات..." />
          <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">كل المواد</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </Select>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th>التكليف</th>
                <th>المادة</th>
                <th>النطاق</th>
                <th>موعد التسليم</th>
                <th>التسليمات</th>
                <th>التصحيح</th>
                <th style={{ textAlign: 'end' }}>الإجراء</th>
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
                        <span className="stat-icon tone-blue" style={{ width: 34, height: 34, borderRadius: 10 }}><FileText size={16} /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.taName ? `معيد: ${item.taName}` : 'تكليف عام'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="small">{item.courseName}</td>
                    <td><Badge tone={item.scope === 'ta' ? 'accent' : 'primary'}>{item.scope === 'ta' ? 'خاص بالمعيد' : 'عام'}</Badge></td>
                    <td className="small">{fmtDateTime(item.dueAt)}</td>
                    <td><Badge tone={submitted ? 'info' : 'neutral'} icon={Users}>{submitted}</Badge></td>
                    <td>
                      <Badge tone={submitted === 0 ? 'neutral' : graded === submitted ? 'success' : 'warning'}>
                        {graded} / {submitted}
                      </Badge>
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
              {visible.length === 0 ? (
                <tr><td colSpan={7}><EmptyState compact icon={Search} title="لا توجد تكليفات" text="لم يتم العثور على تكليفات مطابقة لعوامل التصفية." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notice">
        <ClipboardCheck size={17} />
        <span>تُحفظ جميع الدرجات والملاحظات في سجل دائم، ويصل إشعار للطالب فور اعتماد التصحيح.</span>
      </div>
    </div>
  );
}
