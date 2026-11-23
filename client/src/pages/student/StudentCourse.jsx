import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen, CalendarClock, CheckCircle2, ClipboardList, GraduationCap, LayoutDashboard,
  MessagesSquare, Phone, Send, ShieldCheck, UserRound, Users, XCircle
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDate, requestStatusMeta } from '../../lib/format.js';
import { courseImage } from '../../lib/media.js';
import {
  Avatar, Badge, Button, Card, ConfirmModal, EmptyState, FullLoader, InfoRow,
  SectionTitle, StatCard, Tabs
} from '../../components/ui.jsx';
import AssignmentCard from '../../components/AssignmentCard.jsx';
import ChatPanel from '../../components/ChatPanel.jsx';

export default function StudentCourse() {
  const { id, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch(`/courses/${id}`);
  const { data: assignmentsData } = useFetch(`/assignments?courseId=${id}`);
  const [busyTa, setBusyTa] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const course = data?.course;
  const assignments = assignmentsData?.assignments || [];

  const tabs = useMemo(() => {
    if (!course) return [];
    return [
      { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
      { id: 'assignments', label: 'التكليفات', icon: ClipboardList, badge: assignments.length || undefined },
      { id: 'tas', label: 'المعيدون والسكاشن', icon: Users, badge: course.tas?.length || undefined },
      { id: 'chat', label: 'الشات العام', icon: MessagesSquare }
    ];
  }, [course, assignments.length]);

  const currentTab = tabs.some((tab) => tab.id === tabParam) ? tabParam : 'overview';
  const goTab = (next) => navigate(`/student/courses/${id}/${next}`);

  if (loading) return <FullLoader label="جارٍ تحميل المادة..." />;

  if (error || !course) {
    return (
      <div className="page">
        <EmptyState
          icon={BookOpen}
          title="تعذر فتح المادة"
          text={error || 'قد تكون المادة غير متاحة لحسابك أو تم إلغاء اشتراكك.'}
          action={<Link to="/student/courses" className="btn btn-primary btn-sm">العودة للمواد</Link>}
        />
      </div>
    );
  }

  const heroImage = courseImage(course);
  const linkedTaId = course.myTaChat?.ta_id || null;

  const requestTa = async (ta) => {
    if (!ta.chatId) return;
    setBusyTa(ta.id);
    try {
      const result = await api(`/chats/${ta.chatId}/requests`, { method: 'POST' });
      push(result.message || 'تم إرسال طلب الانضمام');
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyTa(null);
    }
  };

  const cancelRequest = async (ta) => {
    if (!ta.chatId) return;
    setBusyTa(ta.id);
    try {
      const result = await api(`/chats/${ta.chatId}/requests`, { method: 'DELETE' });
      push(result.message || 'تم إلغاء طلب الانضمام');
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyTa(null);
    }
  };

  const leaveCourse = async () => {
    setLeaving(true);
    try {
      const result = await api(`/courses/${id}/join`, { method: 'DELETE' });
      push(result.message || 'تم إلغاء الاشتراك');
      navigate('/student/my-courses', { replace: true });
    } catch (err) {
      push(err.message, 'error');
      setLeaving(false);
    }
  };

  return (
    <div className="page">
      <div
        className={`course-hero ${heroImage ? 'has-image' : ''}`}
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        {heroImage ? <span className="hero-shade" /> : null}
        <span className="hero-code">{course.code || 'مادة'}</span>
        <h2>{course.name}</h2>
        <p>{course.description || 'لا يوجد وصف لهذه المادة بعد.'}</p>
        <div className="hero-meta">
          <span><GraduationCap size={14} /> {course.doctorName}</span>
          <span><Users size={14} /> {course.studentsCount} طالب</span>
          <span><BookOpen size={14} /> {course.tasCount} معيد</span>
          <span><ClipboardList size={14} /> {course.assignmentsCount} تكليف</span>
          <Badge tone="success" icon={CheckCircle2}>مشترك</Badge>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" size="sm" icon={MessagesSquare} onClick={() => goTab('chat')}>الشات العام</Button>
          <Button variant="secondary" size="sm" icon={XCircle} onClick={() => setLeaveOpen(true)}>إلغاء الاشتراك</Button>
        </div>
      </div>

      <div className="course-tabs-row">
        <Tabs tabs={tabs} value={currentTab} onChange={goTab} />
        <Link to="/student/my-courses" className="btn btn-ghost btn-sm"><BookOpen size={14} /> كل موادي</Link>
      </div>

      {currentTab === 'overview' ? (
        <div className="tab-panel col gap-16">
          <div className="grid grid-4">
            <StatCard icon={Users} label="الطلاب" value={course.studentsCount} tone="blue" />
            <StatCard icon={GraduationCap} label="المعيدون" value={course.tasCount} tone="violet" />
            <StatCard icon={ClipboardList} label="التكليفات" value={course.assignmentsCount} tone="amber" />
            <StatCard icon={MessagesSquare} label="شاتاتك" value={(course.generalChat ? 1 : 0) + (linkedTaId ? 1 : 0)} tone="emerald" />
          </div>

          <div className="assignment-body-grid">
            <Card>
              <SectionTitle title="عن المادة" subtitle="تفاصيل المادة وفريق التدريس." />
              <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.9, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>
                {course.description || 'لا يوجد وصف إضافي لهذه المادة.'}
              </p>
              <div className="grid grid-2" style={{ marginTop: 16 }}>
                <div className="notice">
                  <MessagesSquare size={17} />
                  <span>الشات العام متاح لكل طلاب المادة، ويمكنك فتحه من تبويب «الشات العام».</span>
                </div>
                <div className="notice">
                  <ShieldCheck size={17} />
                  <span>شات المعيد خاص بطلاب سكشنه فقط، ويظهر محتواه بعد قبول طلب الانضمام.</span>
                </div>
              </div>
            </Card>

            <div className="col gap-16">
              <Card className="course-side-card">
                <h3>بيانات المادة</h3>
                <InfoRow icon={GraduationCap} label="دكتور المادة" value={course.doctorName} />
                {course.doctorPhone ? <InfoRow icon={Phone} label="هاتف الدكتور" value={course.doctorPhone} /> : null}
                <InfoRow icon={BookOpen} label="كود المادة" value={course.code || '—'} />
                <InfoRow icon={CalendarClock} label="تاريخ الإضافة" value={fmtDate(course.createdAt)} />
                <InfoRow icon={UserRound} label="معيدك الحالي" value={course.myTaChat?.ta_name || 'لم تنضم لشات معيد بعد'} />
              </Card>

              <Card className="course-side-card">
                <h3>فريق المادة</h3>
                <div className="row gap-8">
                  <Avatar name={course.doctorName} src={course.doctorAvatar} size={38} />
                  <div className="grow">
                    <div className="small strong">{course.doctorName}</div>
                    <div className="tiny muted">دكتور المادة</div>
                  </div>
                </div>
                {(course.tas || []).map((ta) => (
                  <div className="row gap-8" key={ta.id}>
                    <Avatar name={ta.fullName} src={ta.avatar} size={32} />
                    <div className="grow">
                      <div className="small strong">{ta.fullName}</div>
                      <div className="tiny muted">{ta.sectionDay || 'معيد'} {ta.sectionTime ? `· ${ta.sectionTime}` : ''}</div>
                    </div>
                    {ta.requestStatus === 'approved' ? <Badge tone="success">معيدك</Badge> : null}
                  </div>
                ))}
                {course.tas?.length === 0 ? <span className="tiny muted">لم يُضف معيدون لهذه المادة بعد.</span> : null}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {currentTab === 'assignments' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle title="تكليفات المادة" subtitle="التكليفات العامة تظهر لكل الطلاب، وتكليفات المعيد تظهر لطلاب شاته فقط." />
          {assignments.length === 0 ? (
            <EmptyState icon={ClipboardList} title="لا توجد تكليفات" text="لم ينشر فريق المادة تكليفات بعد." />
          ) : (
            <div className="auto-grid-wide">
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} showCourse={false} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {currentTab === 'tas' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle
            title="المعيدون والسكاشن"
            subtitle="يمكنك الانضمام لشات معيد واحد فقط لكل مادة. لتغيير المعيد تواصل مع الدكتور المسؤول."
          />
          {linkedTaId ? (
            <div className="notice success">
              <CheckCircle2 size={17} />
              <span>أنت مرتبط بشات المعيد {course.myTaChat?.ta_name}. يمكنك فتح المحادثة من الزر أدناه.</span>
            </div>
          ) : null}
          <div className="auto-grid">
            {(course.tas || []).map((ta) => {
              const meta = requestStatusMeta(ta.requestStatus);
              const isLinked = linkedTaId === ta.id;
              const isOther = linkedTaId && linkedTaId !== ta.id;
              return (
                <Card key={ta.id} className="ta-card">
                  <div className="ta-head">
                    <Avatar name={ta.fullName} src={ta.avatar} size={46} ring />
                    <div className="grow">
                      <strong>{ta.fullName}</strong>
                      <small>@{ta.username}</small>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="ta-section">
                    <CalendarClock size={14} />
                    <span>{[ta.sectionDay, ta.sectionTime, ta.sectionRoom].filter(Boolean).join(' · ') || 'لم يتم تحديد موعد السكشن'}</span>
                  </div>
                  {ta.phone ? (
                    <div className="ta-section">
                      <Phone size={14} />
                      <span>{ta.phone}</span>
                    </div>
                  ) : null}
                  <div className="ta-actions">
                    {isLinked && ta.chatId ? (
                      <Link to={`/chat/${ta.chatId}`} className="btn btn-primary btn-sm">
                        <MessagesSquare size={14} /> فتح شات المعيد
                      </Link>
                    ) : ta.requestStatus === 'pending' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busyTa === ta.id}
                        onClick={() => cancelRequest(ta)}
                      >
                        إلغاء طلب الانضمام
                      </Button>
                    ) : ta.requestStatus === 'approved' ? (
                      <Link to={`/chat/${ta.chatId}`} className="btn btn-primary btn-sm">
                        <MessagesSquare size={14} /> فتح الشات
                      </Link>
                    ) : isOther ? (
                      <Button size="sm" variant="ghost" disabled>مرتبط بمعيد آخر</Button>
                    ) : ta.chatId ? (
                      <Button
                        size="sm"
                        icon={Send}
                        loading={busyTa === ta.id}
                        onClick={() => requestTa(ta)}
                      >
                        {ta.requestStatus === 'rejected' ? 'إعادة طلب الانضمام' : 'طلب الانضمام للشات'}
                      </Button>
                    ) : (
                      <span className="tiny muted">لم يتم إنشاء شات لهذا المعيد بعد.</span>
                    )}
                  </div>
                  {ta.requestStatus === 'pending' ? (
                    <div className="notice warning"><CalendarClock size={17} /><span>طلبك قيد مراجعة المعيد. لن يظهر محتوى الشات قبل الموافقة.</span></div>
                  ) : null}
                </Card>
              );
            })}
            {course.tas?.length === 0 ? (
              <EmptyState icon={Users} title="لا يوجد معيدون" text="لم يُضف الدكتور معيدين لهذه المادة بعد." />
            ) : null}
          </div>
        </div>
      ) : null}

      {currentTab === 'chat' ? (
        <div className="tab-panel">
          {course.generalChat ? (
            <ChatPanel chatId={course.generalChat.id} />
          ) : (
            <EmptyState icon={MessagesSquare} title="لا يوجد شات عام" text="لم يتم إنشاء الشات العام لهذه المادة بعد." />
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={leaveCourse}
        loading={leaving}
        title="إلغاء الاشتراك في المادة"
        message={`سيتم إلغاء اشتراكك في مادة ${course.name} وإلغاء طلبات شات المعيد المرتبطة بها. هل تريد المتابعة؟`}
        confirmLabel="إلغاء الاشتراك"
      />
    </div>
  );
}
