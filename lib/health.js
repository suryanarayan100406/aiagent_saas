// Service health checks for the dashboard Status page. Each check returns
// { status: 'ok'|'warn'|'down', detail } and never throws — a failing probe is
// itself a result, not an error. Checks run with a short timeout so a hung
// dependency can't stall the status page.
import { supa } from './supa.js';

// fetch with a timeout so a dead endpoint doesn't hang the whole health call.
async function timedFetch(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// The backend itself. If this code runs, the Render service is up.
function checkBackend() {
  const up = Math.round(process.uptime());
  const mins = Math.floor(up / 60);
  return { status: 'ok', detail: `Live — up ${mins >= 1 ? `${mins}m` : `${up}s`}` };
}

// Supabase: a real query against the companies table proves URL + key + reachability.
async function checkDatabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { status: 'down', detail: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' };
  }
  try {
    const { error } = await supa.from('companies').select('id', { count: 'exact', head: true });
    if (error) return { status: 'down', detail: error.message };
    return { status: 'ok', detail: 'Connected' };
  } catch (e) {
    return { status: 'down', detail: e.message };
  }
}

// WhatsApp Cloud API: read the phone number object. Confirms token + phone id are
// valid. A 401/403 usually means an expired token (the classic 24h temp-token bug).
async function checkWhatsApp() {
  const { PHONE_NUMBER_ID, WHATSAPP_TOKEN } = process.env;
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    return { status: 'down', detail: 'PHONE_NUMBER_ID / WHATSAPP_TOKEN not set' };
  }
  try {
    const res = await timedFetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      const hint = code === 190 ? ' (token expired — regenerate)' : '';
      return { status: 'down', detail: `${data?.error?.message || res.status}${hint}` };
    }
    return { status: 'ok', detail: `Connected as ${data.verified_name || data.display_phone_number || 'test number'}` };
  } catch (e) {
    return { status: 'down', detail: e.name === 'AbortError' ? 'Timed out' : e.message };
  }
}

// LLM: at least one Gemini key or an OpenRouter key must be configured. We don't
// send a real prompt here (that burns quota) — we just confirm a provider exists.
function checkLLM() {
  const geminiKeys = [
    process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY_4,
  ].filter(Boolean).length;
  const openrouter = !!process.env.OPENROUTER_API_KEY;
  if (!geminiKeys && !openrouter) {
    return { status: 'down', detail: 'No GEMINI_API_KEY or OPENROUTER_API_KEY set' };
  }
  const parts = [];
  if (geminiKeys) parts.push(`${geminiKeys} Gemini key${geminiKeys > 1 ? 's' : ''}`);
  if (openrouter) parts.push('OpenRouter');
  return { status: 'ok', detail: `${parts.join(' + ')} configured` };
}

// Email alerts (Resend). Optional feature, so a missing key is a warning, not down.
function checkEmail() {
  if (!process.env.RESEND_API_KEY) {
    return { status: 'warn', detail: 'RESEND_API_KEY not set — owner email alerts off' };
  }
  return { status: 'ok', detail: 'Configured' };
}

// Owner contact settings — surfaced so the owner can see at a glance whether
// approval alerts have somewhere to go.
async function checkAlertTargets() {
  try {
    const { data } = await supa.from('companies').select('owner_email, owner_phone').limit(1).single();
    const has = [];
    if (data?.owner_email) has.push('email');
    if (data?.owner_phone) has.push('WhatsApp');
    if (!has.length) return { status: 'warn', detail: 'No owner email or phone set for alerts' };
    return { status: 'ok', detail: `Alerts go to ${has.join(' + ')}` };
  } catch (e) {
    return { status: 'warn', detail: 'Could not read company settings' };
  }
}

// Run every check in parallel. Returns an ordered list for the Status page.
export async function runHealthChecks() {
  const [database, whatsapp, alertTargets] = await Promise.all([
    checkDatabase(), checkWhatsApp(), checkAlertTargets(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    services: [
      { key: 'backend', label: 'Backend (Render)', ...checkBackend() },
      { key: 'database', label: 'Database (Supabase)', ...database },
      { key: 'whatsapp', label: 'WhatsApp Cloud API', ...whatsapp },
      { key: 'llm', label: 'AI model', ...checkLLM() },
      { key: 'email', label: 'Email alerts (Resend)', ...checkEmail() },
      { key: 'alerts', label: 'Owner alert targets', ...alertTargets },
    ],
  };
}
