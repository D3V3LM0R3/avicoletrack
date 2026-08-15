from pydantic import BaseModel, ConfigDict


class FarmCreate(BaseModel):
    name: str
    location: str | None = None


class FarmResponse(BaseModel):
    id: int
    name: str
    location: str | None
    active: bool

    model_config = ConfigDict(from_attributes=True)