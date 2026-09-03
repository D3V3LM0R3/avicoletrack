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
    food_type: str | None = Field(default=None, max_length=100)
    food_quantity: float = Field(default=0, ge=0)
    food_unit: str = Field(default="kg", min_length=1, max_length=30)
    water_quantity: float = Field(default=0, ge=0)
    water_unit: str = Field(default="L", min_length=1, max_length=30)


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
    food_type: str | None = Field(default=None, max_length=100)
    food_quantity: float | None = Field(default=None, ge=0)
    food_unit: str | None = Field(default=None, min_length=1, max_length=30)
    water_quantity: float | None = Field(default=None, ge=0)
    water_unit: str | None = Field(default=None, min_length=1, max_length=30)


class FarmResponse(BaseModel):
    id: int
    enterprise_id: int
    name: str
    location: str | None
    active: bool
    created_at: datetime
    food_type: str | None
    food_quantity: float
    food_unit: str
    water_quantity: float
    water_unit: str
    subject_count: int
    egg_stock: int
    cartons: int
    alveoli: int
    mortality: int

    model_config = ConfigDict(
        from_attributes=True
    )