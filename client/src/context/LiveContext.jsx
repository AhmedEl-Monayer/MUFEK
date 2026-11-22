import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';

const LiveContext = createContext({ subscribe: () => () => {} });

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const listeners = useRef(new Map());

  useEffect(() => {
    if (!user) return undefined;
    const source = new EventSource('/api/events');
    const handlers = {};
    const types = ['notification', 'message', 'chat:update'];
    types.forEach((type) => {
      handlers[type] = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        const set = listeners.current.get(type);
        if (set) {
          for (const fn of set) {
            try { fn(payload); } catch { /* listener errors should not break the stream */ }
          }
        }
      };
      source.addEventListener(type, handlers[type]);
    });
    return () => {
      types.forEach((type) => source.removeEventListener(type, handlers[type]));
      source.close();
    };
  }, [user?.id]);

  const subscribe = useCallback((type, fn) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set());
    listeners.current.get(type).add(fn);
    return () => {
      listeners.current.get(type)?.delete(fn);
    };
  }, []);

  return <LiveContext.Provider value={{ subscribe }}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
