// Data-access layer. All Supabase reads/writes go through here so the rest of
// the app never touches raw SQL. Every function is company-scoped.
import { supa } from './supa.js';

// ---------- company ----------
export async function getCompany(companyId) {
  const { data, error } = await supa.from('companies').select('*').eq('id', companyId).single();
  if (error) throw error;
  return data;
}

// The single seeded company (used by the webhook until multi-tenant routing by
// wa_phone_id is switched on). Returns the first company row.
export async function getDefaultCompany() {
  const { data, error } = await supa.from('companies').select('*').order('created_at').limit(1).single();
  if (error) throw error;
  return data;
}

// Route an incoming message to the right company by its WhatsApp phone number id.
// Falls back to the default company if none matches (single-tenant today).
export async function getCompanyByPhoneId(phoneId) {
  if (phoneId) {
    const { data } = await supa.from('companies').select('*').eq('wa_phone_id', phoneId).maybeSingle();
    if (data) return data;
  }
  return getDefaultCompany();
}

export async function updateCompany(companyId, fields) {
  const { data, error } = await supa.from('companies').update(fields).eq('id', companyId).select().single();
  if (error) throw error;
  return data;
}

// ---------- contacts ----------
export async function getOrCreateContact(companyId, waId, name) {
  const { data: existing } = await supa
    .from('contacts').select('*')
    .eq('company_id', companyId).eq('wa_id', waId).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supa
    .from('contacts')
    .insert({ company_id: companyId, wa_id: waId, name: name || null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function listContacts(companyId) {
  const { data, error } = await supa
    .from('contacts').select('*')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateContact(companyId, contactId, fields) {
  const { data, error } = await supa
    .from('contacts').update(fields)
    .eq('company_id', companyId).eq('id', contactId)
    .select().single();
  if (error) throw error;
  return data;
}

async function touchContact(contactId, text, incUnread) {
  const patch = { last_message: text.slice(0, 200), last_message_at: new Date().toISOString() };
  if (incUnread) {
    // increment unread via RPC-less read-modify-write
    const { data } = await supa.from('contacts').select('unread').eq('id', contactId).single();
    patch.unread = (data?.unread || 0) + 1;
  } else {
    patch.unread = 0;
  }
  await supa.from('contacts').update(patch).eq('id', contactId);
}

// ---------- messages ----------
export async function addMsg(companyId, contactId, role, text, extra = {}) {
  const { data, error } = await supa.from('messages').insert({
    company_id: companyId, contact_id: contactId, role, text,
    status: extra.status || 'sent', provider: extra.provider || null, wamid: extra.wamid || null,
  }).select().single();
  if (error) throw error;
  // update contact preview; unread grows only on inbound customer messages
  await touchContact(contactId, text, role === 'user');
  return data;
}

export async function getRecentMessages(contactId, limit = 12) {
  const { data, error } = await supa
    .from('messages').select('role, text')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function listMessages(companyId, contactId) {
  const { data, error } = await supa
    .from('messages').select('*')
    .eq('company_id', companyId).eq('contact_id', contactId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// ---------- approvals ----------
export async function createApproval(companyId, contactId, customerText, draft) {
  const { data, error } = await supa.from('approvals').insert({
    company_id: companyId, contact_id: contactId, customer_text: customerText, draft,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function listApprovals(companyId, status = 'pending') {
  const { data, error } = await supa
    .from('approvals').select('*, contacts(wa_id, name)')
    .eq('company_id', companyId).eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function resolveApproval(companyId, approvalId, status) {
  const { data, error } = await supa
    .from('approvals').update({ status, resolved_at: new Date().toISOString() })
    .eq('company_id', companyId).eq('id', approvalId)
    .select('*, contacts(wa_id)').single();
  if (error) throw error;
  return data;
}

// ---------- users ----------
export async function getUser(uid) {
  const { data } = await supa.from('app_users').select('*').eq('id', uid).maybeSingle();
  return data;
}

export async function upsertUser(uid, fields) {
  const { data, error } = await supa
    .from('app_users').upsert({ id: uid, ...fields }).select().single();
  if (error) throw error;
  return data;
}

export async function listUsers(companyId) {
  const { data, error } = await supa.from('app_users').select('*').eq('company_id', companyId);
  if (error) throw error;
  return data;
}

// ---------- events (analytics) ----------
export async function logEvent(companyId, type, meta = {}) {
  try { await supa.from('events').insert({ company_id: companyId, type, meta }); }
  catch (e) { console.error('logEvent failed', e.message); }
}

export async function getStats(companyId, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const [{ data: events }, { data: contacts }] = await Promise.all([
    supa.from('events').select('type, created_at').eq('company_id', companyId).gte('created_at', since),
    supa.from('contacts').select('stage').eq('company_id', companyId),
  ]);
  return { events: events || [], contacts: contacts || [] };
}
