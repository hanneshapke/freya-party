# Foto-Jagd — multi-tenant photo hunt

A multi-tenant photo scavenger hunt: a host signs up, pays a monthly Stripe subscription, creates parties with custom quests, and shares a join code with guests. Guests open the link, enter a name, and upload photos per quest. Originally built for Freyas Geburtstag; now any host can run their own.

## Architecture

- **Frontend** — React 19 + Vite + TailwindCSS on Firebase Hosting. Host routes gated by [Clerk](https://clerk.com). See `src/`.
- **Backend** — FastAPI on Cloud Run. SQLAlchemy async + Cloud SQL (Postgres) + Alembic. See `backend/`.
- **Storage** — Cloudflare R2 (S3-compatible) for photos; presigned POST uploads with a size + content-type policy.
- **Billing** — Stripe subscriptions (Checkout + Billing Portal + webhook). On lapse, the backend stamps `parties.frozen_at` and guest submissions return 402.

## Development

### Backend

Uses [uv](https://docs.astral.sh/uv/) — install it with `curl -LsSf https://astral.sh/uv/install.sh | sh` if you haven't already.

```bash
cd backend
uv sync --group dev             # creates .venv and installs everything
cp .env.example .env            # fill in Clerk / Stripe / R2 / Postgres secrets
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Health check: `curl http://localhost:8000/healthz`. Tests: `uv run pytest`.

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

Backend (Cloud Run + Cloud SQL):

```bash
# One-time: create the Cloud SQL Postgres instance and a database.
gcloud sql instances create freya-party-db \
  --database-version=POSTGRES_16 --region=europe-west3 --tier=db-f1-micro
gcloud sql databases create freya_party --instance=freya-party-db
gcloud sql users create app --instance=freya-party-db --password=...

# Store secrets in Secret Manager (repeat per secret).
printf '%s' "postgresql+asyncpg://app:PASS@/freya_party?host=/cloudsql/PROJECT:europe-west3:freya-party-db" \
  | gcloud secrets create DATABASE_URL --data-file=-

# Deploy from the backend/ directory — Cloud Build picks up the Dockerfile.
cd backend
gcloud run deploy freya-party-backend \
  --source . \
  --region=europe-west3 \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJECT:europe-west3:freya-party-db \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,CLERK_WEBHOOK_SECRET=CLERK_WEBHOOK_SECRET:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,STRIPE_PRICE_ID=STRIPE_PRICE_ID:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest,SENTRY_DSN=SENTRY_DSN:latest \
  --set-env-vars=CLERK_JWKS_URL=...,CLERK_ISSUER=...,R2_ACCOUNT_ID=...,R2_BUCKET=...,R2_PUBLIC_BASE_URL=...,FRONTEND_ORIGIN=https://<your-firebase-domain>
```

The container honors `$PORT` (Cloud Run sets it to `8080`) and runs `alembic upgrade head` on start.

Frontend (Firebase Hosting):

```bash
npm install -g firebase-tools
firebase login
firebase use --add                     # pick your GCP project
VITE_API_BASE_URL=https://<cloud-run-url> \
VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  npm run build
firebase deploy --only hosting
```

`firebase.json` serves `dist/` with SPA rewrites and hashed-asset caching. Vite env vars are baked in at build time, so set them before `npm run build`.

Stripe webhook URL: `https://<cloud-run-url>/api/billing/webhook`. Clerk webhook: `https://<cloud-run-url>/api/webhooks/clerk`. Cloudflare R2 and Clerk remain unchanged; Sentry is opt-in via `SENTRY_DSN`.

## Migrating Freya's original party

```bash
cd backend
uv sync --group migration       # firebase-admin is only needed for this
PYTHONPATH=. uv run python ../scripts/migrate_freya_to_pg.py \
  --clerk-user-id user_xxx --email freya@example.com \
  --join-code FREYA2025 --dry-run
```

Drop `--dry-run` to commit. The script is idempotent — safe to re-run.
