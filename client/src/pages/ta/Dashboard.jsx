import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileCheck2,
  MapPin, MessagesSquare, Users, XCircle
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, statusMeta } from '../../lib/format.js';
import {
  Avatar, Badge, Button, Card, EmptyState, FullLoader, PageHead, SectionTitle, StatCard
} from '../../components/ui.jsx';

export default function TaDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/dashboard');
  const [busyRequest, setBusyRequest] = useState(null);

  if (loading) return <FullLoader label="جارٍ تجهيز مساحة المعيد..." />;

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState icon={BookOpen} title="تعذر تحميل لوحة التحكم" text={error || 'حدث خطأ غير متوقع.'} />
      </div>
    );
  }

  const stats = data.stats || {};
  const courses = data.courses || [];
  const pendingRequests = data.pendingRequests || [];
  const recentSubmissions = data.recentSubmissions || [];

  const decide = async (item, status) => {
    setBusyRequest(item.id);
    try {
      const result = await api(`/chats/${item.chat_id}/requests/${item.id}`, {
        method: 'PATCH',
        body: { status }
      });
      push(result.message || (status === 'approved' ? 'تم قبول الطالب' : 'تم رفض الطلب'));
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyRequest(null);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="مساحة المعيد"
        title={`أهلاً، ${user.fullName}`}
        subtitle="تابع طلبات شاتك، مواعيد سكاشنك، وتكليفاتك وتسليمات طلابك."
        actions={(
          <>
            <Link to="/ta/requests" className="btn btn-secondary btn-sm"><Users size={15} /> طلبات الانضمام</Link>
            <Link to="/ta/schedule" className="btn btn-primary btn-sm"><CalendarClock size={15} /> مواعيد السكاشن</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={BookOpen} label="موادي" value={stats.courses} tone="blue" hint="مواد معيد بها" />
        <StatCard icon={Users} label="طلابي" value={stats.myStudents} tone="teal" hint="في شاتاتك" />
        <StatCard icon={ClipboardList} label="طلبات معلقة" value={stats.pendingRequests} tone="amber" hint="بانتظار قرارك" />
        <StatCard icon={FileCheck2} label="تسليمات للمراجعة" value={stats.pendingSubmissions} tone="rose" hint={`${stats.assignments || 0} تكليف مسند`} />
      </div>

      <div className="assignment-body-grid">
        <div className="col gap-16">
          <Card>
            <SectionTitle
              title="طلبات الانضمام لشاتك"
              subtitle="وافق على طلاب سكشنك فقط. قبول طالب يمنع انضمامه لشات معيد آخر."
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/ta/requests')}>عرض الكل</Button>}
            />
            <div className="col gap-8" style={{ marginTop: 14 }}>
              {pendingRequests.length === 0 ? (
                <EmptyState compact icon={CheckCircle2} title="لا توجد طلبات معلقة" text="ستظهر هنا طلبات الطلاب الجدد فور وصولها." />
              ) : pendingRequests.map((item) => (
                <div key={item.id} className="chat-list-item">
                  <Avatar name={item.student_name} src={item.avatar} size={42} />
                  <div className="chat-list-body">
                    <strong>{item.student_name}</strong>
                    <small>{item.course_name}</small>
                    <small className="tiny muted" style={{ marginTop: 3 }}>{fmtDateTime(item.created_at)}</small>
                  </div>
                  <div className="row gap-6">
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle2}
                      loading={busyRequest === item.id}
                      onClick={() => decide(item, 'approved')}
                    >
                      قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={XCircle}
                      disabled={busyRequest === item.id}
                      onClick={() => decide(item, 'rejected')}
                    >
                      رفض
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="أحدث التسليمات" subtitle="تسليمات التكليفات المسندة إليك." />
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
                            <Avatar name={item.student_name} src={item.avatar} size={30} />
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
            <SectionTitle title="موادي وسكاشني" subtitle="مواعيد سكشن كل مادة." />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              {courses.length === 0 ? (
                <EmptyState compact icon={BookOpen} title="لا توجد مواد" text="سيتم إضافتك لموادك بواسطة الدكتور." />
              ) : courses.map((course) => (
                <Link key={course.id} to={`/ta/courses/${course.id}`} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="stat-icon tone-blue" style={{ width: 38, height: 38, borderRadius: 11 }}>
                    <BookOpen size={17} />
                  </span>
                  <div className="chat-list-body">
                    <strong>{course.name}</strong>
                    <small>{[course.section_day, course.section_time, course.section_room].filter(Boolean).join(' · ') || 'لم يتم تحديد موعد السكشن'}</small>
                    <small className="tiny muted" style={{ marginTop: 3 }}>{course.my_students} طالب في شاتك · {course.pending_requests} طلب معلقة</small>
                  </div>
                  <ArrowLeft size={14} className="muted" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="اختصارات" />
            <div className="col gap-8" style={{ marginTop: 12 }}>
              <Link to="/ta/assignments" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><ClipboardList size={15} /> تكليفاتي</span><ArrowLeft size={14} />
              </Link>
              <Link to="/ta/submissions" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><FileCheck2 size={15} /> مراجعة التسليمات</span><ArrowLeft size={14} />
              </Link>
              <Link to="/chats" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><MessagesSquare size={15} /> المحادثات</span><ArrowLeft size={14} />
              </Link>
              <Link to="/ta/schedule" className="btn btn-soft btn-sm" style={{ justifyContent: 'space-between' }}>
                <span><CalendarClock size={15} /> تعديل مواعيد السكاشن</span><ArrowLeft size={14} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
