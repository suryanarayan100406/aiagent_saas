// Approvals: held drafts (price/booking messages) awaiting owner sign-off.
// Edit the draft inline, then Send or Reject.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Approvals({ onCount }) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const list = await api.approvals();
      setItems(list);
      onCount?.(list.length);
      // seed editable drafts
      setDrafts((d) => {
        const next = { ...d };
        list.forEach((a) => { if (next[a.id] === undefined) next[a.id] = a.draft; });
        return next;
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const act = async (id, kind) => {
    setBusy(id);
    try {
      if (kind === 'send') await api.approveSend(id, drafts[id]);
      else await api.approveReject(id);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <h1>Approvals</h1>
      <div className="sub">Price and booking messages wait here for your sign-off before the bot sends them.</div>

      {items.length === 0 && <div className="card muted">Nothing waiting. The bot is handling routine questions on its own.</div>}

      <div className="grid" style={{ maxWidth: 720 }}>
        {items.map((a) => (
          <div className="card" key={a.id}>
            <div className="muted" style={{ fontSize: 13 }}>
              From {a.contacts?.name || a.contacts?.wa_id} · {new Date(a.created_at).toLocaleString()}
            </div>
            <p style={{ margin: '8px 0' }}><strong>Customer:</strong> {a.customer_text}</p>
            <label>Draft reply (edit before sending)</label>
            <textarea
              rows={4}
              value={drafts[a.id] ?? ''}
              onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn-primary" disabled={busy === a.id} onClick={() => act(a.id, 'send')}>
                Approve & send
              </button>
              <button className="btn-ghost" disabled={busy === a.id} onClick={() => act(a.id, 'reject')}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
