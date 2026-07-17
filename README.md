# WhatsApp Cloud API AI Assistant (solo contractor)

An AI assistant that replies to WhatsApp customers on the official Meta Cloud API.
Safe questions get auto-answered; anything about money or commitments is held and
sent to the owner for approval.

## Files
- `server.js` — webhook server + Gemini brain + owner approval gate
- `knowledge.md` — the business facts the AI is allowed to use (EDIT THIS FIRST)
- `memory.js` — per-contact conversation history (history.json, auto-created)
- `.env.example` — copy to `.env` and fill in

## Setup

1. Install Node.js (LTS), then in this folder:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values.
3. Fill in `knowledge.md` with the real business details.

## Get the Meta credentials
1. developers.facebook.com > Create App > Business.
2. Add the WhatsApp product > API Setup.
3. Copy the **Phone number ID** and **temporary token** into `.env`.
4. Add your own phone as a test recipient.

## Run locally + expose with ngrok (free, for testing)
1. Start the server:
   ```
   npm start
   ```
2. In another terminal, expose it (install ngrok free first):
   ```
   ngrok http 3000
   ```
   Copy the https URL ngrok prints.

## Connect the webhook
1. Meta app > WhatsApp > Configuration > Webhook > Edit.
2. Callback URL: `https://YOUR-NGROK-URL/webhook`
3. Verify token: the same `VERIFY_TOKEN` value from your `.env`.
4. Save. It should verify. Then **Subscribe** to the `messages` field.

## Test
Message your test WhatsApp number from your phone. A normal question gets an
auto-reply. A message like "how much for a bathroom?" gets held and forwarded to
the OWNER_NUMBER with a ready `/ok` command to approve.

## Deploy to Render (free, always-on)

1. Push this folder to a GitHub repo (`.env`, `node_modules`, `history.json`
   are git-ignored — never commit them).
2. Render dashboard > New > Web Service > connect the repo. Render reads
   `render.yaml` automatically (Node, free plan, `npm install` / `npm start`).
3. In the service's **Environment** tab, add the 5 secrets from your `.env`:
   `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN`, `OWNER_NUMBER`,
   `GEMINI_API_KEY`. (Do NOT set PORT — Render provides it.)
4. Deploy. Your public URL is `https://<name>.onrender.com`.
5. In Meta > WhatsApp > Configuration > Webhook, use
   `https://<name>.onrender.com/webhook` as the callback URL and your
   `VERIFY_TOKEN`. Save, then subscribe to the `messages` field.

### Keep it awake (free tier sleeps after ~15 min idle)
- Go to cron-job.org (free), create a job that GET-requests
  `https://<name>.onrender.com/` every 10 minutes. This prevents cold-start
  delays on the first customer message after a quiet period.

### Heads-up: memory resets on the free tier
- `history.json` lives on an ephemeral disk, so conversation memory is wiped on
  each restart/redeploy/sleep. Fine for basic use. To persist it, either attach
  a Render Disk (paid) or swap `memory.js` for a free hosted store (e.g. Upstash
  Redis free tier) — ask and I'll wire it in.

## Meta production notes (still ~$0)
- Create a System User + **permanent token** (the test token expires in 24h),
  add a real business number, and complete business verification.
- Replies within the 24h customer window are free. Messaging someone first or
  after 24h of silence needs a pre-approved template (small per-message cost).
