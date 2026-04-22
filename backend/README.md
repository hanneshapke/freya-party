# freya-party backend

FastAPI backend for the multi-tenant photo-hunt SaaS.

## Local dev

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# fill in secrets, then:
alembic upgrade head
uvicorn app.main:app --reload
```

Health check: `curl http://localhost:8000/healthz`

## Migrations

```bash
alembic revision --autogenerate -m "message"
alembic upgrade head
```

## Tests

```bash
pytest
```

## Deploy

Fly.io: `fly deploy`. Secrets are managed via `fly secrets set KEY=value`.
