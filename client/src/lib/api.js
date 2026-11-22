export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const options = { method, credentials: 'include', signal, headers: {} };
  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, options);
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new ApiError(data?.error || 'حدث خطأ غير متوقع', response.status, data?.code);
  }
  return data;
}

export const fileUrl = (path) => (path ? (path.startsWith('/api') ? path : `/api${path}`) : null);
