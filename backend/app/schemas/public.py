from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.party import QuestRead


class JoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    consent: bool = Field(description="Guest/guardian consent to upload photos")


class PartyPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    welcome_message: str | None
    locale: str
    starts_at: datetime | None
    ends_at: datetime | None
    frozen_at: datetime | None


class SubmissionPhotoIn(BaseModel):
    s3_key: str = Field(min_length=1, max_length=500)


class SubmissionPhotoOut(BaseModel):
    s3_key: str
    url: str


class SubmissionIn(BaseModel):
    quest_id: UUID
    message: str | None = Field(default=None, max_length=500)
    photos: list[SubmissionPhotoIn] = Field(min_length=1, max_length=10)


class SubmissionOut(BaseModel):
    id: UUID
    quest_id: UUID
    guest_id: UUID
    guest_name: str | None = None
    message: str | None
    submitted_at: datetime
    photos: list[SubmissionPhotoOut]


class JoinResponse(BaseModel):
    session_token: str
    guest_id: UUID
    party: PartyPublic
    quests: list[QuestRead]
    my_submissions: list[SubmissionOut]


class UploadUrlRequest(BaseModel):
    quest_id: UUID
    content_type: str = Field(pattern=r"^image/[\w.+-]+$")


class UploadUrlResponse(BaseModel):
    url: str
    fields: dict[str, str]
    key: str
