# Balaji Construction — AI WhatsApp Agent + Dashboard

## Goal
Turn the single-file WhatsApp bot into a real product: AI auto-replies on WhatsApp,
plus a web dashboard where the owner/staff see live conversations, approve held
replies, manage leads, view analytics, and edit the bot's knowledge — all on free tiers.

## Final stack (per your decisions)
- **Database:** Supabase (Postgres + Realtime). Multi-tenant/SaaS-ready schema.
- **Auth:** Firebase Auth (email/password + roles: owner | staff).
- **Frontend:** React (Vite) deployed on Netlify.
- **Backend:** existing Node/Express on Render (webhook + LLM + send + API).

## Why this shape
Firebase Auth + Supabase DB means the browser cannot safely use Supabase Row-Level
Security (RLS keys off Supabase JWTs, not Firebase). So the **backend is the single
gateway**: it holds the Supabase service key, verifies every request's Firebase ID
token, checks the user's role + companyId, then reads/writes Supabase. Live updates
reach the dashboard through an authenticated Server-Sent Events (SSE) stream the
backend feeds from Supabase Realtime. This keeps all secrets server-side.

## Architecture
```
WhatsApp ─▶ Backend (Render, Node/Express)
              • webhook  • LLM fallback chain  • send via Cloud API
              • REST API (Firebase-token auth)  • SSE live stream
              • only holder of Supabase service key + WhatsApp token
                    │ reads/writes
                    ▼
              Supabase (Postgres + Realtime)
                    ▲ live
Dashboard (React on Netlify) ── Firebase Auth (login) ──┘
   talks only to backend REST + SSE
```

## Data model (Supabase / Postgres — SaaS-ready)
- `companies` — id, name, knowledge_md, hours, risky_words, wa_phone_number_id, created_at
- `app_users` — firebase_uid (PK), email, role (owner|staff), company_id, created_at
- `contacts` — id, company_id, wa_id, name, lead_stage, notes, last_message_at
    - lead_stage ∈ {new, site_visit, quoted, won, lost}
- `messages` — id, company_id, contact_id, role (user|assistant|owner), text,
    status (sent|held|approved|rejected|failed), created_at
- `approvals` — id, company_id, contact_id, draft_text, trigger_text, status, created_at
- `events` — id, company_id, type, meta jsonb, created_at   (for analytics: replies, LLM provider used, response time)

Seed one company row for Balaji; structure already supports many.

## Backend changes (Phase 1)
- Add `@supabase/supabase-js` (service key) and `firebase-admin`.
- Replace `memory.js` (history.json) with Supabase reads/writes for messages/contacts.
- On inbound WhatsApp: upsert contact, store message, run LLM fallback (unchanged),
  either send + store reply, or create an `approvals` row (held) and notify owner.
- Log `events` (response time, provider used) for analytics.
- New authenticated REST endpoints (all verify Firebase ID token + company scope):
  - `GET  /api/conversations`            list contacts + last message
  - `GET  /api/conversations/:id`        full thread
  - `POST /api/send`                     staff/owner reply → WhatsApp + store
  - `GET  /api/approvals`                pending held drafts
  - `POST /api/approvals/:id/approve`    (with optional edited text) → send
  - `POST /api/approvals/:id/reject`
  - `GET  /api/leads` / `POST /api/leads/:id`   pipeline stage + notes
  - `GET  /api/analytics`                counts, avg response time, conversion, busy hours, usage
  - `GET  /api/knowledge` / `PUT /api/knowledge`   edit bot brain live
  - `GET  /api/team` / `POST /api/team`  owner-only: add/list staff
  - `GET  /api/stream`                   SSE live feed (new messages/approvals) for the company
- Keep the WhatsApp `/ok` approval path working as a fallback.
- Move `knowledge` to be read from Supabase (with knowledge.md as seed/default).

## Frontend (Phases 2–4) — React + Vite on Netlify
- Firebase Auth login screen (email/password); token attached to every API call; SSE for live.
- **Live Inbox** — conversation list + real-time thread, reply box.
- **Approvals** — held drafts; edit + Approve / Reject.
- **Leads pipeline** — kanban New→Site Visit→Quoted→Won→Lost, drag to move, notes.
- **Analytics** — enquiries/day, avg response time, conversion %, busiest hours, LLM usage/cost.
- **Knowledge editor** — edit services/hours/FAQ/risky-words; saves to Supabase, bot uses live.
- **Team & roles** — owner adds staff logins; staff can reply but not edit knowledge/team.

## Build order (all now, verifying each)
1. Backend → Supabase + Firebase-token auth + all API endpoints + SSE. Bot stays live throughout.
2. Frontend scaffold + Firebase login + Live Inbox (real-time) + send.
3. Approvals + Leads pipeline.
4. Analytics + Knowledge editor + Team/roles.
5. Netlify deploy config + README/setup docs.

## What YOU must set up (I can't; I'll give click-by-click steps)
1. **Supabase project** (free) → I provide SQL to create tables; you run it in the SQL editor.
   Copy the Project URL + `service_role` key → into Render env.
2. **Firebase project** (free) → enable Authentication (Email/Password).
   - Service account JSON → into Render env (for token verification).
   - Web config (apiKey etc.) → into the React app env.
3. **Netlify** account (free) → connect repo / drag-deploy the built dashboard.
4. Create the first owner login (I'll add a one-time seed step).

## New environment variables
Backend (Render): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FIREBASE_SERVICE_ACCOUNT`
(JSON), plus existing WhatsApp + LLM keys.
Frontend (Netlify): `VITE_FIREBASE_*` web config, `VITE_API_BASE` (Render URL).

## Honest flags
- **Render free tier sleeps after 15 min idle** → slow first reply and SSE drops on
  wake. For production use Render Starter (~₹600/mo). Fine during the build.
- **Security:** dashboard holds customer PII. Every endpoint verifies Firebase token +
  company scope; secrets stay on the backend; CORS locked to the Netlify domain.
  I will flag anything left open.
- **WhatsApp number** stays the test number for now; migrating to a real number is a
  separate task (done when Aditya signs), independent of this build.
- This spans many files and both a backend and a new frontend app. Large but staged.

## Repo layout after build
```
/ (backend, existing)      server.js, db.js, auth.js, api/*, package.json
/dashboard (new)           Vite React app, src/pages/*, deployed to Netlify
/supabase-schema.sql       run once in Supabase
PLAN.md, README.md
```
