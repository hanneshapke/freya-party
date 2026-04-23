from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["party_id", "quest_id"],
            ["quests.party_id", "quests.id"],
            name="fk_submissions_party_quest",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["party_id", "guest_id"],
            ["guests.party_id", "guests.id"],
            name="fk_submissions_party_guest",
            ondelete="CASCADE",
        ),
        UniqueConstraint("quest_id", "guest_id", name="uq_submissions_quest_guest"),
        Index("ix_submissions_party_submitted_at", "party_id", "submitted_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    party_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("parties.id", ondelete="CASCADE"),
        nullable=False,
    )
    quest_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    guest_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)

    message: Mapped[str | None] = mapped_column(String(500))

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SubmissionPhoto(Base):
    __tablename__ = "submission_photos"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    submission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    s3_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
