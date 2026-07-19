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

// The backend itself. If this code runs, the service is up.
function checkBackend() {
  return { status: 'ok', detail: 'Running' };
}

// A real query proves the data store is reachable.
async function checkDatabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { status: 'down', detail: 'Not configured — contact support' };
  }
  try {
    const { error } = await supa.from('companies').select('id', { count: 'exact', head: true });
    if (error) return { status: 'down', detail: 'Not reachable' };
    return { status: 'ok', detail: 'Connected' };
  } catch (e) {
    return { status: 'down', detail: 'Not reachable' };
  }
}

// WhatsApp Cloud API: read the phone number object. Confirms token + phone id are
// valid. A 401/403 usually means an expired token (the classic 24h temp-token bug).
async function checkWhatsApp() {
  const { PHONE_NUMBER_ID, WHATSAPP_TOKEN } = process.env;
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    return { status: 'down', detail: 'Not connected' };
  }
  try {
    const res = await timedFetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Code 190 = expired/invalid access token — the most common real issue.
      const detail = data?.error?.code === 190
        ? 'Connection expired — needs reconnecting'
        : 'Not connected';
      return { status: 'down', detail };
    }
    return { status: 'ok', detail: `Connected — ${data.verified_name || data.display_phone_number || 'business number'}` };
  } catch (e) {
    return { status: 'down', detail: e.name === 'AbortError' ? 'Not responding' : 'Not connected' };
  }
}

// AI: confirm a provider is configured. We don't send a real prompt here (that
// burns quota) — we just confirm the assistant has something to run on.
function checkLLM() {
  const configured = [
    process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY_4,
    process.env.OPENROUTER_API_KEY,
  ].some(Boolean);
  if (!configured) return { status: 'down', detail: 'Not configured — contact support' };
  return { status: 'ok', detail: 'Ready' };
}

// Email alerts. Optional feature, so a missing key is a warning, not down.
function checkEmail() {
  if (!process.env.RESEND_API_KEY) {
    return { status: 'warn', detail: 'Off' };
  }
  return { status: 'ok', detail: 'On' };
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
      { key: 'backend', label: 'Service', ...checkBackend() },
      { key: 'database', label: 'Data storage', ...database },
      { key: 'whatsapp', label: 'WhatsApp', ...whatsapp },
      { key: 'llm', label: 'AI assistant', ...checkLLM() },
      { key: 'email', label: 'Email alerts', ...checkEmail() },
      { key: 'alerts', label: 'Approval alerts', ...alertTargets },
    ],
  };
}
