import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Inbox, Search, Users, XCircle
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, requestStatusMeta } from '../../lib/format.js';
import {
  Avatar, Badge, Button, EmptyState, FullLoader, PageHead, SearchInput, Select, StatCard
} from '../../components/ui.jsx';

const TABS = [
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'approved', label: 'المقبولون' },
  { id: 'rejected', label: 'المرفوضون' },
  { id: 'all', label: 'الكل' }
];

export default function TaRequests() {
  const { push } = useToast();
  const { data, loading, error, reload } = useFetch('/chats/mine');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [status, setStatus] = useState('pending');
  const [courseId, setCourseId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);

  const chats = useMemo(
    () => (data?.chats || []).filter((chat) => chat.type === 'ta'),
    [data]
  );

  useEffect(() => {
    let alive = true;
    if (!chats.length) {
      setRequests([]);
      setLoadingRequests(false);
      return undefined;
    }
    setLoadingRequests(true);
    (async () => {
      const results = await Promise.allSettled(chats.map(async (chat) => {
        const result = await api(`/chats/${chat.id}/requests`);
        return (result.requests || []).map((item) => ({
          ...item,
          chatId: chat.id,
          courseId: chat.courseId,
          courseName: chat.courseName,
          taName: chat.taName
        }));
      }));
      if (!alive) return;
      const merged = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(merged);
      setLoadingRequests(false);
    })();
    return () => { alive = false; };
  }, [chats]);

  const courses = useMemo(
    () => [...new Map(chats.map((chat) => [chat.courseId, { id: chat.courseId, name: chat.courseName }])).values()],
    [chats]
  );

  const counts = useMemo(() => ({
    pending: requests.filter((item) => item.status === 'pending').length,
    approved: requests.filter((item) => item.status === 'approved').length,
    rejected: requests.filter((item) => item.status === 'rejected').length
  }), [requests]);

  const visible = useMemo(() => requests.filter((item) => {
    if (status !== 'all' && item.status !== status) return false;
    if (courseId && item.courseId !== Number(courseId)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [item.studentName, item.username, item.courseName, item.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [requests, status, courseId, query]);

  const decide = async (item, nextStatus) => {
    setBusy(item.id);
    try {
      const result = await api(`/chats/${item.chatId}/requests/${item.id}`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
      push(result.message || (nextStatus === 'approved' ? 'تم قبول الطالب' : 'تم رفض الطلب'));
      setRequests((current) => current.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row)));
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <FullLoader label="جارٍ تحميل طلبات الانضمام..." />;

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة شاتات السكاشن"
        title="طلبات الانضمام"
        subtitle="راجع طلبات طلابك قبل فتح شات السكشن. قبول طالب يمنعه من الانضمام لشات معيد آخر في نفس المادة."
        actions={<Link to="/ta/courses" className="btn btn-secondary btn-sm"><Users size={15} /> موادي</Link>}
      />

      <div className="grid grid-4">
        <StatCard icon={Inbox} label="كل الطلبات" value={requests.length} tone="blue" />
        <StatCard icon={Search} label="قيد المراجعة" value={counts.pending} tone="amber" />
        <StatCard icon={CheckCircle2} label="مقبولون" value={counts.approved} tone="emerald" />
        <StatCard icon={XCircle} label="مرفوضون" value={counts.rejected} tone="rose" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`chip ${status === tab.id ? 'active' : ''}`}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
                {tab.id !== 'all' ? ` (${counts[tab.id] ?? 0})` : ` (${requests.length})`}
              </button>
            ))}
          </div>
          <div className="filters">
            <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم الطالب..." />
            <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">كل المواد</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState icon={Users} title="تعذر تحميل المحادثات" text={error} />
      ) : loadingRequests ? (
        <FullLoader label="جارٍ تجميع الطلبات..." />
      ) : chats.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا توجد شاتات سكاشن"
          text="سيتم إنشاء شات خاص بك تلقائياً عند إضافتك كمعيد في مادة."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={status === 'pending' ? CheckCircle2 : Search}
          title={status === 'pending' ? 'لا توجد طلبات معلقة' : 'لا توجد طلبات مطابقة'}
          text={status === 'pending'
            ? 'ستظهر هنا طلبات الطلاب الجدد فور إرسالها من صفحة المادة.'
            : 'جرّب تغيير الحالة أو كلمة البحث.'}
        />
      ) : (
        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>المادة</th>
                  <th>الهاتف</th>
                  <th>تاريخ الطلب</th>
                  <th>الحالة</th>
                  <th style={{ textAlign: 'end' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const meta = requestStatusMeta(item.status);
                  return (
                    <tr key={`${item.chatId}-${item.id}`}>
                      <td>
                        <div className="user-cell">
                          <Avatar name={item.studentName} src={item.avatar} size={32} />
                          <div>
                            <strong>{item.studentName}</strong>
                            <small>@{item.username}</small>
                          </div>
                        </div>
                      </td>
                      <td className="small">{item.courseName}</td>
                      <td className="small">{item.phone || <span className="muted">—</span>}</td>
                      <td className="small">{fmtDateTime(item.createdAt)}</td>
                      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td>
                        <div className="table-actions">
                          {item.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                icon={CheckCircle2}
                                loading={busy === item.id}
                                onClick={() => decide(item, 'approved')}
                              >
                                قبول
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={XCircle}
                                disabled={busy === item.id}
                                onClick={() => decide(item, 'rejected')}
                              >
                                رفض
                              </Button>
                            </>
                          ) : item.status === 'approved' ? (
                            <Link to={`/chat/${item.chatId}`} className="btn btn-soft btn-sm">فتح الشات</Link>
                          ) : (
                            <span className="tiny muted">تم الرفض</span>
                          )}
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
    </div>
  );
}
