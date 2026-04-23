"""Party-related DB operations (host side)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.party import Party
from app.models.quest import Quest
from app.schemas.party import PartyCreate, PartyUpdate, QuestIn
from app.services import join_code as join_code_svc

MAX_JOIN_CODE_RETRIES = 5
MAX_QUESTS_PER_PARTY = 50


async def create_party(db: AsyncSession, owner_user_id: str, payload: PartyCreate) -> Party:
    for _ in range(MAX_JOIN_CODE_RETRIES):
        party = Party(
            owner_user_id=owner_user_id,
            name=payload.name,
            welcome_message=payload.welcome_message,
            locale=payload.locale,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            join_code=join_code_svc.generate(),
        )
        db.add(party)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            continue
        return party
    raise HTTPException(status_code=500, detail="Could not allocate unique join code")


async def _load_party_for_owner(
    db: AsyncSession, party_id: UUID, owner_user_id: str
) -> Party:
    result = await db.execute(
        select(Party).where(Party.id == party_id, Party.owner_user_id == owner_user_id)
    )
    party = result.scalar_one_or_none()
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")
    return party


async def list_parties(db: AsyncSession, owner_user_id: str) -> list[Party]:
    result = await db.execute(
        select(Party)
        .where(Party.owner_user_id == owner_user_id, Party.archived_at.is_(None))
        .order_by(Party.created_at.desc())
    )
    return list(result.scalars().all())


async def get_party(db: AsyncSession, party_id: UUID, owner_user_id: str) -> tuple[Party, list[Quest]]:
    party = await _load_party_for_owner(db, party_id, owner_user_id)
    quest_result = await db.execute(
        select(Quest).where(Quest.party_id == party_id).order_by(Quest.position)
    )
    return party, list(quest_result.scalars().all())


async def update_party(
    db: AsyncSession, party_id: UUID, owner_user_id: str, payload: PartyUpdate
) -> Party:
    party = await _load_party_for_owner(db, party_id, owner_user_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(party, field, value)
    party.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return party


async def archive_party(db: AsyncSession, party_id: UUID, owner_user_id: str) -> None:
    party = await _load_party_for_owner(db, party_id, owner_user_id)
    party.archived_at = datetime.now(timezone.utc)
    await db.flush()


async def replace_quests(
    db: AsyncSession, party_id: UUID, owner_user_id: str, quests_in: list[QuestIn]
) -> list[Quest]:
    if len(quests_in) > MAX_QUESTS_PER_PARTY:
        raise HTTPException(
            status_code=422, detail=f"Max {MAX_QUESTS_PER_PARTY} quests per party"
        )
    await _load_party_for_owner(db, party_id, owner_user_id)

    await db.execute(delete(Quest).where(Quest.party_id == party_id))
    new_rows = [
        Quest(
            party_id=party_id,
            position=i,
            title=q.title,
            description=q.description,
            icon=q.icon,
            xp=q.xp,
        )
        for i, q in enumerate(quests_in)
    ]
    db.add_all(new_rows)
    await db.flush()
    return new_rows
