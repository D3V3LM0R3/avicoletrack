from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FlockRacePresetResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
