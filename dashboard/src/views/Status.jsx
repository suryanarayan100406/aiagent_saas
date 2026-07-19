// Status page (owner only): pings each backend service and shows a live
// health board — is Render up, is the DB reachable, is the WhatsApp token valid,
// is an AI model configured, are alerts wired up. Refresh re-runs the checks.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const DOT = { ok: '🟢', warn: '🟡', down: '🔴' };
const LABEL = { ok: 'Operational', warn: 'Attention', down: 'Down' };

export default function Status() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      setData(await api.health());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const services = data?.services || [];
  const worst = services.some((s) => s.status === 'down') ? 'down'
    : services.some((s) => s.status === 'warn') ? 'warn' : 'ok';

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1>System Status</h1>
      <div className="sub">Live check of every service the bot depends on.</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {data ? `${DOT[worst]} ${worst === 'ok' ? 'All systems operational' : worst === 'warn' ? 'Running with warnings' : 'Something is down'}` : 'Checking…'}
          </div>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh'}
          </button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Service</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{DOT[s.status]} {LABEL[s.status]}</td>
                <td className="muted">{s.detail}</td>
              </tr>
            ))}
            {!services.length && !err && (
              <tr><td colSpan={3} className="muted">Running checks…</td></tr>
            )}
          </tbody>
        </table>
        {data && (
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Last checked {new Date(data.checkedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
