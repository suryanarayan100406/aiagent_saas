import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generate } from './lib/llm.js';
import { sendWhatsApp } from './lib/whatsapp.js';
import { getCompany } from './lib/supa.js';
import { api } from './lib/routes.js';
import * as store from './lib/store.js';

const { VERIFY_TOKEN, PORT = 3000 } = process.env;

const BASE_RISKY = /price|cost|quote|quotation|deposit|pay|invoice|confirm|book|when can you|guarantee|discount|kitna|kharcha|rate|paisa|advance|booking|\$|£|₹|€/i;
const BARE_GREETING = /^\s*(hi+|hey+|hello+|namaste|namaskar|hii+|start|yo)\b[\s!.]*$/i;

// Build the system prompt from the company's live knowledge (edited via dashboard).
function buildSystemPrompt(company) {
  return `You are the assistant replying on behalf of ${company.owner_name || 'the owner'} of
${company.name}, a construction contractor, via WhatsApp. Reply in their voice:
warm, respectful, brief, and practical — like a helpful contractor texting.
Keep replies short (1-4 sentences).

IMPORTANT — language: reply in the SAME language the customer used. If they write
in Hindi, reply in Hindi; if English, reply in English; Hinglish is fine. Never
switch to a language the customer did not use. Do NOT use Western slang like "G'day".

Use ONLY the info below. NEVER invent prices, dates, or promises. If asked for a
price or to commit to anything, steer toward booking a free site visit. If unsure,
say you'll check with ${company.owner_name || 'the owner'} and get back to them.

BUSINESS INFO:
${company.knowledge || ''}`;
}

function riskyMatcher(company) {
  const extra = (company.risky_words || '')
    .split(',').map((w) => w.trim()).filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!extra.length) return BASE_RISKY;
  return new RegExp(`${BASE_RISKY.source}|${extra.join('|')}`, 'i');
}

const app = express();
app.use(cors());
app.use(express.json());

// Dashboard API (Firebase-authenticated).
app.use('/api', api);

// --- Webhook verification ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified.');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// --- Incoming messages ---
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack immediately

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;

    const from = msg.from;
    const text = msg.text.body;
    const profileName = value?.contacts?.[0]?.profile?.name;

    const company = await getCompany();
    const contact = await store.getOrCreateContact(company.id, from, profileName);

    // Log the inbound customer message.
    await store.addMsg(company.id, contact.id, 'user', text, { wamid: msg.id });
    await store.logEvent(company.id, 'inbound', {});

    // Human takeover: if AI is off for this contact or company, don't auto-reply.
    if (company.ai_enabled === false || contact.ai_enabled === false) {
      console.log('AI disabled for this contact/company — leaving for human.');
      return;
    }

    // Bare greeting ("hi", "namaste", ...) -> always reply with the branded
    // greeting the owner set in the dashboard, then stop. A bare greeting has no
    // real content to answer, so the saved welcome is the right response every
    // time — not just on the customer's first-ever message.
    if (BARE_GREETING.test(text) && company.greeting) {
      await sendWhatsApp(from, company.greeting);
      await store.addMsg(company.id, contact.id, 'assistant', company.greeting);
      return;
    }

    // Build prompt with recent thread context.
    const recent = await store.getRecentMessages(contact.id, 12);
    const convo = recent
      .map((m) => `${m.role === 'user' ? 'Customer' : 'You'}: ${m.text}`)
      .join('\n');

    const { text: reply, provider } = await generate(
      `${buildSystemPrompt(company)}\n\nConversation so far:\n${convo}\n\nYou:`
    );

    const RISKY = riskyMatcher(company);
    if (RISKY.test(text)) {
      // Hold for owner approval — appears in the dashboard Approvals tab.
      await store.addMsg(company.id, contact.id, 'assistant', reply, { status: 'held', provider });
      await store.createApproval(company.id, contact.id, text, reply);
      await store.logEvent(company.id, 'held', { provider });
      console.log('Held for approval:', from);

      // Tell the customer their query has been passed on, so they're not left
      // waiting in silence for a reply that's pending owner approval.
      const ack = company.hold_ack ||
        `Thanks for your message 🙏 ${company.owner_name || 'The owner'} will get back to you personally on this shortly.`;
      await sendWhatsApp(from, ack);
      await store.addMsg(company.id, contact.id, 'assistant', ack, { status: 'sent' });

      // Also ping the owner on WhatsApp so they don't have to watch the dashboard.
      if (company.owner_phone) {
        const who = contact.name || from;
        const alert =
          `🔔 Approval needed — ${company.name}\n\n` +
          `From ${who}:\n"${text}"\n\n` +
          `Draft reply:\n"${reply}"\n\n` +
          `Open the dashboard to send, edit, or reject.`;
        const sent = await sendWhatsApp(company.owner_phone, alert);
        console.log(sent ? `Owner alert sent to ${company.owner_phone}` : `Owner alert FAILED to ${company.owner_phone}`);
      } else {
        console.log('No owner_phone set — skipping owner alert. Set it in Knowledge & Settings.');
      }
    } else {
      const ok = await sendWhatsApp(from, reply);
      await store.addMsg(company.id, contact.id, 'assistant', reply, {
        status: ok ? 'sent' : 'failed', provider,
      });
      await store.logEvent(company.id, 'auto_reply', { provider });
    }
  } catch (err) {
    console.error('Handler error:', err);
  }
});

app.get('/', (_req, res) => res.send('Cura WA agent running.'));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
