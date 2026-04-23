.DEFAULT_GOAL := help
.PHONY: help install dev dev-backend dev-frontend migrate migration test lint

BACKEND := backend

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (uv) + frontend (npm) deps
	cd $(BACKEND) && uv sync --group dev
	npm install

dev: ## Run backend + frontend dev servers concurrently
	@trap 'kill 0' INT TERM; \
	(cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) & \
	npm run dev & \
	wait

dev-backend: ## Run backend dev server only
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run frontend dev server only
	npm run dev

migrate: ## Apply Alembic migrations to the local database
	cd $(BACKEND) && uv run alembic upgrade head

migration: ## Generate a new Alembic revision (usage: make migration m="add foo")
	@test -n "$(m)" || (echo "usage: make migration m=\"description\"" && exit 1)
	cd $(BACKEND) && uv run alembic revision --autogenerate -m "$(m)"

test: ## Run all tests (backend pytest)
	cd $(BACKEND) && uv run pytest

lint: ## Lint the backend (ruff)
	cd $(BACKEND) && uv run ruff check
