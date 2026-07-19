// Team management (owner only). The backend creates the teammate's Firebase login
// (Admin SDK) and provisions them into this company in one step — the owner just
// enters email + password + role here. We show the current team and an add form.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Team({ me }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'staff' });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(null); setMsg(null);
    if (!form.email.trim()) { setErr('Email is required'); return; }
    if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    try {
      await api.addUser(form);
      setMsg('Teammate added. Share their email and password so they can sign in.');
      setForm({ email: '', password: '', name: '', role: 'staff' });
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (u) => {
    setErr(null); setMsg(null);
    if (!window.confirm(`Remove ${u.name || u.email || 'this teammate'}? Their login will be deleted.`)) return;
    try {
      await api.deleteUser(u.id);
      setMsg('Teammate removed.');
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
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`pill ${u.role === 'owner' ? 'won' : 'new'}`}>{u.role}</span></td>
                <td style={{ textAlign: 'right' }}>
                  {u.id === me?.uid
                    ? <span className="muted" style={{ fontSize: 12 }}>you</span>
                    : <button className="btn-danger" onClick={() => remove(u)}
                        style={{ padding: '4px 12px', fontSize: 13 }}>Remove</button>}
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={4} className="muted">No team members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a teammate</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Enter their email, a starting password, and role. Their login is created
          automatically — share the email and password so they can sign in and change it.
        </p>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="teammate@email.com" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Password</label>
            <input type="text" value={form.password} onChange={set('password')}
              placeholder="min 6 characters" />
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
