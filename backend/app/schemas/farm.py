from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FarmCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=150,
    )
    location: str | None = Field(
        default=None,
        max_length=255,
    )


class FarmUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )
    location: str | None = Field(
        default=None,
        max_length=255,
    )
    active: bool | None = None


class FarmResponse(BaseModel):
    id: int
    enterprise_id: int
    name: str
    location: str | None
    active: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )