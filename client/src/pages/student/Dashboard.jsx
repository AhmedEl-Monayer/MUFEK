import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Compass,
  FileCheck2, MessagesSquare, Sparkles, TrendingUp, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, statusMeta, timeLeft } from '../../lib/format.js';
import {
  Badge, Button, Card, EmptyState, FullLoader, PageHead, SectionTitle, StatCard
} from '../../components/ui.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 18) return 'مساء الخير';
  return 'مساء الخير';
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch('/dashboard');

  if (loading) return <FullLoader label="جارٍ تجهيز لوحة التحكم..." />;

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          icon={BookOpen}
          title="تعذر تحميل لوحة التحكم"
          text={error || 'حدث خطأ غير متوقع، حاول تحديث الصفحة.'}
        />
      </div>
    );
  }

  const stats = data.stats || {};
  const courses = data.courses || [];
  const upcoming = data.upcoming || [];
  const recentSubmissions = data.recentSubmissions || [];

  return (
    <div className="page">
      <PageHead
        eyebrow="لوحة الطالب"
        title={`${greeting()}، ${user.fullName.split(' ')[0]}`}
        subtitle="تابع موادك وتكليفاتك القادمة، وافتح محادثاتك الأكاديمية من مكان واحد."
        actions={(
          <>
            <Link to="/student/courses" className="btn btn-secondary btn-sm"><Compass size={15} /> استعراض المواد</Link>
            <Link to="/student/assignments" className="btn btn-primary btn-sm"><ClipboardList size={15} /> التكليفات</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={BookOpen} label="موادي" value={stats.courses} tone="blue" hint="مواد مشترك بها" />
        <StatCard icon={CalendarClock} label="تكليفات قادمة" value={stats.pending} tone="amber" hint="لم يتم تسليمها" />
        <StatCard icon={FileCheck2} label="تسليماتي" value={stats.submitted} tone="teal" hint="إجمالي التسليمات" />
        <StatCard icon={TrendingUp} label="المتوسط" value={stats.average == null ? '—' : `${stats.average}`} tone="emerald" hint={`${stats.graded || 0} تم تصحيحها`} />
      </div>

      <div className="assignment-body-grid">
        <div className="col gap-16">
          <Card>
            <SectionTitle
              title="تكليفات تقترب من موعدها"
              subtitle="الأقرب تسليماً أولاً. لا تفوّت الموعد النهائي."
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/student/assignments')}>عرض الكل</Button>}
            />
            <div className="col gap-8" style={{ marginTop: 14 }}>
              {upcoming.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="لا توجد تكليفات معلقة"
                  text="أنت متابع جيد! ستظهر هنا التكليفات القادمة التي لم تسلّمها بعد."
                />
              ) : upcoming.map((item) => {
                const due = timeLeft(item.due_at);
                return (
                  <Link key={item.id} to={`/assignment/${item.id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="stat-icon tone-amber" style={{ width: 40, height: 40, borderRadius: 12 }}>
                      <ClipboardList size={18} />
                    </span>
                    <div className="chat-list-body">
                      <strong>{item.title}</strong>
                      <small>{item.course_name}{item.ta_name ? ` · معيد: ${item.ta_name}` : ''}</small>
                      <small className="tiny muted" style={{ marginTop: 3 }}>
                        <CalendarClock size={11} style={{ verticalAlign: '-1px', marginInlineEnd: 3 }} />
                        التسليم: {fmtDateTime(item.due_at)}
                      </small>
                    </div>
                    <span className={`due-chip ${due?.expired ? 'urgent' : due && due.days < 1 ? 'urgent' : due && due.days < 3 ? 'soon' : ''}`}>
                      {due?.expired ? 'انتهى' : `متبقي ${due?.text || '—'}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="موادي"
              subtitle="افتح المادة لمتابعة الشات العام والتكليفات والسكاشن."
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/student/my-courses')}>كل المواد</Button>}
            />
            <div className="col gap-8" style={{ marginTop: 14 }}>
              {courses.length === 0 ? (
                <EmptyState
                  compact
                  icon={Compass}
                  title="لم تشترك في أي مادة بعد"
                  text="استعرض المواد المتاحة واشترك في موادك لتبدأ متابعة المحتوى."
                  action={<Link to="/student/courses" className="btn btn-primary btn-sm"><Compass size={14} /> استعراض المواد</Link>}
                />
              ) : courses.slice(0, 4).map((course) => (
                <Link key={course.id} to={`/student/courses/${course.id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="stat-icon tone-blue" style={{ width: 40, height: 40, borderRadius: 12 }}>
                    <BookOpen size={18} />
                  </span>
                  <div className="chat-list-body">
                    <strong>{course.name}</strong>
                    <small>{course.code || 'مادة'} · {course.doctor_name}</small>
                  </div>
                  <div className="row gap-6">
                    <Badge tone="info" icon={Users}>{course.tas_count || 0} معيد</Badge>
                    <Badge tone="neutral">{course.assignments_count || 0} تكليف</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="col gap-16">
          <Card>
            <SectionTitle title="اختصارات سريعة" />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              <Link to="/student/submissions" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><FileCheck2 size={15} /> تسليماتي ودرجاتي</span><ArrowLeft size={14} />
              </Link>
              <Link to="/chats" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><MessagesSquare size={15} /> محادثاتي</span><ArrowLeft size={14} />
              </Link>
              <Link to="/student/assignments" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><ClipboardList size={15} /> كل التكليفات</span><ArrowLeft size={14} />
              </Link>
              <Link to="/notifications" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><Sparkles size={15} /> الإشعارات</span><ArrowLeft size={14} />
              </Link>
            </div>
          </Card>

          <Card>
            <SectionTitle title="أحدث التسليمات" subtitle="آخر ما سلّمته ونتيجة المراجعة." />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              {recentSubmissions.length === 0 ? (
                <EmptyState compact icon={FileCheck2} title="لا توجد تسليمات" text="ستظهر هنا تسليماتك ودرجاتك بعد أول تسليم." />
              ) : recentSubmissions.map((item) => {
                const meta = statusMeta(item.status);
                return (
                  <Link key={item.id} to={`/assignment/${item.assignment_id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="stat-icon tone-emerald" style={{ width: 38, height: 38, borderRadius: 11 }}>
                      <FileCheck2 size={17} />
                    </span>
                    <div className="chat-list-body">
                      <strong>{item.assignment_title}</strong>
                      <small>{item.course_name} · {fmtDateTime(item.submitted_at)}</small>
                    </div>
                    <div className="col gap-6" style={{ alignItems: 'flex-end' }}>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {item.grade != null ? <span className="small strong">{item.grade}</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
