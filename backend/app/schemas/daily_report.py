from datetime import date

from pydantic import BaseModel, Field


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
    notes: str | None = None


class DailyReportResponse(DailyReportCreate):
    id: int
    laying_percentage: float | None
    ratio: float | None