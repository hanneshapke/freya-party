from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = Field(default="development")
    frontend_origin: str = Field(default="http://localhost:5173")
    sentry_dsn: str | None = None

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/freya_party",
    )

    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    clerk_webhook_secret: str = ""

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    billing_success_path: str = "/billing/return"
    billing_cancel_path: str = "/dashboard"
    billing_grace_seconds: int = 3 * 24 * 3600

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base_url: str = ""

    max_upload_bytes: int = 10 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
