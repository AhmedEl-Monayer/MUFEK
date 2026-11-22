import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CalendarClock, ClipboardList, FileCheck2, GraduationCap,
  MessagesSquare, Plus, Sparkles, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, statusMeta, timeLeft } from '../../lib/format.js';
import CourseCard from '../../components/CourseCard.jsx';
import {
  Badge, Button, Card, EmptyState, FullLoader, PageHead, SectionTitle, StatCard
} from '../../components/ui.jsx';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch('/dashboard');

  if (loading) return <FullLoader label="جارٍ تجهيز مساحة الدكتور..." />;

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState icon={BookOpen} title="تعذر تحميل لوحة التحكم" text={error || 'حدث خطأ غير متوقع.'} />
      </div>
    );
  }

  const stats = data.stats || {};
  const courses = (data.courses || []).map((course) => ({
    ...course,
    studentsCount: course.students_count,
    tasCount: course.tas_count,
    assignmentsCount: course.assignments_count,
    doctorName: user.fullName
  }));
  const recentSubmissions = data.recentSubmissions || [];
  const upcoming = data.upcoming || [];

  return (
    <div className="page">
      <PageHead
        eyebrow="مساحة الدكتور"
        title={`أهلاً، ${user.fullName}`}
        subtitle="تابع موادك ومعيديك وتسليمات الطلاب، وابدأ محادثات المواد من هنا."
        actions={(
          <>
            <Link to="/doctor/courses/new" className="btn btn-secondary btn-sm"><Plus size={15} /> مادة جديدة</Link>
            <Link to="/doctor/assignments" className="btn btn-primary btn-sm"><ClipboardList size={15} /> التكليفات</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={BookOpen} label="موادي" value={stats.courses} tone="blue" hint="مواد مسؤول عنها" />
        <StatCard icon={GraduationCap} label="الطلاب" value={stats.students} tone="teal" hint="في كل المواد" />
        <StatCard icon={Users} label="المعيدون" value={stats.tas} tone="violet" hint="فريق المواد" />
        <StatCard icon={FileCheck2} label="بانتظار المراجعة" value={stats.pendingSubmissions} tone="rose" hint={`${stats.assignments || 0} تكليف نشط`} />
      </div>

      <div className="assignment-body-grid">
        <div className="col gap-16">
          <Card>
            <SectionTitle
              title="موادي"
              subtitle="افتح أي مادة لإدارة المعيدين والطلاب والتكليفات."
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/doctor/courses')}>كل المواد</Button>}
            />
            <div className="auto-grid" style={{ marginTop: 14 }}>
              {courses.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="لم تنشئ مواد بعد"
                  text="أنشئ أول مادة لتبدأ إضافة المعيدين والطلاب والتكليفات."
                  action={<Link to="/doctor/courses/new" className="btn btn-primary btn-sm"><Plus size={14} /> إنشاء مادة</Link>}
                />
              ) : courses.slice(0, 4).map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  href={`/doctor/courses/${course.id}`}
                  action={<Link to={`/doctor/courses/${course.id}`} className="btn btn-soft btn-sm"><BookOpen size={14} /> إدارة</Link>}
                />
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="أحدث التسليمات" subtitle="آخر تسليمات الطلاب في كل موادك." />
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>التكليف</th>
                    <th>المادة</th>
                    <th>الحالة</th>
                    <th>الوقت</th>
                    <th style={{ textAlign: 'end' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((item) => {
                    const meta = statusMeta(item.status);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="user-cell">
                            <span className="stat-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
                              <GraduationCap size={15} />
                            </span>
                            <strong>{item.student_name}</strong>
                          </div>
                        </td>
                        <td className="small">{item.assignment_title}</td>
                        <td className="small">{item.course_name}</td>
                        <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                        <td className="small">{fmtDateTime(item.submitted_at)}</td>
                        <td>
                          <div className="table-actions">
                            <Link to={`/assignment/${item.assignment_id}`} className="btn btn-soft btn-sm">مراجعة</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {recentSubmissions.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState compact icon={FileCheck2} title="لا توجد تسليمات" text="ستظهر هنا تسليمات طلابك فور وصولها." /></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="col gap-16">
          <Card>
            <SectionTitle title="مواعيد قادمة" subtitle="أقرب تكليفات موادك." />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              {upcoming.length === 0 ? (
                <EmptyState compact icon={CalendarClock} title="لا توجد مواعيد قادمة" text="ستظهر هنا التكليفات النشطة القادمة." />
              ) : upcoming.map((item) => {
                const due = timeLeft(item.due_at);
                return (
                  <Link key={item.id} to={`/assignment/${item.id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="stat-icon tone-amber" style={{ width: 38, height: 38, borderRadius: 11 }}>
                      <ClipboardList size={17} />
                    </span>
                    <div className="chat-list-body">
                      <strong>{item.title}</strong>
                      <small>{item.course_name} · {item.submitted_count} تسليم</small>
                    </div>
                    <span className={`due-chip ${due?.expired ? 'urgent' : due && due.days < 1 ? 'urgent' : due && due.days < 3 ? 'soon' : ''}`}>
                      {due?.expired ? 'انتهى' : due?.text}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle title="اختصارات" />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              <Link to="/doctor/courses/new" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><Sparkles size={15} /> إنشاء مادة جديدة</span><ArrowLeft size={14} />
              </Link>
              <Link to="/doctor/submissions" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><FileCheck2 size={15} /> مراجعة التسليمات</span><ArrowLeft size={14} />
              </Link>
              <Link to="/chats" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><MessagesSquare size={15} /> كل المحادثات</span><ArrowLeft size={14} />
              </Link>
              <Link to="/notifications" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><Sparkles size={15} /> الإشعارات</span><ArrowLeft size={14} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
