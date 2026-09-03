from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class DailyReportCreate(BaseModel):
    farm_id: int
    flock_id: int | None = None
    report_date: date
    bird_count: int = Field(ge=0)
    mortality: int = Field(default=0, ge=0)
    eggs_produced: int = Field(default=0, ge=0)
    hen_age: int | None = Field(default=None, ge=0)
    egg_stock: int = Field(default=0, ge=0)
    cartons: int = Field(default=0, ge=0)
    alveoli: int = Field(default=0, ge=0)
    remaining_eggs: int = Field(default=0, ge=0)
    feed_used_bags: float = Field(default=0, ge=0)
    water_used_liters: float = Field(default=0, ge=0)
    notes: str | None = None


class DailyReportUpdate(BaseModel):
    report_date: date | None = None
    bird_count: int | None = Field(default=None, ge=0)
    mortality: int | None = Field(default=None, ge=0)
    eggs_produced: int | None = Field(default=None, ge=0)
    hen_age: int | None = Field(default=None, ge=0)
    egg_stock: int | None = Field(default=None, ge=0)
    cartons: int | None = Field(default=None, ge=0)
    alveoli: int | None = Field(default=None, ge=0)
    remaining_eggs: int | None = Field(default=None, ge=0)
    feed_used_bags: float | None = Field(default=None, ge=0)
    water_used_liters: float | None = Field(default=None, ge=0)
    notes: str | None = None


class DailyReportResponse(DailyReportCreate):
    id: int
    laying_percentage: float | None
    ratio: float | None
    created_by: int | None = None
    author_name: str | None = None
    created_by_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)