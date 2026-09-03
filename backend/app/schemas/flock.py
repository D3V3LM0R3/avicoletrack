from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FlockCreate(BaseModel):
    farm_id: int
    name: str | None = None
    bird_count: int = Field(ge=0)
    breed: str | None = None
    start_date: date | None = None


class FlockResponse(BaseModel):
    id: int
    farm_id: int
    name: str | None = None
    bird_count: int
    initial_bird_count: int = 0
    breed: str | None
    start_date: date | None
    archived: bool
    archived_at: datetime | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlockUpdate(BaseModel):
    name: str | None = None
    bird_count: int | None = Field(default=None, ge=0)
    breed: str | None = None
    start_date: date | None = None
    archived: bool | None = None