import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AtSign, BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileCheck2, FileText,
  GraduationCap, LayoutDashboard, MapPin, MessagesSquare, Pencil, Phone, Plus, Save,
  Search, Settings2, ShieldCheck, Trash2, UserPlus, Users, XCircle
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDate, fmtDateTime, roleLabel, statusMeta } from '../../lib/format.js';
import {
  Avatar, Badge, Button, Card, ConfirmModal, EmptyState, ErrorNote, Field, FilePicker,
  FullLoader, IconButton, InfoRow, Input, Modal, PageHead, SearchInput, SectionTitle, Select,
  StatCard, Tabs, Textarea
} from '../../components/ui.jsx';
import AssignmentCard from '../../components/AssignmentCard.jsx';
import ChatPanel from '../../components/ChatPanel.jsx';
import CreateAssignmentModal from '../../components/CreateAssignmentModal.jsx';

const emptyTa = () => ({ taId: '', sectionDay: '', sectionTime: '', sectionRoom: '', canCreateAssignments: true, canPostGeneral: false });

export default function CourseWorkspace() {
  const { id, tab: tabParam } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const isManager = user.role === 'doctor' || user.role === 'developer';
  const base = user.role === 'developer' ? '/admin' : `/${user.role}`;

  const { data, loading, error, reload } = useFetch(`/courses/${id}`);
  const { data: studentsData, reload: reloadStudents } = useFetch(`/courses/${id}/students`);
  const { data: assignmentsData, reload: reloadAssignments } = useFetch(`/assignments?courseId=${id}`);
  const { data: tasData, reload: reloadTas } = useFetch(`/courses/${id}/tas`);

  const [createOpen, setCreateOpen] = useState(false);
  const [addTaOpen, setAddTaOpen] = useState(false);
  const [availableTas, setAvailableTas] = useState([]);
  const [addTaForm, setAddTaForm] = useState(emptyTa);
  const [addTaLoading, setAddTaLoading] = useState(false);
  const [addTaSaving, setAddTaSaving] = useState(false);
  const [addTaError, setAddTaError] = useState('');
  const [editTa, setEditTa] = useState(null);
  const [editTaForm, setEditTaForm] = useState({});
  const [editTaSaving, setEditTaSaving] = useState(false);
  const [removeTa, setRemoveTa] = useState(null);
  const [removeTaLoading, setRemoveTaLoading] = useState(false);
  const [removeStudent, setRemoveStudent] = useState(null);
  const [removeStudentLoading, setRemoveStudentLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [settingsForm, setSettingsForm] = useState({ name: '', code: '', description: '', isActive: true });
  const [settingsImage, setSettingsImage] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [scheduleForm, setScheduleForm] = useState({ sectionDay: '', sectionTime: '', sectionRoom: '' });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [requestsFor, setRequestsFor] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState(null);
  const [requestsError, setRequestsError] = useState('');

  const course = data?.course;

  useEffect(() => {
    if (!course) return;
    setSettingsForm({
      name: course.name || '',
      code: course.code || '',
      description: course.description || '',
      isActive: Boolean(course.isActive)
    });
    setScheduleForm({
      sectionDay: course.myTa?.sectionDay || '',
      sectionTime: course.myTa?.sectionTime || '',
      sectionRoom: course.myTa?.sectionRoom || ''
    });
  }, [course?.id, course?.updatedAt, course?.myTa?.sectionDay, course?.myTa?.sectionTime, course?.myTa?.sectionRoom]);

  const tabs = useMemo(() => {
    if (!course) return [];
    if (isManager) {
      return [
        { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
        { id: 'tas', label: 'المعيدون', icon: Users, badge: course.tasCount || undefined },
        { id: 'students', label: 'الطلاب', icon: GraduationCap, badge: course.studentsCount || undefined },
        { id: 'chat', label: 'الشات العام', icon: MessagesSquare },
        { id: 'ta-chats', label: 'شاتات المعيدين', icon: MessagesSquare },
        { id: 'assignments', label: 'التكليفات', icon: ClipboardList, badge: course.assignmentsCount || undefined },
        { id: 'submissions', label: 'التسليمات', icon: FileCheck2 },
        { id: 'settings', label: 'الإعدادات', icon: Settings2 }
      ];
    }
    return [
      { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
      { id: 'students', label: 'الطلاب', icon: GraduationCap, badge: course.studentsCount || undefined },
      { id: 'chat', label: 'الشات العام', icon: MessagesSquare },
      { id: 'assignments', label: 'التكليفات', icon: ClipboardList, badge: course.assignmentsCount || undefined },
      { id: 'submissions', label: 'التسليمات', icon: FileCheck2 },
      { id: 'schedule', label: 'موعد السكشن', icon: CalendarClock }
    ];
  }, [course, isManager]);

  const currentTab = tabs.some((tab) => tab.id === tabParam) ? tabParam : 'overview';
  const goTab = (next) => navigate(`${base}/courses/${id}/${next}`);

  if (loading) return <FullLoader label="جارٍ تحميل مساحة المادة..." />;

  if (error || !course) {
    return (
      <div className="page">
        <EmptyState
          icon={BookOpen}
          title="تعذر فتح المادة"
          text={error || 'قد تكون المادة غير متاحة لحسابك.'}
          action={<Link to={`${base}/courses`} className="btn btn-primary btn-sm">العودة للمواد</Link>}
        />
      </div>
    );
  }

  const assignments = assignmentsData?.assignments || [];
  const students = studentsData?.students || [];
  const tas = tasData?.tas || course.tas || [];
  const myTaRow = course.tas?.find((ta) => ta.id === user.id);
  const canCreateAssignments = isManager || Boolean(course.myTa?.canCreateAssignments);
  const visibleStudents = students.filter((student) => {
    if (!studentQuery.trim()) return true;
    const q = studentQuery.trim().toLowerCase();
    return [student.fullName, student.username, student.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  });
  const pendingSubmissions = assignments.reduce((sum, item) => sum + Math.max(0, (item.submissionsCount || 0) - (item.gradedCount || 0)), 0);
  const heroImage = course.image ? `/api/files/course/${course.id}` : null;

  const openAddTa = async () => {
    setAddTaOpen(true);
    setAddTaError('');
    setAddTaForm(emptyTa());
    setAddTaLoading(true);
    try {
      const result = await api(`/courses/${id}/available-tas`);
      setAvailableTas(result.tas || []);
    } catch (err) {
      setAddTaError(err.message);
    } finally {
      setAddTaLoading(false);
    }
  };

  const saveNewTa = async () => {
    setAddTaError('');
    if (!addTaForm.taId) { setAddTaError('اختر المعيد أولاً'); return; }
    setAddTaSaving(true);
    try {
      await api(`/courses/${id}/tas`, { method: 'POST', body: addTaForm });
      push('تمت إضافة المعيد وإنشاء شات خاص به');
      setAddTaOpen(false);
      await Promise.all([reload({ silent: true }), reloadTas({ silent: true })]);
    } catch (err) {
      setAddTaError(err.message);
    } finally {
      setAddTaSaving(false);
    }
  };

  const openEditTa = (ta) => {
    setEditTa(ta);
    setEditTaForm({
      sectionDay: ta.sectionDay || '',
      sectionTime: ta.sectionTime || '',
      sectionRoom: ta.sectionRoom || '',
      canCreateAssignments: Boolean(ta.canCreateAssignments),
      canPostGeneral: Boolean(ta.canPostGeneral)
    });
  };

  const saveEditTa = async () => {
    setEditTaSaving(true);
    try {
      await api(`/courses/${id}/tas/${editTa.id}`, { method: 'PATCH', body: editTaForm });
      push('تم حفظ بيانات المعيد وصلاحياته');
      setEditTa(null);
      await Promise.all([reload({ silent: true }), reloadTas({ silent: true })]);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setEditTaSaving(false);
    }
  };

  const confirmRemoveTa = async () => {
    setRemoveTaLoading(true);
    try {
      await api(`/courses/${id}/tas/${removeTa.id}`, { method: 'DELETE' });
      push('تمت إزالة المعيد وإغلاق شاته');
      setRemoveTa(null);
      await Promise.all([reload({ silent: true }), reloadTas({ silent: true })]);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRemoveTaLoading(false);
    }
  };

  const confirmRemoveStudent = async () => {
    setRemoveStudentLoading(true);
    try {
      await api(`/courses/${id}/students/${removeStudent.id}`, { method: 'DELETE' });
      push('تمت إزالة الطالب من المادة');
      setRemoveStudent(null);
      await Promise.all([reload({ silent: true }), reloadStudents({ silent: true })]);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRemoveStudentLoading(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', settingsForm.name.trim());
      fd.append('code', settingsForm.code.trim());
      fd.append('description', settingsForm.description.trim());
      fd.append('isActive', settingsForm.isActive ? '1' : '0');
      if (settingsImage) fd.append('image', settingsImage);
      await api(`/courses/${id}`, { method: 'PATCH', form: fd });
      push('تم تحديث بيانات المادة');
      setSettingsImage(null);
      await reload({ silent: true });
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    setScheduleError('');
    setScheduleSaving(true);
    try {
      await api(`/courses/${id}/my-section`, { method: 'PATCH', body: scheduleForm });
      push('تم حفظ موعد السكشن وإشعار الطلاب');
      await reload({ silent: true });
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduleSaving(false);
    }
  };

  const loadRequests = async (ta) => {
    if (!ta?.chatId) return;
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const result = await api(`/chats/${ta.chatId}/requests?status=pending`);
      setRequests(result.requests || []);
    } catch (err) {
      setRequestsError(err.message);
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  const openRequests = (ta) => {
    setRequestsFor(ta);
    setRequests([]);
    loadRequests(ta);
  };

  const decideRequest = async (request, status) => {
    if (!requestsFor?.chatId) return;
    setRequestBusyId(request.id);
    setRequestsError('');
    try {
      await api(`/chats/${requestsFor.chatId}/requests/${request.id}`, {
        method: 'PATCH',
        body: { status }
      });
      push(status === 'approved' ? 'تم قبول الطالب في شات المعيد' : 'تم رفض طلب الانضمام');
      await Promise.all([loadRequests(requestsFor), reloadTas({ silent: true }), reload({ silent: true })]);
    } catch (err) {
      setRequestsError(err.message);
    } finally {
      setRequestBusyId(null);
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
        <p>{course.description || 'لا يوجد وصف لهذه المادة بعد. يمكنك إضافته من إعدادات المادة.'}</p>
        <div className="hero-meta">
          <span><GraduationCap size={14} /> {course.doctorName}</span>
          <span><Users size={14} /> {course.studentsCount} طالب</span>
          <span><BookOpen size={14} /> {course.tasCount} معيد</span>
          <span><ClipboardList size={14} /> {course.assignmentsCount} تكليف</span>
          <Badge tone={course.isActive ? 'success' : 'danger'}>{course.isActive ? 'نشطة' : 'متوقفة'}</Badge>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" size="sm" icon={MessagesSquare} onClick={() => goTab('chat')}>الشات العام</Button>
          {isManager ? <Button variant="secondary" size="sm" icon={Settings2} onClick={() => goTab('settings')}>الإعدادات</Button> : null}
        </div>
      </div>

      <div className="course-tabs-row">
        <Tabs tabs={tabs} value={currentTab} onChange={goTab} />
        <div className="row gap-6">
          {canCreateAssignments ? <Button size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>تكليف جديد</Button> : null}
          <Link to={`${base}/courses`} className="btn btn-ghost btn-sm"><BookOpen size={14} /> كل المواد</Link>
        </div>
      </div>

      {currentTab === 'overview' ? (
        <div className="tab-panel col gap-16">
          <div className="grid grid-4">
            <StatCard icon={Users} label="الطلاب" value={course.studentsCount} tone="blue" />
            <StatCard icon={GraduationCap} label="المعيدون" value={course.tasCount} tone="violet" />
            <StatCard icon={ClipboardList} label="التكليفات النشطة" value={course.assignmentsCount} tone="amber" />
            <StatCard icon={FileCheck2} label="بانتظار المراجعة" value={pendingSubmissions} tone="rose" />
          </div>

          <div className="assignment-body-grid">
            <Card>
              <SectionTitle title="أحدث التكليفات" subtitle="أقرب المواعيد النهائية أولاً." action={<Button variant="ghost" size="sm" onClick={() => goTab('assignments')}>عرض الكل</Button>} />
              <div className="col gap-12" style={{ marginTop: 14 }}>
                {assignments.slice(0, 4).map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} showCourse={false} />
                ))}
                {assignments.length === 0 ? <EmptyState compact icon={ClipboardList} title="لا توجد تكليفات" text="ابدأ بنشر أول تكليف لطلاب المادة." /> : null}
              </div>
            </Card>

            <div className="col gap-16">
              <Card className="course-side-card">
                <h3>بيانات المادة</h3>
                <InfoRow icon={GraduationCap} label="دكتور المادة" value={course.doctorName} />
                {course.doctorPhone ? <InfoRow icon={Phone} label="هاتف الدكتور" value={course.doctorPhone} /> : null}
                <InfoRow icon={BookOpen} label="كود المادة" value={course.code || '—'} />
                <InfoRow icon={CalendarClock} label="تاريخ الإنشاء" value={fmtDate(course.createdAt)} />
                {myTaRow ? (
                  <>
                    <InfoRow icon={CalendarClock} label="يوم السكشن" value={myTaRow.sectionDay || '—'} />
                    <InfoRow icon={CalendarClock} label="وقت السكشن" value={myTaRow.sectionTime || '—'} />
                    <InfoRow icon={MapPin} label="مكان السكشن" value={myTaRow.sectionRoom || '—'} />
                  </>
                ) : null}
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
                {course.tas.slice(0, 5).map((ta) => (
                  <div className="row gap-8" key={ta.id}>
                    <Avatar name={ta.fullName} src={ta.avatar} size={32} />
                    <div className="grow">
                      <div className="small strong">{ta.fullName}</div>
                      <div className="tiny muted">{ta.sectionDay || 'معيد'} {ta.sectionTime ? `· ${ta.sectionTime}` : ''}</div>
                    </div>
                    {ta.id === user.id ? <Badge tone="primary">أنت</Badge> : null}
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {currentTab === 'tas' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle
            title="معيدو المادة"
            subtitle="أضف المعيدين، وحدد مواعيد السكاشن وصلاحيات النشر."
            action={<Button icon={UserPlus} onClick={openAddTa}>إضافة معيد</Button>}
          />
          <div className="auto-grid">
            {tas.map((ta) => (
              <Card key={ta.id} className="ta-card">
                <div className="ta-head">
                  <Avatar name={ta.fullName} src={ta.avatar} size={46} ring />
                  <div className="grow">
                    <strong>{ta.fullName}</strong>
                    <small>@{ta.username} {ta.id === user.id ? '· أنت' : ''}</small>
                  </div>
                  <div className="row gap-6">
                    <IconButton icon={Pencil} label="تعديل المعيد" onClick={() => openEditTa(ta)} />
                    <IconButton icon={Trash2} label="إزالة المعيد" onClick={() => setRemoveTa(ta)} />
                  </div>
                </div>
                <div className="ta-section">
                  <CalendarClock size={14} />
                  <span>{[ta.sectionDay, ta.sectionTime, ta.sectionRoom].filter(Boolean).join(' · ') || 'لم يتم تحديد موعد السكشن'}</span>
                </div>
                <div className="row gap-6 wrap">
                  <Badge tone={ta.canCreateAssignments ? 'success' : 'neutral'}>إنشاء التكليفات: {ta.canCreateAssignments ? 'مسموح' : 'ممنوع'}</Badge>
                  <Badge tone={ta.canPostGeneral ? 'success' : 'neutral'}>التكليف العام: {ta.canPostGeneral ? 'مسموح' : 'ممنوع'}</Badge>
                  {ta.pendingCount ? <Badge tone="warning">{ta.pendingCount} طلب انضمام</Badge> : null}
                  <Badge tone="info">{ta.membersCount || 0} طالب في الشات</Badge>
                </div>
                <div className="ta-actions">
                  {ta.chatId ? <Link to={`/chat/${ta.chatId}`} className="btn btn-soft btn-sm"><MessagesSquare size={14} /> فتح الشات</Link> : null}
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEditTa(ta)}>تعديل</Button>
                </div>
              </Card>
            ))}
            {tas.length === 0 ? <EmptyState icon={Users} title="لا يوجد معيدون" text="أضف أول معيد للمادة ليبدأ شات السكشن الخاص به." action={<Button icon={UserPlus} onClick={openAddTa}>إضافة معيد</Button>} /> : null}
          </div>
        </div>
      ) : null}

      {currentTab === 'students' ? (
        <div className="tab-panel col gap-16">
          <div className="glass card" style={{ padding: 16 }}>
            <div className="filters">
              <SearchInput value={studentQuery} onChange={setStudentQuery} placeholder="ابحث باسم الطالب أو اسم المستخدم..." />
              <span className="pill"><GraduationCap size={13} /> {students.length} طالب</span>
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>رقم الهاتف</th>
                    <th>معيد الشات</th>
                    <th>التسليمات</th>
                    <th>تاريخ الاشتراك</th>
                    {isManager ? <th style={{ textAlign: 'end' }}>إجراء</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="user-cell">
                          <Avatar name={student.fullName} src={student.avatar} size={34} />
                          <div>
                            <strong>{student.fullName}</strong>
                            <small>@{student.username}</small>
                          </div>
                        </div>
                      </td>
                      <td className="small">{student.phone || '—'}</td>
                      <td>{student.taName ? <Badge tone="accent">{student.taName}</Badge> : <span className="tiny muted">بدون شات</span>}</td>
                      <td><Badge tone="info">{student.submissionsCount || 0}</Badge></td>
                      <td className="small">{fmtDate(student.joinedAt)}</td>
                      {isManager ? (
                        <td>
                          <div className="table-actions">
                            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setRemoveStudent(student)}>إزالة</Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {visibleStudents.length === 0 ? (
                    <tr><td colSpan={isManager ? 6 : 5}><EmptyState compact icon={Search} title="لا يوجد طلاب" text="لم ينضم أي طالب مطابق للبحث بعد." /></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {currentTab === 'chat' ? (
        <div className="tab-panel">
          {course.generalChat ? (
            <ChatPanel chatId={course.generalChat.id} />
          ) : (
            <EmptyState icon={MessagesSquare} title="لا يوجد شات عام" text="يتم إنشاء الشات العام تلقائياً مع إنشاء المادة." />
          )}
        </div>
      ) : null}

      {currentTab === 'ta-chats' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle title="شاتات المعيدين" subtitle="كل معيد له شات خاص بطلاب سكشنه. يمكنك فتح أي شات والإشراف عليه." />
          <div className="auto-grid">
            {tas.map((ta) => (
              <Card key={ta.id} className="ta-card">
                <div className="ta-head">
                  <Avatar name={ta.fullName} src={ta.avatar} size={44} />
                  <div className="grow">
                    <strong>{ta.fullName}</strong>
                    <small>{[ta.sectionDay, ta.sectionTime].filter(Boolean).join(' · ') || 'معيد المادة'}</small>
                  </div>
                  <Badge tone="info">{ta.membersCount || 0} عضو</Badge>
                </div>
                {ta.pendingCount ? <Badge tone="warning">{ta.pendingCount} طلب انضمام بانتظار القرار</Badge> : null}
                {ta.chatId ? (
                  <div className="ta-actions">
                    <Link to={`/chat/${ta.chatId}`} className="btn btn-primary btn-sm"><MessagesSquare size={14} /> فتح شات المعيد</Link>
                    <Button variant="soft" size="sm" icon={Users} onClick={() => openRequests(ta)}>
                      طلبات الانضمام{ta.pendingCount ? ` (${ta.pendingCount})` : ''}
                    </Button>
                  </div>
                ) : <span className="tiny muted">لم يتم إنشاء شات لهذا المعيد بعد.</span>}
              </Card>
            ))}
            {tas.length === 0 ? <EmptyState icon={MessagesSquare} title="لا توجد شاتات" text="أضف معيدين للمادة لإنشاء شاتاتهم." action={<Button icon={UserPlus} onClick={openAddTa}>إضافة معيد</Button>} /> : null}
          </div>
        </div>
      ) : null}

      {currentTab === 'assignments' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle
            title="تكليفات المادة"
            subtitle="التكليفات العامة تظهر لكل الطلاب، والخاصة تظهر لطلاب شات المعيد فقط."
            action={canCreateAssignments ? <Button icon={Plus} onClick={() => setCreateOpen(true)}>نشر تكليف</Button> : null}
          />
          {assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="لا توجد تكليفات بعد"
              text={canCreateAssignments ? 'انشر أول تكليف لطلاب المادة وحدد موعد التسليم.' : 'الدكتور لم ينشر تكليفات في هذه المادة بعد.'}
              action={canCreateAssignments ? <Button icon={Plus} onClick={() => setCreateOpen(true)}>نشر تكليف</Button> : null}
            />
          ) : (
            <div className="auto-grid-wide">
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} href={`/assignment/${assignment.id}`} showCourse={false} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {currentTab === 'submissions' ? (
        <div className="tab-panel col gap-16">
          <SectionTitle title="متابعة التسليمات" subtitle="افتح التكليف لمراجعة ملفات الطلاب وتسجيل الدرجات." />
          <Card>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>التكليف</th>
                    <th>النطاق</th>
                    <th>موعد التسليم</th>
                    <th>المستحقون</th>
                    <th>التسليمات</th>
                    <th>التصحيح</th>
                    <th style={{ textAlign: 'end' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.id}>
                      <td><strong className="small">{item.title}</strong></td>
                      <td><Badge tone={item.scope === 'ta' ? 'accent' : 'primary'}>{item.scope === 'ta' ? 'خاص بالمعيد' : 'عام'}</Badge></td>
                      <td className="small">{fmtDateTime(item.dueAt)}</td>
                      <td><Badge tone="neutral">{item.eligibleCount ?? '—'}</Badge></td>
                      <td><Badge tone="info">{item.submissionsCount || 0}</Badge></td>
                      <td><Badge tone={item.submissionsCount && item.gradedCount === item.submissionsCount ? 'success' : 'warning'}>{item.gradedCount || 0} / {item.submissionsCount || 0}</Badge></td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/assignment/${item.id}`} className="btn btn-soft btn-sm"><FileText size={14} /> مراجعة</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 ? <tr><td colSpan={7}><EmptyState compact icon={FileCheck2} title="لا توجد تسليمات" text="لم يتم نشر تكليفات في هذه المادة بعد." /></td></tr> : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {currentTab === 'settings' && isManager ? (
        <div className="tab-panel col gap-16">
          <SectionTitle title="إعدادات المادة" subtitle="حدّث بيانات المادة وصورتها وحالة الظهور للطلاب." />
          <Card>
            <form onSubmit={saveSettings}>
              <div className="form-grid">
                <Field label="اسم المادة" required>
                  <Input value={settingsForm.name} onChange={(event) => setSettingsForm((current) => ({ ...current, name: event.target.value }))} minLength={3} required />
                </Field>
                <Field label="كود المادة">
                  <Input value={settingsForm.code} onChange={(event) => setSettingsForm((current) => ({ ...current, code: event.target.value }))} />
                </Field>
                <Field label="وصف المادة" className="span-2">
                  <Textarea value={settingsForm.description} onChange={(event) => setSettingsForm((current) => ({ ...current, description: event.target.value }))} />
                </Field>
                <div className="span-2">
                  <Field label="صورة المادة" hint="تظهر كغلاف للمادة في كل الصفحات">
                    <FilePicker file={settingsImage} onChange={setSettingsImage} accept="image/png,image/jpeg,image/webp" label="اختيار صورة جديدة" />
                  </Field>
                </div>
                <div className="field span-2">
                  <span className="field-label">حالة المادة</span>
                  <label className="check-row">
                    <input type="checkbox" checked={settingsForm.isActive} onChange={(event) => setSettingsForm((current) => ({ ...current, isActive: event.target.checked }))} />
                    <span>المادة نشطة ومتاحة للطلاب</span>
                  </label>
                </div>
              </div>
              {settingsError ? <div className="mt-12"><ErrorNote>{settingsError}</ErrorNote></div> : null}
              <div className="form-actions" style={{ marginTop: 14 }}>
                <Button type="submit" icon={Save} loading={settingsSaving}>حفظ إعدادات المادة</Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {currentTab === 'schedule' && !isManager ? (
        <div className="tab-panel col gap-16">
          <SectionTitle title="موعد السكشن" subtitle="حدّث موعد ومكان سكشنك، وسيصل إشعار لطلاب شاتك تلقائياً." />
          <div className="assignment-body-grid">
            <Card>
              <form onSubmit={saveSchedule}>
                <div className="form-grid">
                  <Field label="يوم السكشن">
                    <Input value={scheduleForm.sectionDay} onChange={(event) => setScheduleForm((current) => ({ ...current, sectionDay: event.target.value }))} placeholder="مثال: السبت" />
                  </Field>
                  <Field label="وقت السكشن">
                    <Input value={scheduleForm.sectionTime} onChange={(event) => setScheduleForm((current) => ({ ...current, sectionTime: event.target.value }))} placeholder="مثال: 10:00 ص - 12:00 م" />
                  </Field>
                  <Field label="مكان السكشن" className="span-2">
                    <Input value={scheduleForm.sectionRoom} onChange={(event) => setScheduleForm((current) => ({ ...current, sectionRoom: event.target.value }))} placeholder="مثال: قاعة 12" />
                  </Field>
                </div>
                {scheduleError ? <div className="mt-12"><ErrorNote>{scheduleError}</ErrorNote></div> : null}
                <div className="form-actions" style={{ marginTop: 14 }}>
                  <Button type="submit" icon={Save} loading={scheduleSaving}>حفظ موعد السكشن</Button>
                </div>
              </form>
            </Card>
            <Card className="course-side-card">
              <h3>طلاب شاتك</h3>
              <div className="summary-row"><span>الأعضاء المقبولون</span><strong>{myTaRow?.membersCount ?? '—'}</strong></div>
              <div className="summary-row"><span>الطلبات المعلقة</span><strong>{myTaRow?.pendingCount ?? '—'}</strong></div>
              <Link to="/ta/requests" className="btn btn-soft btn-sm"><Users size={14} /> إدارة طلبات الانضمام</Link>
              <div className="notice"><CheckCircle2 size={17} /><span>سيصل إشعار لكل طالب في شاتك فور حفظ الموعد الجديد.</span></div>
            </Card>
          </div>
        </div>
      ) : null}

      <CreateAssignmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => Promise.all([reloadAssignments({ silent: true }), reload({ silent: true })])}
        courseId={course.id}
      />

      <Modal
        open={addTaOpen}
        onClose={() => setAddTaOpen(false)}
        title="إضافة معيد للمادة"
        subtitle="سيتم إنشاء شات خاص بالمعيد تلقائياً لطلاب سكشنه."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAddTaOpen(false)}>إلغاء</Button>
            <Button icon={UserPlus} loading={addTaSaving} onClick={saveNewTa} disabled={addTaLoading}>إضافة المعيد</Button>
          </>
        )}
      >
        {addTaLoading ? (
          <div className="full-loader" style={{ minHeight: 150 }}>جارٍ تحميل المعيدين المتاحين...</div>
        ) : (
          <div className="col gap-12">
            <Field label="المعيد" required>
              <Select value={addTaForm.taId} onChange={(event) => setAddTaForm((current) => ({ ...current, taId: event.target.value }))}>
                <option value="">اختر المعيد</option>
                {availableTas.map((ta) => <option key={ta.id} value={ta.id}>{ta.fullName} · @{ta.username}</option>)}
              </Select>
            </Field>
            {availableTas.length === 0 ? <div className="notice warning"><Users size={17} /><span>لا يوجد معيدون متاحون. أنشئ حسابات معيدين من لوحة المطور أولاً.</span></div> : null}
            <div className="form-grid">
              <Field label="يوم السكشن">
                <Input value={addTaForm.sectionDay} onChange={(event) => setAddTaForm((current) => ({ ...current, sectionDay: event.target.value }))} placeholder="السبت" />
              </Field>
              <Field label="وقت السكشن">
                <Input value={addTaForm.sectionTime} onChange={(event) => setAddTaForm((current) => ({ ...current, sectionTime: event.target.value }))} placeholder="10:00 ص - 12:00 م" />
              </Field>
              <Field label="مكان السكشن" className="span-2">
                <Input value={addTaForm.sectionRoom} onChange={(event) => setAddTaForm((current) => ({ ...current, sectionRoom: event.target.value }))} placeholder="قاعة 12" />
              </Field>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={addTaForm.canCreateAssignments} onChange={(event) => setAddTaForm((current) => ({ ...current, canCreateAssignments: event.target.checked }))} />
              <span>السماح للمعيد بإنشاء تكليفات خاصة بشات طلابه</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={addTaForm.canPostGeneral} onChange={(event) => setAddTaForm((current) => ({ ...current, canPostGeneral: event.target.checked }))} />
              <span>السماح للمعيد بنشر تكليفات عامة لكل طلاب المادة</span>
            </label>
            {addTaError ? <ErrorNote>{addTaError}</ErrorNote> : null}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editTa)}
        onClose={() => setEditTa(null)}
        title={`تعديل بيانات ${editTa?.fullName || 'المعيد'}`}
        subtitle="حدّث موعد السكشن وصلاحيات النشر."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditTa(null)}>إلغاء</Button>
            <Button icon={Save} loading={editTaSaving} onClick={saveEditTa}>حفظ التغييرات</Button>
          </>
        )}
      >
        <div className="col gap-12">
          <div className="form-grid">
            <Field label="يوم السكشن">
              <Input value={editTaForm.sectionDay || ''} onChange={(event) => setEditTaForm((current) => ({ ...current, sectionDay: event.target.value }))} />
            </Field>
            <Field label="وقت السكشن">
              <Input value={editTaForm.sectionTime || ''} onChange={(event) => setEditTaForm((current) => ({ ...current, sectionTime: event.target.value }))} />
            </Field>
            <Field label="مكان السكشن" className="span-2">
              <Input value={editTaForm.sectionRoom || ''} onChange={(event) => setEditTaForm((current) => ({ ...current, sectionRoom: event.target.value }))} />
            </Field>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={Boolean(editTaForm.canCreateAssignments)} onChange={(event) => setEditTaForm((current) => ({ ...current, canCreateAssignments: event.target.checked }))} />
            <span>السماح بإنشاء التكليفات الخاصة</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={Boolean(editTaForm.canPostGeneral)} onChange={(event) => setEditTaForm((current) => ({ ...current, canPostGeneral: event.target.checked }))} />
            <span>السماح بنشر التكليفات العامة</span>
          </label>
          <div className="notice"><ShieldCheck size={17} /><span>تغيير موعد السكشن يُرسل إشعاراً تلقائياً لطلاب شات المعيد.</span></div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(removeTa)}
        onClose={() => setRemoveTa(null)}
        onConfirm={confirmRemoveTa}
        loading={removeTaLoading}
        title="إزالة المعيد"
        message={`سيتم إزالة ${removeTa?.fullName || 'المعيد'} من المادة وإغلاق شات طلابه. لا يمكن الإزالة قبل حذف أو إعادة إسناد تكليفاته الخاصة.`}
        confirmLabel="إزالة المعيد"
      />

      <ConfirmModal
        open={Boolean(removeStudent)}
        onClose={() => setRemoveStudent(null)}
        onConfirm={confirmRemoveStudent}
        loading={removeStudentLoading}
        title="إزالة الطالب من المادة"
        message={`سيتم إزالة ${removeStudent?.fullName || 'الطالب'} من المادة وإلغاء طلبات شات المعيد الخاصة به.`}
        confirmLabel="إزالة الطالب"
      />

      <Modal
        open={Boolean(requestsFor)}
        onClose={() => { setRequestsFor(null); setRequests([]); setRequestsError(''); }}
        title={`طلبات الانضمام · ${requestsFor?.fullName || 'المعيد'}`}
        subtitle="راجع طلبات الطلاب قبل فتح شات السكشن. القبول يمنع الطالب من الانضمام لشات معيد آخر في نفس المادة."
        footer={(
          <>
            <Button variant="ghost" onClick={() => loadRequests(requestsFor)} loading={requestsLoading}>تحديث</Button>
            <Button variant="ghost" onClick={() => { setRequestsFor(null); setRequests([]); setRequestsError(''); }}>إغلاق</Button>
          </>
        )}
      >
        <div className="col gap-12">
          {requestsError ? <ErrorNote>{requestsError}</ErrorNote> : null}
          {requestsLoading ? (
            <div className="full-loader" style={{ minHeight: 140 }}>جارٍ تحميل الطلبات...</div>
          ) : requests.length === 0 ? (
            <EmptyState compact icon={Users} title="لا توجد طلبات معلقة" text="ستظهر هنا طلبات الطلاب الجديدة للانضمام إلى شات هذا المعيد." />
          ) : (
            requests.map((request) => (
              <div className="card glass" key={request.id} style={{ padding: 14 }}>
                <div className="row gap-10 wrap">
                  <Avatar name={request.studentName} src={request.avatar} size={38} />
                  <div className="grow">
                    <strong className="small">{request.studentName}</strong>
                    <div className="tiny muted">@{request.username}{request.phone ? ` · ${request.phone}` : ''}</div>
                  </div>
                  <div className="row gap-6">
                    <Button
                      size="sm"
                      variant="soft"
                      icon={CheckCircle2}
                      loading={requestBusyId === request.id}
                      disabled={Boolean(requestBusyId) && requestBusyId !== request.id}
                      onClick={() => decideRequest(request, 'approved')}
                    >
                      قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={XCircle}
                      disabled={Boolean(requestBusyId) && requestBusyId !== request.id}
                      onClick={() => decideRequest(request, 'rejected')}
                    >
                      رفض
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
