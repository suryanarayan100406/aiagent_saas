// Knowledge editor (owner only): edit the bot's brain, greeting, hours, and the
// extra risky-word list. Saving updates the backend, which the bot reads live.
import { useState } from 'react';
import { api } from '../api.js';

export default function Knowledge({ company }) {
  const [form, setForm] = useState({
    name: company.name || '',
    owner_name: company.owner_name || '',
    hours: company.hours || '',
    knowledge: company.knowledge || '',
    greeting: company.greeting || '',
    risky_words: company.risky_words || '',
    owner_phone: company.owner_phone || '',
    owner_email: company.owner_email || '',
    ai_enabled: company.ai_enabled !== false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await api.updateCompany(form);
      setSaved(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1>Knowledge & Settings</h1>
      <div className="sub">This is the bot's brain. Changes apply to new replies immediately.</div>

      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Business name</label>
            <input value={form.name} onChange={set('name')} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Owner name</label>
            <input value={form.owner_name} onChange={set('owner_name')} />
          </div>
        </div>

        <label>Working hours</label>
        <input value={form.hours} onChange={set('hours')} />

        <label>Business knowledge (services, area, FAQ, pricing rules)</label>
        <textarea rows={10} value={form.knowledge} onChange={set('knowledge')} />

        <label>Greeting for new customers</label>
        <textarea rows={4} value={form.greeting} onChange={set('greeting')} />

        <label>Extra "risky" words (comma-separated — these get held for approval)</label>
        <input value={form.risky_words} onChange={set('risky_words')}
          placeholder="e.g. emi, loan, gst" />

        <label>Owner email (alerted when a reply is held for approval — reliable)</label>
        <input type="email" value={form.owner_email} onChange={set('owner_email')}
          placeholder="e.g. owner@email.com" />

        <label>Owner WhatsApp number (best-effort alert; only lands within a 24h window)</label>
        <input value={form.owner_phone} onChange={set('owner_phone')}
          placeholder="e.g. 919026390923 (country code, no + or spaces)" />

        <label style={{ textTransform: 'none', marginTop: 18 }}>
          <input type="checkbox" checked={form.ai_enabled} onChange={set('ai_enabled')}
            style={{ width: 'auto', marginRight: 8 }} />
          Bot auto-replies enabled (turn off to handle everything manually)
        </label>

        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="muted">✓ Saved</span>}
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    </div>
  );
}
