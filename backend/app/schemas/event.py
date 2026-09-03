from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EventCreate(BaseModel):
    farm_ids: list[int] = Field(min_length=1, max_length=20)
    flock_id: int | None = None
    type: str = Field(pattern="^(vaccination|treatment|reform|breeding|inspection|other)$")
    title: str = Field(min_length=1, max_length=200)
    event_date: datetime
    description: str | None = None
    reminder_date: datetime | None = None
    financial_type: str | None = Field(default=None, pattern="^(cost|benefit)$")
    financial_amount: float | None = Field(default=None, ge=0)


class EventResponse(BaseModel):
    id: int
    farm_id: int
    flock_id: int | None
    type: str
    title: str
    event_date: datetime
    description: str | None
    reminder_date: datetime | None
    created_by: int | None
    created_at: datetime
    status: str = "pending"
    confirmation_message: str | None = None
    confirmed_by: int | None = None
    created_by_name: str | None = None
    confirmed_by_name: str | None = None
    confirmed_at: datetime | None = None
    financial_type: str | None = None
    financial_amount: float | None = None

    model_config = ConfigDict(from_attributes=True)


class EventUpdate(BaseModel):
    type: str | None = Field(default=None, pattern="^(vaccination|treatment|reform|breeding|inspection|other)$")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    flock_id: int | None = None
    event_date: datetime | None = None
    description: str | None = None
    reminder_date: datetime | None = None
    financial_type: str | None = Field(default=None, pattern="^(cost|benefit)$")
    financial_amount: float | None = Field(default=None, ge=0)


class EventConfirm(BaseModel):
    confirmation_message: str = Field(min_length=1, max_length=500)