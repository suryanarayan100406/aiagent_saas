// Email alerts (owner notifications) via Resend's REST API — no SDK needed, just
// fetch. Free tier is enough for approval pings. Set two env vars on Render:
//   RESEND_API_KEY  — from resend.com (free)
//   ALERT_FROM      — a verified sender, e.g. "Cura <onboarding@resend.dev>"
// (Resend's shared onboarding@resend.dev works out of the box for testing.)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_FROM = process.env.ALERT_FROM || 'Cura <onboarding@resend.dev>';

// Send a plain-text email. Returns true on success, false on failure. Never throws
// — a failed alert must not break the webhook handler.
export async function sendEmail(to, subject, text) {
  if (!RESEND_API_KEY) {
    console.log('No RESEND_API_KEY set — skipping email alert.');
    return false;
  }
  if (!to) {
    console.log('No recipient email — skipping email alert.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: ALERT_FROM, to, subject, text }),
    });
    if (!res.ok) {
      console.error('Email send failed:', res.status, await res.text());
      return false;
    }
    console.log('Email alert sent to', to);
    return true;
  } catch (e) {
    console.error('Email send error:', e.message);
    return false;
  }
}
