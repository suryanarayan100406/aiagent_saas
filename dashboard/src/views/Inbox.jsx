// Live inbox: conversation list + thread view. Polls every few seconds so new
// customer messages and bot replies appear without a refresh.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function Inbox() {
  const [contacts, setContacts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  // Poll the contact list.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list = await api.contacts();
        if (alive) setContacts(list);
      } catch { /* ignore transient */ }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Poll the open thread.
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    const load = async () => {
      try {
        const msgs = await api.messages(activeId);
        if (alive) setMessages(msgs);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [activeId]);

  // Auto-scroll to newest.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const active = contacts.find((c) => c.id === activeId);

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      await api.send(activeId, draft.trim());
      setDraft('');
      setMessages(await api.messages(activeId));
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`inbox ${activeId ? 'has-active' : ''}`}>
      <div className="conv-list">
        {contacts.length === 0 && <div className="conv muted">No conversations yet.</div>}
        {contacts.map((c) => (
          <div
            key={c.id}
            className={`conv ${c.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            <div className="top">
              <span className="name">{c.name || c.wa_id}</span>
              {c.unread > 0 && <span className="unread">{c.unread}</span>}
            </div>
            <div className="preview">{c.last_message || '—'}</div>
          </div>
        ))}
      </div>

      {active ? (
        <div className="thread">
          <div className="thread-head">
            <button className="thread-back" onClick={() => setActiveId(null)} aria-label="Back to conversations">‹</button>
            <strong>{active.name || active.wa_id}</strong>
            <span className={`pill ${active.stage}`}>{active.stage}</span>
            <span className="muted">{active.wa_id}</span>
          </div>
          <div className="thread-body" ref={bodyRef}>
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role} ${m.status === 'held' ? 'held' : ''}`}>
                {m.text}
                <div className="meta">
                  {m.status === 'held' ? '⏸ held for approval · ' : ''}
                  {new Date(m.created_at).toLocaleString()}
                  {m.provider ? ` · ${m.provider}` : ''}
                </div>
              </div>
            ))}
          </div>
          <div className="composer">
            <input
              placeholder="Type a reply…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn-primary" onClick={send} disabled={sending}>
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <div className="center muted">Select a conversation</div>
      )}
    </div>
  );
}
