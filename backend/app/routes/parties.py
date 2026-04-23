"""Host-side party CRUD.

All routes here require a valid Clerk JWT. Write routes additionally
require an active subscription (or the billing_exempt flag).
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.schemas.party import (
    PartyCreate,
    PartyDetail,
    PartySummary,
    PartyUpdate,
    QuestIn,
    QuestRead,
)
from app.security.clerk import get_current_user
from app.security.subscription import require_active_subscription
from app.services import parties as parties_svc

router = APIRouter(prefix="/api/parties", tags=["parties"])


@router.get("", response_model=list[PartySummary])
async def list_my_parties(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    return await parties_svc.list_parties(db, user.id)


@router.post("", response_model=PartySummary, status_code=status.HTTP_201_CREATED)
async def create_party(
    payload: PartyCreate,
    user: Annotated[User, Depends(require_active_subscription)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> object:
    return await parties_svc.create_party(db, user.id, payload)


@router.get("/{party_id}", response_model=PartyDetail)
async def read_party(
    party_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    party, quests = await parties_svc.get_party(db, party_id, user.id)
    return {
        **PartySummary.model_validate(party).model_dump(),
        "welcome_message": party.welcome_message,
        "quests": [QuestRead.model_validate(q) for q in quests],
    }


@router.patch("/{party_id}", response_model=PartySummary)
async def patch_party(
    party_id: UUID,
    payload: PartyUpdate,
    user: Annotated[User, Depends(require_active_subscription)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> object:
    return await parties_svc.update_party(db, party_id, user.id, payload)


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_party(
    party_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await parties_svc.archive_party(db, party_id, user.id)


@router.put("/{party_id}/quests", response_model=list[QuestRead])
async def replace_quests(
    party_id: UUID,
    payload: list[QuestIn],
    user: Annotated[User, Depends(require_active_subscription)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    return await parties_svc.replace_quests(db, party_id, user.id, payload)
