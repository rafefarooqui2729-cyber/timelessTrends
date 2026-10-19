/**
 * TIMELESS TRENDS - Admin Dashboard API Client
 */

export async function api(endpoint, options = {}) {
  const { method = 'GET', body, isFormData = false } = options;

  const headers = {
    'X-Requested-With': 'tt'
  };

  if (!isFormData && body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
  });

  if (res.status === 204) return null;

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = (typeof data === 'object' && data?.error) ? data.error : (typeof data === 'string' && data ? data : `Request failed (${res.status})`);
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default api;
