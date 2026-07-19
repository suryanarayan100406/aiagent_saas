// Leads pipeline: a kanban board of contacts by stage. Move a lead with the
// stage buttons; click to edit notes. Stages: new → visit → quoted → won / lost.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'visit', label: 'Site Visit' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];
const NEXT = { new: 'visit', visit: 'quoted', quoted: 'won' };

export default function Pipeline() {
  const [contacts, setContacts] = useState([]);
  const [sel, setSel] = useState(null);

  const load = async () => {
    try { setContacts(await api.contacts()); } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const move = async (c, stage) => {
    await api.updateContact(c.id, { stage });
    load();
  };
  const saveNotes = async () => {
    await api.updateContact(sel.id, { notes: sel.notes, name: sel.name });
    setSel(null);
    load();
  };

  return (
    <div className="page">
      <h1>Leads</h1>
      <div className="sub">Every customer who messages becomes a lead. Move them through your pipeline.</div>

      <div className="board">
        {STAGES.map((s) => {
          const col = contacts.filter((c) => (c.stage || 'new') === s.id);
          return (
            <div className="col" key={s.id}>
              <h3>{s.label} · {col.length}</h3>
              {col.map((c) => (
                <div className="lead" key={c.id} onClick={() => setSel({ ...c })}>
                  <div className="name">{c.name || c.wa_id}</div>
                  <div className="prev">{c.last_message}</div>
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    {NEXT[s.id] && (
                      <button className="btn-primary" style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={(e) => { e.stopPropagation(); move(c, NEXT[s.id]); }}>
                        → {STAGES.find((x) => x.id === NEXT[s.id]).label}
                      </button>
                    )}
                    {s.id !== 'lost' && s.id !== 'won' && (
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={(e) => { e.stopPropagation(); move(c, 'lost'); }}>
                        Lost
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {col.length === 0 && <div className="muted" style={{ fontSize: 12 }}>—</div>}
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 50 }}
          onClick={() => setSel(null)}>
          <div className="card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 18 }}>Lead details</h1>
            <label>Name</label>
            <input value={sel.name || ''} onChange={(e) => setSel({ ...sel, name: e.target.value })} />
            <label>Phone</label>
            <input value={sel.wa_id} disabled />
            <label>Notes</label>
            <textarea rows={4} value={sel.notes || ''} onChange={(e) => setSel({ ...sel, notes: e.target.value })} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={saveNotes}>Save</button>
              <button className="btn-ghost" onClick={() => setSel(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
