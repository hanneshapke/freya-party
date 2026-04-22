"""Guest session resolution.

A guest holds an opaque bearer token issued by `POST .../join`. We
store only the sha256 digest server-side. Every guest request must
present the token (`X-Guest-Token` header), and the server validates:

1. the party from the `{join_code}` path exists and is not archived,
2. a guest row exists whose session_token_hash matches,
3. that guest belongs to *this* party — a token issued for party A is
   rejected against party B's URL.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.guest import Guest
from app.models.party import Party


def generate_session_token() -> tuple[str, str]:
    """Return (plaintext_for_client, sha256_hash_for_db)."""
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def load_party_by_code(db: AsyncSession, join_code: str) -> Party:
    result = await db.execute(
        select(Party).where(Party.join_code == join_code, Party.archived_at.is_(None))
    )
    party = result.scalar_one_or_none()
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party nicht gefunden")
    return party


async def get_guest_context(
    join_code: Annotated[str, Path()],
    x_guest_token: Annotated[str | None, Header(alias="X-Guest-Token")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,  # type: ignore[assignment]
) -> tuple[Party, Guest]:
    if not x_guest_token:
        raise HTTPException(status_code=401, detail="Missing X-Guest-Token")
    party = await load_party_by_code(db, join_code)
    result = await db.execute(
        select(Guest).where(
            Guest.session_token_hash == hash_token(x_guest_token),
            Guest.party_id == party.id,
        )
    )
    guest = result.scalar_one_or_none()
    if guest is None:
        raise HTTPException(status_code=403, detail="Ungültige Sitzung")
    return party, guest
