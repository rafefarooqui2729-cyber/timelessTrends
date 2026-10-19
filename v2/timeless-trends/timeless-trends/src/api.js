async function req(method, url, body, form) {
  const r = await fetch(url, { method, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'tt', ...(body && !form ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (form ? body : JSON.stringify(body)) : undefined });
  let data = null; try { data = await r.json(); } catch { /* non-JSON */ }
  if (!r.ok) { const e = new Error(data?.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return data;
}
export const api = {
  get: (u) => req('GET', u), post: (u, b) => req('POST', u, b || {}), put: (u, b) => req('PUT', u, b),
  patch: (u, b) => req('PATCH', u, b), del: (u) => req('DELETE', u), upload: (u, fd) => req('POST', u, fd, true),
};
