import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, ClipboardCheck, FileCheck2, FileText, Search, TrendingUp
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, statusMeta } from '../../lib/format.js';
import {
  Badge, EmptyState, FullLoader, PageHead, SearchInput, Select, StatCard
} from '../../components/ui.jsx';

export default function MySubmissions() {
  const { data, loading, error } = useFetch('/submissions/mine');
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  const submissions = data?.submissions || [];
  const courses = [...new Map(submissions.map((item) => [item.courseId, { id: item.courseId, name: item.courseName }])).values()];

  const visible = useMemo(() => submissions.filter((item) => {
    if (courseFilter && item.courseId !== Number(courseFilter)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.assignmentTitle, item.courseName, item.feedback]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [submissions, courseFilter, query]);

  if (loading) return <FullLoader label="جارٍ تحميل تسليماتك..." />;

  const graded = submissions.filter((item) => item.status === 'graded');
  const pendingReview = submissions.filter((item) => item.status === 'submitted' || item.status === 'reviewed');
  const grades = graded.map((item) => Number(item.grade)).filter((value) => Number.isFinite(value));
  const average = grades.length ? (grades.reduce((sum, value) => sum + value, 0) / grades.length) : null;

  return (
    <div className="page">
      <PageHead
        eyebrow="سجل التسليمات"
        title="تسليماتي ودرجاتي"
        subtitle="سجل دائم لكل ما سلّمته، مع حالة المراجعة والدرجة وملاحظات هيئة التدريس."
      />

      <div className="grid grid-4">
        <StatCard icon={FileCheck2} label="كل التسليمات" value={submissions.length} tone="blue" />
        <StatCard icon={ClipboardCheck} label="بانتظار المراجعة" value={pendingReview.length} tone="amber" />
        <StatCard icon={CheckCircle2} label="تم تصحيحها" value={graded.length} tone="emerald" />
        <StatCard icon={TrendingUp} label="متوسط الدرجات" value={average == null ? '—' : average.toFixed(1)} tone="violet" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث في التسليمات..." />
          <Select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
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
                <th>وقت التسليم</th>
                <th>الحالة</th>
                <th>الدرجة</th>
                <th>الملاحظات</th>
                <th style={{ textAlign: 'end' }}>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const meta = statusMeta(item.status);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="user-cell">
                        <span className="stat-icon tone-blue" style={{ width: 34, height: 34, borderRadius: 10 }}>
                          <FileText size={16} />
                        </span>
                        <div>
                          <strong>{item.assignmentTitle}</strong>
                          <small>{item.isLate ? 'تسليم متأخر' : 'تسليم في الموعد'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="small">{item.courseName}</td>
                    <td className="small">{fmtDateTime(item.submittedAt)}</td>
                    <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td className="small strong">
                      {item.grade != null ? `${item.grade}${item.maxGrade != null ? ` / ${item.maxGrade}` : ''}` : '—'}
                    </td>
                    <td className="small" style={{ maxWidth: 220 }}>
                      {item.feedback ? <span title={item.feedback}>{item.feedback.length > 60 ? `${item.feedback.slice(0, 60)}...` : item.feedback}</span> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <div className="table-actions">
                        <a className="btn btn-ghost btn-sm" href={`/api/files/submission/${item.id}`} target="_blank" rel="noreferrer">
                          <FileText size={14} /> الملف
                        </a>
                        <Link to={`/assignment/${item.assignmentId}`} className="btn btn-soft btn-sm">
                          <Search size={14} /> التفاصيل
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      compact
                      icon={FileCheck2}
                      title={submissions.length === 0 ? 'لا توجد تسليمات بعد' : 'لا توجد نتائج مطابقة'}
                      text={submissions.length === 0
                        ? 'افتح تكليفاً من صفحة التكليفات وسلّم حلك ليظهر هنا.'
                        : 'جرّب تغيير عوامل التصفية.'}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="notice danger"><Search size={17} /><span>{error}</span></div> : null}
    </div>
  );
}
