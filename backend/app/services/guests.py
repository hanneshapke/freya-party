from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guest import Guest
from app.security.guest import generate_session_token


async def create_guest(
    db: AsyncSession, *, party_id: UUID, name: str, consent: bool
) -> tuple[Guest, str]:
    plaintext, digest = generate_session_token()
    now = datetime.now(timezone.utc)
    guest = Guest(
        party_id=party_id,
        name=name,
        session_token_hash=digest,
        consent_recorded_at=now if consent else None,
        last_seen_at=now,
    )
    db.add(guest)
    await db.flush()
    return guest, plaintext
