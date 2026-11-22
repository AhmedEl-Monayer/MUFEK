import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export const homeFor = (role) => ({
  student: '/student',
  doctor: '/doctor',
  ta: '/ta',
  developer: '/admin'
}[role] || '/login');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    platformName: 'منصة هندسة المنوفية',
    facultyName: 'كلية الهندسة',
    universityName: 'جامعة المنوفية',
    supportEmail: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, pub] = await Promise.all([
          api('/auth/me'),
          api('/public/settings')
        ]);
        if (!alive) return;
        setUser(me.user);
        setSettings((current) => ({ ...current, ...pub.settings }));
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const result = await api('/auth/login', { method: 'POST', body: { username, password } });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await api('/auth/me');
    setUser(result.user);
    return result.user;
  }, []);

  const updateUser = useCallback((next) => {
    setUser((current) => (typeof next === 'function' ? next(current) : next));
  }, []);

  return (
    <AuthContext.Provider value={{ user, settings, loading, login, logout, refresh, updateUser, setSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
