# Cura — Full Setup Guide

This is the complete, in-order setup for the WhatsApp AI agent **and** the dashboard.
Do the parts in order — each depends on the one before it.

```
WhatsApp ─▶ Backend (Render) ─writes─▶ Supabase (Postgres) ◀─reads via API─ Dashboard (Netlify)
                │ webhook + AI + send        ▲                                    │
                └── reads knowledge/config ──┘                    Firebase Auth (login + roles)
```

- **Backend** = this repo root (`server.js`, `lib/`). Runs on Render.
- **Dashboard** = `dashboard/` folder. Deploys to Netlify.
- **Database** = Supabase (free).
- **Login** = Firebase Auth (free).

---

## Part 1 — Supabase (database)

1. Go to **supabase.com** → sign in → **New project**. Pick a name, a strong DB password, a region near you (e.g. Mumbai). Wait ~2 min for it to provision.
2. Left menu → **SQL Editor** → **New query**.
3. Open `db/schema.sql` from this repo, copy ALL of it, paste, click **Run**. You should see "Success". This creates the tables and seeds the Balaji company row.
4. Left menu → **Project Settings** (gear) → **API**. Copy two things:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role** secret key (NOT the anon key) → this is `SUPABASE_SERVICE_KEY`

   ⚠️ The service_role key bypasses all security. It goes ONLY in the backend (Render). Never in the dashboard, never in git.

---

## Part 2 — Firebase (login)

1. Go to **console.firebase.google.com** → **Add project**. Name it (e.g. `cura-dashboard`). You can disable Analytics. Create.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. Add your first login: **Authentication → Users → Add user** → enter the owner's email + a password. Copy the **User UID** shown after — you need it in Part 5.
4. **Backend credentials (service account):**
   - Gear icon → **Project settings** → **Service accounts** tab → **Generate new private key** → downloads a JSON file.
   - Open that JSON, copy the ENTIRE contents. This is `FIREBASE_SERVICE_ACCOUNT` (paste as one value in Render).
5. **Frontend credentials (web config):**
   - Gear → **Project settings** → **General** tab → scroll to "Your apps" → click the **web** icon `</>` → register app (nickname `dashboard`).
   - It shows a `firebaseConfig` object. You need these values for the dashboard `.env` (Part 4):
     `apiKey`, `authDomain`, `projectId`, `appId`.

---

## Part 3 — Backend on Render

1. Push this repo to GitHub (already connected to `ai_sales_backend`).
2. Render dashboard → your service → **Environment** tab. Set:

   | Variable | Value |
   |---|---|
   | `WHATSAPP_TOKEN` | permanent token from Meta |
   | `PHONE_NUMBER_ID` | from Meta API Setup |
   | `VERIFY_TOKEN` | `cura-webhook-7h29fk3921xz` (or your own) |
   | `GEMINI_API_KEY` | from aistudio.google.com |
   | `GEMINI_API_KEY_2..4` | more keys from OTHER Google accounts (optional) |
   | `OPENROUTER_API_KEY` | from openrouter.ai (optional fallback) |
   | `SUPABASE_URL` | Part 1 |
   | `SUPABASE_SERVICE_KEY` | Part 1 (service_role) |
   | `FIREBASE_SERVICE_ACCOUNT` | Part 2.4 — the whole JSON, one line |

3. **Save** → Render redeploys. Open `https://<your-service>.onrender.com/` — should say "Cura WA agent running."
4. Meta webhook still points at `/webhook` with your `VERIFY_TOKEN` — unchanged from before.

---

## Part 4 — Dashboard on Netlify

1. In the `dashboard/` folder, the build settings are already in `netlify.toml`.
2. Netlify → **Add new site → Import from Git** → pick the repo → set **Base directory** to `dashboard`. (Netlify reads `netlify.toml` for build command + publish dir.)
3. Netlify → **Site settings → Environment variables**. Add (from Part 2.5):

   | Variable | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | firebaseConfig.apiKey |
   | `VITE_FIREBASE_AUTH_DOMAIN` | firebaseConfig.authDomain |
   | `VITE_FIREBASE_PROJECT_ID` | firebaseConfig.projectId |
   | `VITE_FIREBASE_APP_ID` | firebaseConfig.appId |
   | `VITE_API_BASE` | `https://<your-service>.onrender.com` |

4. **Deploy.** You get a `https://<name>.netlify.app` URL.
5. Back in **Firebase → Authentication → Settings → Authorized domains** → add your `netlify.app` domain, so login works there.

---

## Part 5 — Link the owner login to the company

Firebase knows the owner's email/password, but the backend needs to know that user is the OWNER of Balaji. Run this once in **Supabase → SQL Editor**, replacing the UID with the one from Part 2.3:

```sql
insert into app_users (id, company_id, email, name, role)
select
  'PASTE_FIREBASE_UID_HERE',
  (select id from companies limit 1),
  'owner@email.com',
  'Aditya Singh',
  'owner';
```

Now open the Netlify URL, sign in with that email/password → you're in as owner.
Add staff later from the **Team** tab (they sign up in Firebase first, then you add their UID).

---

## Daily use

- **Inbox** — see every conversation live, reply manually anytime.
- **Approvals** — price/booking messages wait here; edit + Send, or Reject.
- **Leads** — drag customers through New → Visit → Quoted → Won/Lost.
- **Analytics** — enquiries, response stats, which AI model answered.
- **Knowledge** (owner) — edit what the bot knows; changes apply immediately.
- **Team** (owner) — add staff logins.

## Cost reminder (production)
- WhatsApp inbound replies: free. Marketing templates: paid per message.
- Gemini free tier is limited; enable billing for reliability (~₹100–400/mo).
- Render free sleeps after 15 min — use Starter (~₹600/mo) for always-on.
- Supabase + Firebase + Netlify free tiers: ₹0 at this scale.
