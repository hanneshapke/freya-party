# freya-party backend

FastAPI backend for the multi-tenant photo-hunt SaaS. Managed with [uv](https://docs.astral.sh/uv/).

## Local dev

```bash
cd backend
uv sync                         # installs runtime deps into .venv
uv sync --group dev             # adds pytest + ruff
cp .env.example .env            # fill in secrets, then:
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Health check: `curl http://localhost:8000/healthz`.

First time only: generate `uv.lock` with `uv lock`. Commit it — the Docker build uses `uv sync --frozen` and will fail without it.

## Migrations

```bash
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

## Tests + lint

```bash
uv run pytest
uv run ruff check
```

## Adding a dependency

```bash
uv add fastapi                  # runtime dep
uv add --group dev pytest-mock  # dev-only dep
```

## Deploy

Fly.io: `fly deploy`. Secrets via `fly secrets set KEY=value`. The Dockerfile uses uv under the hood and requires `uv.lock` to be present.
