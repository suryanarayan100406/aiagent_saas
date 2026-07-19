// Tiny API client. Attaches the current Firebase ID token to every request so the
// backend can verify who's calling. All data flows through the backend, never
// directly to Supabase.
import { auth } from './firebase.js';

const BASE = import.meta.env.VITE_API_BASE || '';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  me: () => req('GET', '/me'),
  contacts: () => req('GET', '/contacts'),
  messages: (id) => req('GET', `/contacts/${id}/messages`),
  updateContact: (id, patch) => req('PATCH', `/contacts/${id}`, patch),
  send: (id, text) => req('POST', `/contacts/${id}/send`, { text }),
  approvals: () => req('GET', '/approvals'),
  approveSend: (id, text) => req('POST', `/approvals/${id}/send`, { text }),
  approveReject: (id) => req('POST', `/approvals/${id}/reject`),
  stats: (days = 30) => req('GET', `/stats?days=${days}`),
  updateCompany: (patch) => req('PUT', '/company', patch),
  users: () => req('GET', '/users'),
  addUser: (u) => req('POST', '/users', u),
};
