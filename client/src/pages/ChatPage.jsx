import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarClock, MapPin, MessagesSquare, ShieldCheck, UserMinus } from 'lucide-react';
import ChatPanel from '../components/ChatPanel.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { roleLabel } from '../lib/format.js';
import { Avatar, Badge, Button, Card, ConfirmModal, EmptyState, PageHead } from '../components/ui.jsx';

export default function ChatPage() {
  const { id } = useParams();
  const { data, reload } = useFetch(`/chats/${id}`);
  const { push } = useToast();
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const chat = data?.chat;
  const members = data?.members || [];

  const removeMember = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const result = await api(`/chats/${id}/members/${removeTarget.id}`, { method: 'DELETE' });
      push(result.message || 'تمت إزالة الطالب من الشات');
      setRemoveTarget(null);
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="محادثة"
        title={chat ? (chat.type === 'general' ? `شات ${chat.courseName}` : `شات ${chat.taName || 'المعيد'}`) : 'المحادثة'}
        subtitle={chat ? `${chat.courseName}${chat.courseCode ? ` · ${chat.courseCode}` : ''}` : 'جارٍ تحميل بيانات المحادثة...'}
        actions={(
          <Link to="/chats" className="btn btn-ghost btn-sm">
            <ArrowRight size={15} /> كل المحادثات
          </Link>
        )}
      />

      <div className="assignment-body-grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(250px, 0.7fr)' }}>
        <ChatPanel chatId={id} />

        <div className="col gap-16">
          {chat ? (
            <Card className="course-side-card">
              <h3>بيانات المحادثة</h3>
              <div className="info-row">
                <span className="info-icon"><BookOpen size={16} /></span>
                <span className="info-label">المادة</span>
                <span className="info-value">{chat.courseName}</span>
              </div>
              <div className="info-row">
                <span className="info-icon"><ShieldCheck size={16} /></span>
                <span className="info-label">النوع</span>
                <span className="info-value">{chat.type === 'general' ? 'شات عام' : 'شات معيد'}</span>
              </div>
              {chat.type === 'ta' ? (
                <div className="info-row">
                  <span className="info-icon"><MessagesSquare size={16} /></span>
                  <span className="info-label">المعيد</span>
                  <span className="info-value">{chat.taName}</span>
                </div>
              ) : null}
              {chat.sectionDay || chat.sectionTime || chat.sectionRoom ? (
                <div className="info-row">
                  <span className="info-icon"><CalendarClock size={16} /></span>
                  <span className="info-label">السكشن</span>
                  <span className="info-value">
                    {[chat.sectionDay, chat.sectionTime, chat.sectionRoom].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ) : null}
              {chat.sectionRoom ? (
                <div className="info-row">
                  <span className="info-icon"><MapPin size={16} /></span>
                  <span className="info-label">المكان</span>
                  <span className="info-value">{chat.sectionRoom}</span>
                </div>
              ) : null}
              <Badge tone={chat.canWrite ? 'success' : 'warning'} icon={chat.isLocked ? null : ShieldCheck}>
                {chat.isLocked ? 'المحادثة مغلقة' : chat.canWrite ? 'يمكنك المشاركة' : 'قراءة فقط'}
              </Badge>
            </Card>
          ) : null}

          <Card className="course-side-card">
            <h3>الأعضاء ({members.length})</h3>
            {members.length === 0 ? (
              <EmptyState compact icon={MessagesSquare} title="لا يوجد أعضاء" text="سيظهر الأعضاء بعد تحميل المحادثة." />
            ) : (
              <div className="col gap-8">
                {members.map((member) => (
                  <div className="row gap-8" key={member.id}>
                    <Avatar name={member.full_name} src={member.avatar} size={32} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</div>
                      <div className="tiny muted">{roleLabel(member.role)}</div>
                    </div>
                    {chat.canRemoveMembers && member.role === 'student' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={UserMinus}
                        aria-label={`إزالة ${member.full_name} من الشات`}
                        title="إزالة الطالب من الشات"
                        onClick={() => setRemoveTarget(member)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeMember}
        loading={removing}
        title="إزالة الطالب من الشات"
        message={`سيتم إخراج ${removeTarget?.full_name || 'الطالب'} من هذا الشات، وسيتمكن من طلب الانضمام لمعيد آخر في المادة. هل تريد المتابعة؟`}
        confirmLabel="إزالة الطالب"
      />
    </div>
  );
}
