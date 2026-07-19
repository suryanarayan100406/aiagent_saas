// Team management (owner only). Firebase Auth holds the actual login credentials,
// so adding a teammate is two steps: (1) create their Firebase user, (2) link that
// user's UID to this company here. We show the current team and a link form.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Team() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ uid: '', email: '', name: '', role: 'staff' });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(null); setMsg(null);
    if (!form.uid.trim()) { setErr('Firebase UID is required'); return; }
    try {
      await api.addUser(form);
      setMsg('Teammate linked.');
      setForm({ uid: '', email: '', name: '', role: 'staff' });
      load();
    } catch (e) { setErr(e.message); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>Team</h1>
      <div className="sub">Owners manage knowledge, billing, and staff. Staff can reply and manage leads.</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`pill ${u.role === 'owner' ? 'won' : 'new'}`}>{u.role}</span></td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={3} className="muted">No team members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a teammate</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          First create their login in Firebase Console → Authentication → Add user
          (email + password). Copy their <b>User UID</b> and paste it below.
        </p>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Firebase UID</label>
            <input value={form.uid} onChange={set('uid')} placeholder="paste UID" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Email</label>
            <input value={form.email} onChange={set('email')} />
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Name</label>
            <input value={form.name} onChange={set('name')} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn-primary" onClick={add}>Add teammate</button>
          {msg && <span className="muted">{msg}</span>}
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    </div>
  );
}
