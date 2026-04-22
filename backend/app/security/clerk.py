"""Clerk JWT verification and webhook signature verification.

Hosts log in via Clerk in the frontend. Clerk issues short-lived JWTs
signed with RS256 using a rotating key set published at the Clerk
JWKS URL. Every protected host endpoint depends on `get_current_user`
which validates the bearer token, lazy-upserts the `users` row, and
returns the ORM User.

The Clerk webhook (signed with Svix) ships canonical user events; we
use it to keep the email in sync and pre-create the row at signup.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models.user import User

settings = get_settings()

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.clerk_jwks_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="CLERK_JWKS_URL not configured",
            )
        _jwks_client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True, lifespan=600)
    return _jwks_client


def _decode_clerk_jwt(token: str) -> dict[str, Any]:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
        options = {"require": ["exp", "iat", "sub"]}
        kwargs: dict[str, Any] = {"algorithms": ["RS256"], "options": options}
        if settings.clerk_issuer:
            kwargs["issuer"] = settings.clerk_issuer
        return jwt.decode(token, signing_key, **kwargs)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token: {exc}",
        ) from exc


async def ensure_user_row(
    db: AsyncSession, user_id: str, email: str | None = None
) -> User:
    """Lazy upsert on the `users` table. Called from the auth dependency
    (first request from a new user) and from the Clerk webhook."""
    stmt = pg_insert(User).values(id=user_id, email=email or f"{user_id}@pending.local")
    update_cols: dict[str, Any] = {}
    if email:
        update_cols["email"] = email
    if update_cols:
        stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=update_cols)
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
    await db.execute(stmt)
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one()


async def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,  # type: ignore[assignment]
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_clerk_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no sub")
    email = claims.get("email") or claims.get("primary_email_address")
    user = await ensure_user_row(db, user_id, email)
    request.state.user_id = user_id
    return user


def verify_clerk_webhook(
    body: bytes, svix_id: str, svix_timestamp: str, svix_signature: str
) -> None:
    """Verify a Clerk (Svix) webhook signature.

    svix-signature header contains space-separated `v1,<b64sig>` entries.
    The signed payload is `{svix_id}.{svix_timestamp}.{body}` HMAC'd with
    the raw secret (after stripping the `whsec_` prefix and base64-decoding).
    """
    secret = settings.clerk_webhook_secret
    if not secret:
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SECRET not configured")

    # Reject very old timestamps (5 minute tolerance) to stop replays.
    try:
        ts = int(svix_timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Bad svix-timestamp") from exc
    if abs(time.time() - ts) > 300:
        raise HTTPException(status_code=400, detail="Webhook timestamp outside tolerance")

    raw_secret = secret.removeprefix("whsec_")
    key = base64.b64decode(raw_secret)
    signed = f"{svix_id}.{svix_timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    provided = [sig.split(",", 1)[1] for sig in svix_signature.split() if sig.startswith("v1,")]
    if not any(hmac.compare_digest(expected, p) for p in provided):
        raise HTTPException(status_code=401, detail="Bad webhook signature")
