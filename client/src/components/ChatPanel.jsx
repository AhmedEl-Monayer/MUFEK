import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Lock, MessagesSquare, Settings2, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLive } from '../context/LiveContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDay, fmtTime, roleLabel } from '../lib/format.js';
import { Avatar, Badge, Button, EmptyState, IconButton, Modal, Select, Spinner } from './ui.jsx';

export default function ChatPanel({ chatId }) {
  const { user } = useAuth();
  const { subscribe } = useLive();
  const { push } = useToast();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState('all');
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api(`/chats/${chatId}/messages?limit=100`);
      setChat(data.chat);
      setMessages(data.messages || []);
      setMode(data.chat.writeMode);
      setLocked(data.chat.isLocked);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    setChat(null);
    setMessages([]);
    setText('');
    load();
  }, [chatId, load]);

  useEffect(() => {
    const element = bodyRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => subscribe('message', (payload) => {
    if (Number(payload.chatId) !== Number(chatId)) return;
    setMessages((current) => (
      current.some((item) => item.id === payload.message.id) ? current : [...current, payload.message]
    ));
  }), [subscribe, chatId]);

  useEffect(() => subscribe('chat:update', (payload) => {
    if (Number(payload.chat?.id) !== Number(chatId)) return;
    setChat(payload.chat);
    setMode(payload.chat.writeMode);
    setLocked(payload.chat.isLocked);
  }), [subscribe, chatId]);

  const send = async (event) => {
    event?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await api(`/chats/${chatId}/messages`, { method: 'POST', body: { body } });
      setMessages((current) => (
        current.some((item) => item.id === result.message.id) ? current : [...current, result.message]
      ));
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const result = await api(`/chats/${chatId}`, { method: 'PATCH', body: { writeMode: mode, isLocked: locked } });
      setChat(result.chat);
      push('تم تحديث إعدادات المحادثة');
      setSettingsOpen(false);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="chat-shell">
        <div className="full-loader" style={{ minHeight: 360 }}><Spinner label="جارٍ تحميل المحادثة..." /></div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="chat-shell">
        <EmptyState
          icon={MessagesSquare}
          title="لا يمكن فتح المحادثة"
          text={error || 'تحقق من صلاحياتك أو اطلب الانضمام أولاً.'}
        />
      </div>
    );
  }

  const isGeneral = chat.type === 'general';
  const title = isGeneral ? 'الشات العام' : `شات ${chat.taName || 'المعيد'}`;
  const subtitle = isGeneral
    ? `${chat.courseName} · ${chat.doctorName}`
    : `${chat.courseName}${chat.sectionDay ? ` · ${chat.sectionDay}` : ''}${chat.sectionTime ? ` · ${chat.sectionTime}` : ''}`;
  const readOnlyReason = chat.isLocked
    ? 'المحادثة مغلقة مؤقتاً بواسطة إدارة المادة.'
    : chat.writeMode === 'readonly'
      ? 'هذه المحادثة للقراءة فقط حالياً.'
      : chat.writeMode === 'staff'
        ? 'الكتابة متاحة لهيئة التدريس فقط.'
        : 'لا يمكنك إرسال رسائل في هذه المحادثة.';

  let lastDay = '';

  return (
    <div className="chat-shell">
      <div className="chat-head">
        <div className="chat-head-start">
          {isGeneral ? (
            <span className="stat-icon tone-blue" style={{ width: 42, height: 42 }}><MessagesSquare size={20} /></span>
          ) : (
            <Avatar name={chat.taName} src={chat.taAvatar} size={42} />
          )}
          <div className="chat-head-info">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
          {chat.isLocked ? <Badge tone="danger" icon={Lock}>مغلق</Badge> : null}
          {!chat.isLocked && chat.writeMode === 'readonly' ? <Badge tone="warning">قراءة فقط</Badge> : null}
        </div>
        <div className="chat-head-actions">
          <Badge tone="neutral" icon={Users}>{chat.type === 'general' ? 'أعضاء المادة' : 'أعضاء السكشن'}</Badge>
          {chat.canManage ? (
            <IconButton icon={Settings2} label="إعدادات المحادثة" onClick={() => setSettingsOpen(true)} />
          ) : null}
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-icon"><MessagesSquare size={26} /></span>
            <h4>ابدأ المحادثة</h4>
            <p>لا توجد رسائل بعد. اكتب أول رسالة لبدء النقاش الأكاديمي.</p>
          </div>
        ) : messages.map((message) => {
          const day = fmtDay(message.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.id} style={{ display: 'contents' }}>
              {showDay ? <div className="chat-day">{day}</div> : null}
              <div className={`msg ${message.isMine ? 'mine' : 'other'}`}>
                {!message.isMine ? (
                  <Avatar className="msg-avatar" name={message.sender.fullName} src={message.sender.avatar} size={30} />
                ) : null}
                <div className="msg-body">
                  {!message.isMine ? (
                    <div className="msg-name">
                      {message.sender.fullName}
                      <span className="chat-badge">{roleLabel(message.sender.role)}</span>
                    </div>
                  ) : null}
                  <div className="bubble">{message.body}</div>
                  <div className="msg-time">{fmtTime(message.createdAt)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {chat.canWrite ? (
        <form className="composer" onSubmit={send}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            maxLength={2000}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(event);
              }
            }}
          />
          <Button type="submit" icon={ArrowUp} loading={sending} aria-label="إرسال" />
        </form>
      ) : (
        <div className="chat-readonly"><Lock size={15} /> {readOnlyReason}</div>
      )}

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="إعدادات المحادثة"
        subtitle="تحكم في صلاحية الكتابة وإغلاق المحادثة مؤقتاً."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>إلغاء</Button>
            <Button icon={ShieldCheck} loading={saving} onClick={saveSettings}>حفظ الإعدادات</Button>
          </>
        )}
      >
        <div className="chat-settings-grid">
          <label className="field">
            <span className="field-label">صلاحية الكتابة</span>
            <Select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="all">الجميع (هيئة التدريس والطلاب)</option>
              <option value="staff">هيئة التدريس فقط</option>
              <option value="readonly">قراءة فقط للجميع</option>
            </Select>
          </label>
          <div className="chat-lock">
            <div>
              <strong style={{ fontSize: 12.5 }}>إغلاق المحادثة مؤقتاً</strong>
              <div className="small muted">لن يستطيع أحد إرسال رسائل حتى إعادة الفتح.</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} />
              <span />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
