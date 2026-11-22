import { Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, ClipboardCheck, FileCheck2, FolderKanban, GraduationCap,
  MessagesSquare, ShieldCheck, UserPlus, Users
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, roleLabel, statusMeta } from '../../lib/format.js';
import {
  Avatar, Badge, EmptyState, FullLoader, PageHead, SectionTitle, StatCard
} from '../../components/ui.jsx';

export default function AdminDashboard() {
  const { data, loading, error } = useFetch('/admin/stats');

  if (loading) return <FullLoader label="جارٍ تحميل إحصائيات المنصة..." />;

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState icon={ShieldCheck} title="تعذر تحميل لوحة التحكم" text={error || 'حدث خطأ غير متوقع.'} />
      </div>
    );
  }

  const stats = data.stats || {};
  const recentUsers = data.recentUsers || [];
  const recentSubmissions = data.recentSubmissions || [];
  const topCourses = data.topCourses || [];

  return (
    <div className="page">
      <PageHead
        eyebrow="لوحة المطور"
        title="إدارة المنصة"
        subtitle="نظرة شاملة على الحسابات والمواد والتكليفات والنشاط الحي داخل منصة كلية الهندسة."
        actions={(
          <>
            <Link to="/admin/users/new" className="btn btn-primary btn-sm"><UserPlus size={15} /> إنشاء حساب</Link>
            <Link to="/admin/settings" className="btn btn-secondary btn-sm"><ShieldCheck size={15} /> الإعدادات</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={Users} label="المستخدمون" value={stats.users} tone="blue" hint={`${stats.activeUsers} حساب نشط`} />
        <StatCard icon={GraduationCap} label="الطلاب" value={stats.students} tone="teal" hint="حساب طالب" />
        <StatCard icon={BookOpen} label="الدكاترة" value={stats.doctors} tone="violet" hint="عضو هيئة تدريس" />
        <StatCard icon={Users} label="المعيدون" value={stats.tas} tone="amber" hint="هيئة معاونة" />
      </div>

      <div className="grid grid-4">
        <StatCard icon={FolderKanban} label="المواد" value={stats.courses} tone="blue" hint={`${stats.activeCourses} مادة نشطة`} />
        <StatCard icon={ClipboardCheck} label="التكليفات" value={stats.assignments} tone="amber" hint="نشطة حالياً" />
        <StatCard icon={FileCheck2} label="التسليمات" value={stats.submissions} tone="emerald" hint="سجل دائم" />
        <StatCard icon={MessagesSquare} label="الرسائل" value={stats.messages} tone="rose" hint={`${stats.pendingRequests} طلب انضمام معلق`} />
      </div>

      <div className="assignment-body-grid">
        <div className="col gap-16">
          <div className="glass card">
            <SectionTitle
              title="أحدث الحسابات"
              subtitle="آخر الحسابات التي تم إنشاؤها على المنصة."
              action={<Link to="/admin/users" className="btn btn-ghost btn-sm">إدارة المستخدمين <ArrowLeft size={14} /></Link>}
            />
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>النوع</th>
                    <th>الرقم القومي</th>
                    <th>تاريخ الإنشاء</th>
                    <th style={{ textAlign: 'end' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <Avatar name={user.fullName} src={user.avatar} size={32} />
                          <div>
                            <strong>{user.fullName}</strong>
                            <small>@{user.username}</small>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="primary">{roleLabel(user.role)}</Badge></td>
                      <td className="small">{user.nationalIdMasked || '—'}</td>
                      <td className="small">{fmtDateTime(user.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/admin/users?q=${encodeURIComponent(user.username)}`} className="btn btn-soft btn-sm">فتح</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recentUsers.length === 0 ? (
                    <tr><td colSpan={5}><EmptyState compact icon={Users} title="لا توجد حسابات" text="ابدأ بإنشاء أول حساب للدكتور أو المعيد." /></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass card">
            <SectionTitle
              title="أحدث التسليمات"
              subtitle="آخر ما سلّمه الطلاب عبر كل المواد."
              action={<Link to="/admin/assignments" className="btn btn-ghost btn-sm">كل التكليفات <ArrowLeft size={14} /></Link>}
            />
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>التكليف</th>
                    <th>المادة</th>
                    <th>الحالة</th>
                    <th>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((item) => {
                    const meta = statusMeta(item.status);
                    return (
                      <tr key={item.id}>
                        <td><strong className="small">{item.student_name}</strong></td>
                        <td className="small">{item.assignment_title}</td>
                        <td className="small">{item.course_name}</td>
                        <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                        <td className="small">{fmtDateTime(item.submitted_at)}</td>
                      </tr>
                    );
                  })}
                  {recentSubmissions.length === 0 ? (
                    <tr><td colSpan={5}><EmptyState compact icon={FileCheck2} title="لا توجد تسليمات" text="ستظهر هنا تسليمات الطلاب فور وصولها." /></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col gap-16">
          <div className="glass card">
            <SectionTitle title="المواد الأكثر اشتراكاً" subtitle="أعلى المواد بعدد الطلاب." />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              {topCourses.map((course) => (
                <Link key={course.id} to={`/admin/courses/${course.id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="stat-icon tone-blue" style={{ width: 38, height: 38, borderRadius: 11 }}>
                    <BookOpen size={17} />
                  </span>
                  <div className="chat-list-body">
                    <strong>{course.name}</strong>
                    <small>{course.code || 'بدون كود'} · {course.students_count} طالب · {course.assignments_count} تكليف</small>
                  </div>
                  <ArrowLeft size={14} className="muted" />
                </Link>
              ))}
              {topCourses.length === 0 ? (
                <EmptyState compact icon={BookOpen} title="لا توجد مواد" text="ستظهر المواد هنا بعد إنشائها بواسطة الدكاترة." />
              ) : null}
            </div>
          </div>

          <div className="glass card">
            <SectionTitle title="اختصارات الإدارة" />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              <Link to="/admin/users/new" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><UserPlus size={15} /> إنشاء حساب جديد</span><ArrowLeft size={14} />
              </Link>
              <Link to="/admin/users" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><Users size={15} /> إدارة المستخدمين</span><ArrowLeft size={14} />
              </Link>
              <Link to="/admin/courses" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><FolderKanban size={15} /> إدارة المواد</span><ArrowLeft size={14} />
              </Link>
              <Link to="/admin/roles" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><ShieldCheck size={15} /> الصلاحيات</span><ArrowLeft size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
