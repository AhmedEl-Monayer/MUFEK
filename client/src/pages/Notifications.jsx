import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, CheckCheck, CheckCircle2, ClipboardList, FileCheck2, MessagesSquare,
  Trash2, UserPlus, Users, XCircle
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { relativeTime } from '../lib/format.js';
import { Button, EmptyState, PageHead, Spinner } from '../components/ui.jsx';

const ICONS = {
  message: MessagesSquare,
  assignment_new: ClipboardList,
  assignment_update: ClipboardList,
  assignment_due: ClipboardList,
  join_request: UserPlus,
  join_approved: CheckCircle2,
  join_rejected: XCircle,
  submission_new: FileCheck2,
  submission_review: FileCheck2,
  course_update: BookOpen,
  course_join: BookOpen,
  course_leave: BookOpen,
  course_removed: BookOpen,
  ta_added: Users,
  ta_removed: Users,
  section_update: Users,
  chat_closed: MessagesSquare,
  chat_removed: MessagesSquare
};

export default function Notifications() {
  const { notifications, unread, loading, markRead, markAllRead, load } = useNotifications();
  const { push } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications),
    [notifications, filter]
  );

  const open = async (item) => {
    if (!item.isRead) await markRead(item.id);
    if (item.link) navigate(item.link);
  };

  const remove = async (event, item) => {
    event.stopPropagation();
    try {
      await api(`/notifications/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const clearRead = async () => {
    setBusy(true);
    try {
      await api('/notifications', { method: 'DELETE' });
      await load();
      push('تم حذف الإشعارات المقروءة');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="مركز الإشعارات"
        title="كل ما يخصك في مكان واحد"
        subtitle="تابع التكليفات الجديدة، طلبات الانضمام، الرسائل، ونتائج التصحيح لحظة بلحظة."
        actions={(
          <>
            <Button variant="ghost" icon={CheckCheck} onClick={markAllRead} disabled={!unread}>تعليم الكل كمقروء</Button>
            <Button variant="ghost" icon={Trash2} loading={busy} onClick={clearRead}>حذف المقروء</Button>
          </>
        )}
      />

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل ({notifications.length})</button>
            <button className={`chip ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>غير المقروء ({unread})</button>
          </div>
          <span className="tiny muted">تُحدَّث الإشعارات تلقائياً أثناء استخدامك للمنصة</span>
        </div>

        <hr className="divider" style={{ margin: '14px 0' }} />

        {loading ? (
          <div className="full-loader" style={{ minHeight: 220 }}><Spinner label="جارٍ تحميل الإشعارات..." /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
            text="ستظهر هنا كل التحديثات المهمة: تكليفات جديدة، رسائل، طلبات انضمام، ودرجات."
          />
        ) : (
          <div className="col gap-6">
            {visible.map((item) => {
              const Icon = ICONS[item.type] || Bell;
              return (
                <div
                  key={item.id}
                  className={`notification-item ${item.isRead ? '' : 'unread'}`}
                  onClick={() => open(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter') open(item); }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`notification-icon type-${item.type}`}><Icon size={18} /></span>
                  <div className="notification-body">
                    <strong>{item.title}</strong>
                    {item.body ? <p>{item.body}</p> : null}
                    <small>{relativeTime(item.createdAt)}</small>
                  </div>
                  {!item.isRead ? <span className="notification-dot" /> : null}
                  <button className="btn btn-ghost btn-sm btn-icon" title="حذف الإشعار" onClick={(event) => remove(event, item)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
