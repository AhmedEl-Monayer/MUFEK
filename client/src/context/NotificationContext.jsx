import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useLive } from './LiveContext.jsx';
import { useToast } from './ToastContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { subscribe } = useLive();
  const { push: pushToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api('/notifications?limit=40');
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) load();
    else {
      setNotifications([]);
      setUnread(0);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribe('notification', (item) => {
      setNotifications((current) => [item, ...current.filter((n) => n.id !== item.id)].slice(0, 40));
      setUnread((count) => count + 1);
      if (item.type !== 'message') pushToast(item.title, 'info');
    });
  }, [subscribe, user?.id, pushToast]);

  const markRead = useCallback(async (id) => {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((count) => Math.max(0, count - 1));
    try { await api(`/notifications/${id}/read`, { method: 'POST' }); } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try { await api('/notifications/read-all', { method: 'POST' }); } catch { /* ignore */ }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unread, loading, load, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
