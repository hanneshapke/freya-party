from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class QuestIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    icon: str | None = Field(default=None, max_length=64)
    xp: int = Field(default=10, ge=0, le=1000)


class QuestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    position: int
    title: str
    description: str | None
    icon: str | None
    xp: int


class PartyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    welcome_message: str | None = Field(default=None, max_length=2000)
    locale: str = Field(default="de", min_length=2, max_length=8)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PartyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    welcome_message: str | None = Field(default=None, max_length=2000)
    locale: str | None = Field(default=None, min_length=2, max_length=8)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PartySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    join_code: str
    locale: str
    starts_at: datetime | None
    ends_at: datetime | None
    archived_at: datetime | None
    frozen_at: datetime | None
    created_at: datetime


class PartyDetail(PartySummary):
    welcome_message: str | None
    quests: list[QuestRead]
