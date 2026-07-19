// Dashboard API. Every route requires a valid Firebase token (requireAuth),
// and is scoped to the caller's company. The dashboard never touches Supabase
// directly — it goes through these endpoints, so the service key stays secret.
import express from 'express';
import { requireAuth, requireOwner } from './auth.js';
import { sendWhatsApp } from './whatsapp.js';
import { clearCompanyCache } from './supa.js';
import * as store from './store.js';

export const api = express.Router();
api.use(requireAuth);

// ---------- current user / company ----------
api.get('/me', async (req, res) => {
  const company = await store.getCompany(req.user.companyId);
  res.json({ user: req.user, company });
});

// ---------- contacts (conversation list) ----------
api.get('/contacts', async (req, res) => {
  res.json(await store.listContacts(req.user.companyId));
});

api.get('/contacts/:id/messages', async (req, res) => {
  const msgs = await store.listMessages(req.user.companyId, req.params.id);
  // mark read
  await store.updateContact(req.user.companyId, req.params.id, { unread: 0 });
  res.json(msgs);
});

api.patch('/contacts/:id', async (req, res) => {
  // update stage, notes, name, ai_enabled (human takeover)
  const allowed = (({ stage, notes, name, ai_enabled }) => ({ stage, notes, name, ai_enabled }))(req.body);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  const c = await store.updateContact(req.user.companyId, req.params.id, allowed);
  res.json(c);
});

// ---------- send a message manually (staff or owner) ----------
api.post('/contacts/:id/send', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Empty message' });
  const contacts = await store.listContacts(req.user.companyId);
  const contact = contacts.find((c) => c.id === req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const ok = await sendWhatsApp(contact.wa_id, text.trim());
  if (!ok) return res.status(502).json({ error: 'WhatsApp send failed' });
  const msg = await store.addMsg(req.user.companyId, contact.id, 'owner', text.trim(), { status: 'sent' });
  await store.logEvent(req.user.companyId, 'manual_reply', { by: req.user.email });
  res.json(msg);
});

// ---------- approvals ----------
api.get('/approvals', async (req, res) => {
  res.json(await store.listApprovals(req.user.companyId, req.query.status || 'pending'));
});

api.post('/approvals/:id/send', async (req, res) => {
  // optionally edit the draft before sending
  const approval = await store.resolveApproval(req.user.companyId, req.params.id, 'sent');
  const text = (req.body.text || approval.draft).trim();
  const waId = approval.contacts?.wa_id;
  const ok = await sendWhatsApp(waId, text);
  if (!ok) return res.status(502).json({ error: 'WhatsApp send failed' });
  await store.addMsg(req.user.companyId, approval.contact_id, 'owner', text, { status: 'sent' });
  await store.logEvent(req.user.companyId, 'approved', { by: req.user.email });
  res.json({ ok: true });
});

api.post('/approvals/:id/reject', async (req, res) => {
  await store.resolveApproval(req.user.companyId, req.params.id, 'rejected');
  res.json({ ok: true });
});

// ---------- analytics ----------
api.get('/stats', async (req, res) => {
  const { events, contacts } = await store.getStats(req.user.companyId, Number(req.query.days) || 30);
  // aggregate server-side into chart-ready shape
  const byDay = {};
  const byType = {};
  const byHour = Array(24).fill(0);
  for (const e of events) {
    const d = e.created_at.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
    byType[e.type] = (byType[e.type] || 0) + 1;
    byHour[new Date(e.created_at).getHours()]++;
  }
  const pipeline = {};
  for (const c of contacts) pipeline[c.stage] = (pipeline[c.stage] || 0) + 1;
  res.json({ byDay, byType, byHour, pipeline, totalContacts: contacts.length });
});

// ---------- knowledge / config editor (owner only) ----------
api.put('/company', requireOwner, async (req, res) => {
  const allowed = (({ name, owner_name, knowledge, greeting, risky_words, hours, ai_enabled }) =>
    ({ name, owner_name, knowledge, greeting, risky_words, hours, ai_enabled }))(req.body);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  const c = await store.updateCompany(req.user.companyId, allowed);
  clearCompanyCache(); // bot picks up new knowledge/greeting immediately
  res.json(c);
});

// ---------- team management (owner only) ----------
api.get('/users', requireOwner, async (req, res) => {
  res.json(await store.listUsers(req.user.companyId));
});

api.post('/users', requireOwner, async (req, res) => {
  // Provision an existing Firebase user (by uid) into this company.
  const { uid, email, name, role } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  const u = await store.upsertUser(uid, {
    company_id: req.user.companyId, email, name, role: role === 'owner' ? 'owner' : 'staff',
  });
  res.json(u);
});
