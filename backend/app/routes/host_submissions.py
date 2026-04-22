"""Host-side submissions listing for a given party."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.party import Party
from app.models.user import User
from app.schemas.public import SubmissionOut, SubmissionPhotoOut
from app.security.clerk import get_current_user
from app.services import storage as storage_svc
from app.services import submissions as submissions_svc

router = APIRouter(prefix="/api/parties", tags=["parties"])


@router.get("/{party_id}/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    party_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SubmissionOut]:
    party = (
        await db.execute(
            select(Party).where(Party.id == party_id, Party.owner_user_id == user.id)
        )
    ).scalar_one_or_none()
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    rows = await submissions_svc.list_party_submissions(db, party_id=party.id)
    return [
        SubmissionOut(
            id=s.id,
            quest_id=s.quest_id,
            guest_id=s.guest_id,
            guest_name=guest_name,
            message=s.message,
            submitted_at=s.submitted_at,
            photos=[
                SubmissionPhotoOut(s3_key=p.s3_key, url=storage_svc.signed_get_url(p.s3_key))
                for p in photos
            ],
        )
        for s, photos, guest_name in rows
    ]
