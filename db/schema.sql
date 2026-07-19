-- Balaji Construction / Cura WhatsApp AI — Supabase schema
-- Run this once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Multi-tenant ready: every row is namespaced by company_id, so adding a
-- second company later needs no schema change.

-- ---------- companies ----------
create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_name    text,
  knowledge     text default '',              -- the bot's brain (services, area, FAQ)
  greeting      text default '',              -- first-message welcome
  risky_words   text default '',              -- comma-separated extra trigger words
  hours         text default '24x7',
  wa_phone_id   text,                         -- WhatsApp phone number ID (per company)
  ai_enabled    boolean default true,         -- master on/off for auto-replies
  created_at    timestamptz default now()
);

-- ---------- contacts (one per customer WhatsApp number) ----------
create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  wa_id           text not null,              -- customer's WhatsApp number
  name            text,
  stage           text default 'new',         -- new|visit|quoted|won|lost
  notes           text default '',
  last_message    text default '',
  last_message_at timestamptz default now(),
  unread          int default 0,
  ai_enabled      boolean default true,       -- per-contact bot toggle (human takeover)
  created_at      timestamptz default now(),
  unique (company_id, wa_id)
);

-- ---------- messages ----------
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  role         text not null,                 -- user|assistant|owner
  text         text not null,
  status       text default 'sent',           -- sent|held|failed
  provider     text,                          -- which LLM answered (for analytics)
  wamid        text,                           -- WhatsApp message id
  created_at   timestamptz default now()
);

-- ---------- approvals (held drafts awaiting owner) ----------
create table if not exists approvals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  customer_text text not null,
  draft         text not null,
  status        text default 'pending',       -- pending|sent|rejected
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);

-- ---------- app_users (dashboard logins; id = Firebase UID) ----------
create table if not exists app_users (
  id          text primary key,               -- Firebase Auth UID
  company_id  uuid references companies(id) on delete cascade,
  email       text,
  name        text,
  role        text default 'staff',           -- owner|staff
  created_at  timestamptz default now()
);

-- ---------- events (analytics: llm usage, provider, timings) ----------
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete cascade,
  type        text not null,                  -- inbound|auto_reply|held|approved|error
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

-- ---------- indexes ----------
create index if not exists idx_contacts_company     on contacts(company_id, last_message_at desc);
create index if not exists idx_messages_contact     on messages(contact_id, created_at);
create index if not exists idx_messages_company     on messages(company_id, created_at desc);
create index if not exists idx_approvals_company    on approvals(company_id, status, created_at desc);
create index if not exists idx_events_company_time  on events(company_id, created_at desc);

-- ---------- seed the first company (Balaji Construction) ----------
insert into companies (name, owner_name, hours, greeting, knowledge)
select
  'Balaji Construction',
  'Aditya Singh',
  '24x7',
  '🙏 Namaste! Balaji Construction mein aapka swagat hai.\n\nMain Aditya Singh ka assistant hoon. Aap construction ya interior se related koi bhi kaam ke baare mein puchh sakte hain.\n\nBatayein, aapko kya kaam karwana hai?',
  'Balaji Construction, owner Aditya Singh. Construction contractor doing modern interiors and all construction work. Service area: Kanpur, Hardoi, Sitapur (UP). Available 24x7. Free site visit before any quote. Never quote firm prices over chat.'
where not exists (select 1 from companies);

-- Note: RLS is intentionally left OFF because the dashboard never talks to
-- Supabase directly — only the backend does, using the service_role key, and
-- the backend enforces access with Firebase Auth. Do NOT expose the anon key
-- with these tables open to the public.
