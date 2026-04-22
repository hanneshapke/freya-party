"""Public guest endpoints — no Clerk auth, session token for continuation."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.guest import Guest
from app.models.party import Party
from app.models.quest import Quest
from app.schemas.party import QuestRead
from app.schemas.public import (
    JoinRequest,
    JoinResponse,
    PartyPublic,
    SubmissionIn,
    SubmissionOut,
    SubmissionPhotoOut,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.security.guest import get_guest_context, load_party_by_code
from app.services import guests as guests_svc
from app.services import storage as storage_svc
from app.services import submissions as submissions_svc

router = APIRouter(prefix="/api/public/parties", tags=["public"])


async def _quests_for(db: AsyncSession, party_id) -> list[Quest]:
    result = await db.execute(
        select(Quest).where(Quest.party_id == party_id).order_by(Quest.position)
    )
    return list(result.scalars().all())


async def _my_submissions_dto(
    db: AsyncSession, party_id, guest_id
) -> list[SubmissionOut]:
    rows = await submissions_svc.list_my_submissions(
        db, party_id=party_id, guest_id=guest_id
    )
    return [
        SubmissionOut(
            id=s.id,
            quest_id=s.quest_id,
            guest_id=s.guest_id,
            message=s.message,
            submitted_at=s.submitted_at,
            photos=[
                SubmissionPhotoOut(s3_key=p.s3_key, url=storage_svc.signed_get_url(p.s3_key))
                for p in photos
            ],
        )
        for s, photos in rows
    ]


@router.post("/{join_code}/join", response_model=JoinResponse)
async def join_party(
    join_code: Annotated[str, Path()],
    payload: JoinRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JoinResponse:
    if not payload.consent:
        raise HTTPException(status_code=422, detail="Einwilligung erforderlich")
    party = await load_party_by_code(db, join_code)
    guest, plaintext = await guests_svc.create_guest(
        db, party_id=party.id, name=payload.name, consent=payload.consent
    )
    quests = await _quests_for(db, party.id)
    return JoinResponse(
        session_token=plaintext,
        guest_id=guest.id,
        party=PartyPublic.model_validate(party),
        quests=[QuestRead.model_validate(q) for q in quests],
        my_submissions=[],
    )


@router.get("/{join_code}", response_model=JoinResponse)
async def get_my_state(
    ctx: Annotated[tuple[Party, Guest], Depends(get_guest_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JoinResponse:
    party, guest = ctx
    quests = await _quests_for(db, party.id)
    return JoinResponse(
        session_token="",  # already held by the client
        guest_id=guest.id,
        party=PartyPublic.model_validate(party),
        quests=[QuestRead.model_validate(q) for q in quests],
        my_submissions=await _my_submissions_dto(db, party.id, guest.id),
    )


@router.post("/{join_code}/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    payload: UploadUrlRequest,
    ctx: Annotated[tuple[Party, Guest], Depends(get_guest_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UploadUrlResponse:
    party, guest = ctx
    if party.frozen_at is not None:
        raise HTTPException(status_code=402, detail="Diese Party ist pausiert")

    quest = (
        await db.execute(
            select(Quest).where(Quest.id == payload.quest_id, Quest.party_id == party.id)
        )
    ).scalar_one_or_none()
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest gehört nicht zu dieser Party")

    presigned = storage_svc.create_presigned_upload(
        party_id=party.id,
        quest_id=quest.id,
        guest_id=guest.id,
        content_type=payload.content_type,
    )
    return UploadUrlResponse(**presigned)


@router.post("/{join_code}/submissions", response_model=SubmissionOut)
async def create_submission(
    payload: SubmissionIn,
    ctx: Annotated[tuple[Party, Guest], Depends(get_guest_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubmissionOut:
    party, guest = ctx
    submission = await submissions_svc.create_or_update_submission(
        db, party=party, guest=guest, payload=payload
    )
    # fetch back the photos we just inserted
    dtos = await _my_submissions_dto(db, party.id, guest.id)
    match = next((d for d in dtos if d.id == submission.id), None)
    if match is None:  # defensive — shouldn't happen
        raise HTTPException(status_code=500, detail="Submission persistence error")
    return match
