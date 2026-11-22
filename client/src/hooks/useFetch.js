import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

export function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!url) {
      setData(null);
      setLoading(false);
      return null;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await api(url);
      if (alive.current) setData(result);
      return result;
    } catch (err) {
      if (alive.current) setError(err.message);
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { data, loading, error, reload, setData };
}
