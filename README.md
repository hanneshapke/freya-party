# Foto-Jagd — multi-tenant photo hunt

A multi-tenant photo scavenger hunt: a host signs up, pays a monthly Stripe subscription, creates parties with custom quests, and shares a join code with guests. Guests open the link, enter a name, and upload photos per quest. Originally built for Freyas Geburtstag; now any host can run their own.

## Architecture

- **Frontend** — React 19 + Vite + TailwindCSS on Vercel. Host routes gated by [Clerk](https://clerk.com). See `src/`.
- **Backend** — FastAPI on Fly.io. SQLAlchemy async + Postgres + Alembic. See `backend/`.
- **Storage** — Cloudflare R2 (S3-compatible) for photos; presigned POST uploads with a size + content-type policy.
- **Billing** — Stripe subscriptions (Checkout + Billing Portal + webhook). On lapse, the backend stamps `parties.frozen_at` and guest submissions return 402.

## Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env    # fill in Clerk / Stripe / R2 / Postgres secrets
alembic upgrade head
uvicorn app.main:app --reload
```

Health check: `curl http://localhost:8000/healthz`. Tests: `pytest`.

### Frontend

```bash
cp .env.example .env.local      # VITE_API_BASE_URL + VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev
```

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`. Required for real use: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `FRONTEND_ORIGIN`.

### Frontend (`.env.local`)

```
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Routes

| Path | Audience | Notes |
| --- | --- | --- |
| `/` | public | Landing / pricing |
| `/dashboard` | host (Clerk) | Subscription state + party list |
| `/parties/:id/edit` | host | Edit name, welcome message, quests |
| `/parties/:id/submissions` | host | Signed-GET gallery of guest photos |
| `/billing/return` | host | Stripe Checkout success page |
| `/p/:joinCode` | guest (no account) | Join + quest board + photo upload |

## API surface (abridged)

- `GET /api/me` — subscription status for the authed host
- `GET|POST /api/parties`, `GET|PATCH|DELETE /api/parties/{id}`
- `PUT /api/parties/{id}/quests` — bulk replace
- `GET /api/parties/{id}/submissions` — with signed-GET photo URLs
- `POST /api/billing/{checkout,portal,webhook}`
- `POST /api/webhooks/clerk`
- `POST /api/public/parties/{join_code}/join` → issues guest session token
- `GET /api/public/parties/{join_code}` — guest state (requires `X-Guest-Token`)
- `POST /api/public/parties/{join_code}/upload-url` — presigned R2 POST
- `POST /api/public/parties/{join_code}/submissions` — create / overwrite

## Deploying

Backend (Fly.io):

```bash
cd backend
fly deploy
fly secrets set DATABASE_URL=... CLERK_SECRET_KEY=... STRIPE_SECRET_KEY=... ...
```

Frontend (Vercel): set the two `VITE_` env vars in the project settings and push.

Stripe webhook URL: `https://<backend-domain>/api/billing/webhook`. Clerk webhook: `https://<backend-domain>/api/webhooks/clerk`.

## Migrating Freya's original party

```bash
cd backend && source .venv/bin/activate
PYTHONPATH=. python ../scripts/migrate_freya_to_pg.py \
  --clerk-user-id user_xxx --email freya@example.com \
  --join-code FREYA2025 --dry-run
```

Drop `--dry-run` to commit. The script is idempotent — safe to re-run.
