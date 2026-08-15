from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class FlockCreate(BaseModel):
    farm_id: int
    bird_count: int = Field(ge=0)
    breed: str | None = None
    start_date: date | None = None


class FlockResponse(BaseModel):
    id: int
    farm_id: int
    bird_count: int
    breed: str | None
    start_date: date | None

    model_config = ConfigDict(from_attributes=True)