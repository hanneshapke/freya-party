"""Submission create / overwrite.

The guest's browser has already uploaded one or more photos to R2 via
presigned POST. This service records the submission metadata and links
each s3_key into the `submission_photos` table — but only after a
`HEAD` on the object confirms size and content-type match the policy.
Re-submitting the same quest as the same guest overwrites the prior
submission (idempotent edit).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guest import Guest
from app.models.party import Party
from app.models.quest import Quest
from app.models.submission import Submission, SubmissionPhoto
from app.schemas.public import SubmissionIn
from app.services import storage as storage_svc


async def create_or_update_submission(
    db: AsyncSession, *, party: Party, guest: Guest, payload: SubmissionIn
) -> Submission:
    if party.frozen_at is not None:
        raise HTTPException(status_code=402, detail="Diese Party ist pausiert")

    quest = (
        await db.execute(
            select(Quest).where(Quest.id == payload.quest_id, Quest.party_id == party.id)
        )
    ).scalar_one_or_none()
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest gehört nicht zu dieser Party")

    key_prefix = f"parties/{party.id}/quests/{quest.id}/guests/{guest.id}/"
    photo_meta: list[dict] = []
    for p in payload.photos:
        if not p.s3_key.startswith(key_prefix):
            raise HTTPException(status_code=422, detail="Foto gehört nicht zu diesem Upload")
        meta = storage_svc.head_object(p.s3_key)
        photo_meta.append({**meta, "s3_key": p.s3_key})

    existing = (
        await db.execute(
            select(Submission).where(
                Submission.quest_id == quest.id, Submission.guest_id == guest.id
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        await db.execute(
            delete(SubmissionPhoto).where(SubmissionPhoto.submission_id == existing.id)
        )
        existing.message = payload.message
        submission = existing
    else:
        submission = Submission(
            party_id=party.id,
            quest_id=quest.id,
            guest_id=guest.id,
            message=payload.message,
        )
        db.add(submission)
        await db.flush()

    db.add_all(
        [
            SubmissionPhoto(
                submission_id=submission.id,
                s3_key=m["s3_key"],
                content_type=m["content_type"],
                size_bytes=m["size_bytes"],
            )
            for m in photo_meta
        ]
    )
    await db.flush()
    return submission


async def list_my_submissions(
    db: AsyncSession, *, party_id: UUID, guest_id: UUID
) -> list[tuple[Submission, list[SubmissionPhoto]]]:
    result = await db.execute(
        select(Submission).where(
            Submission.party_id == party_id, Submission.guest_id == guest_id
        )
    )
    submissions = list(result.scalars().all())
    out: list[tuple[Submission, list[SubmissionPhoto]]] = []
    for s in submissions:
        photos = (
            await db.execute(
                select(SubmissionPhoto).where(SubmissionPhoto.submission_id == s.id)
            )
        ).scalars().all()
        out.append((s, list(photos)))
    return out


async def list_party_submissions(
    db: AsyncSession, *, party_id: UUID
) -> list[tuple[Submission, list[SubmissionPhoto], str]]:
    """Host dashboard view: submissions + photos + guest name."""
    result = await db.execute(
        select(Submission, Guest.name)
        .join(Guest, Guest.id == Submission.guest_id)
        .where(Submission.party_id == party_id)
        .order_by(Submission.submitted_at.desc())
    )
    rows = result.all()
    out: list[tuple[Submission, list[SubmissionPhoto], str]] = []
    for submission, guest_name in rows:
        photos = (
            await db.execute(
                select(SubmissionPhoto).where(SubmissionPhoto.submission_id == submission.id)
            )
        ).scalars().all()
        out.append((submission, list(photos), guest_name))
    return out
