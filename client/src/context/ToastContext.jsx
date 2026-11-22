import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const remove = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((message, tone = 'success') => {
    const id = counter.current + 1;
    counter.current = id;
    setToasts((items) => [...items, { id, message, tone }]);
    setTimeout(() => remove(id), 4600);
  }, [remove]);

  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info, warning: AlertTriangle };
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = icons[toast.tone] || Info;
          return (
            <div className={`toast toast-${toast.tone}`} key={toast.id}>
              <span className="toast-icon"><Icon size={18} /></span>
              <span className="toast-text">{toast.message}</span>
              <button className="toast-close" onClick={() => remove(toast.id)} aria-label="إغلاق">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
