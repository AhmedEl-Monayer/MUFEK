import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Lock, MessagesSquare, Search, Users } from 'lucide-react';
import { useFetch } from '../hooks/useFetch.js';
import { relativeTime } from '../lib/format.js';
import { Avatar, Badge, EmptyState, FullLoader, PageHead, SearchInput } from '../components/ui.jsx';

export default function ChatHub() {
  const { data, loading, error } = useFetch('/chats/mine');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const chats = data?.chats || [];
  const visible = useMemo(() => chats.filter((chat) => {
    if (filter === 'general' && chat.type !== 'general') return false;
    if (filter === 'ta' && chat.type !== 'ta') return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [chat.courseName, chat.courseCode, chat.taName, chat.lastMessage?.body]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [chats, query, filter]);

  if (loading) return <FullLoader label="جارٍ تحميل محادثاتك..." />;

  return (
    <div className="page">
      <PageHead
        eyebrow="مساحات النقاش"
        title="المحادثات"
        subtitle="شات عام لكل مادة، وشات خاص مع معيدك في السكشن بعد قبول طلب الانضمام."
      />

      <div className="glass card" style={{ padding: 16 }}>
        <div className="row between wrap gap-12">
          <div className="chip-tabs">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>الكل ({chats.length})</button>
            <button className={`chip ${filter === 'general' ? 'active' : ''}`} onClick={() => setFilter('general')}>
              شات عام ({chats.filter((chat) => chat.type === 'general').length})
            </button>
            <button className={`chip ${filter === 'ta' ? 'active' : ''}`} onClick={() => setFilter('ta')}>
              شات المعيد ({chats.filter((chat) => chat.type === 'ta').length})
            </button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث في المحادثات..." />
        </div>

        <hr className="divider" style={{ margin: '14px 0' }} />

        {error ? (
          <EmptyState icon={MessagesSquare} title="تعذر تحميل المحادثات" text={error} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title="لا توجد محادثات مطابقة"
            text="اشترك في المواد أولاً، ثم اطلب الانضمام إلى شات المعيد من صفحة المادة."
            action={<Link to="/student/courses" className="btn btn-primary btn-sm"><BookOpen size={15} /> استعراض المواد</Link>}
          />
        ) : (
          <div className="chat-list">
            {visible.map((chat) => (
              <Link to={`/chat/${chat.id}`} key={chat.id} className="chat-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                {chat.type === 'general' ? (
                  <span className="stat-icon tone-blue" style={{ width: 44, height: 44, borderRadius: 14 }}>
                    <GraduationCap size={20} />
                  </span>
                ) : (
                  <Avatar name={chat.taName} src={chat.taAvatar} size={44} />
                )}
                <div className="chat-list-body">
                  <div className="row gap-6 wrap">
                    <strong>{chat.type === 'general' ? `شات ${chat.courseName}` : `شات ${chat.taName}`}</strong>
                    <Badge tone={chat.type === 'general' ? 'primary' : 'accent'} icon={chat.type === 'general' ? Users : MessagesSquare}>
                      {chat.type === 'general' ? 'عام' : 'معيد'}
                    </Badge>
                    {chat.isLocked ? <Badge tone="danger" icon={Lock}>مغلق</Badge> : null}
                  </div>
                  <small>
                    {chat.lastMessage
                      ? `${chat.lastMessage.senderName}: ${chat.lastMessage.body}`
                      : 'لا توجد رسائل بعد — ابدأ النقاش'}
                  </small>
                  <small className="tiny muted" style={{ marginTop: 3 }}>
                    <BookOpen size={11} style={{ verticalAlign: '-1px', marginInlineEnd: 3 }} />
                    {chat.courseName} {chat.courseCode ? `· ${chat.courseCode}` : ''}
                    {chat.sectionDay ? ` · ${chat.sectionDay}` : ''}
                    {chat.sectionTime ? ` · ${chat.sectionTime}` : ''}
                  </small>
                </div>
                <div className="chat-list-meta">
                  <small>{chat.lastMessage ? relativeTime(chat.lastMessage.createdAt) : ''}</small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
