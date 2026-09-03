from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockMovementCreate(BaseModel):
    farm_id: int
    flock_id: int | None = None
    stock_type: str = Field(min_length=1)
    movement_type: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1)
    note: str | None = None
    movement_date: datetime | None = None
    product_name: str | None = Field(default=None, max_length=150)
    market_price_id: int | None = None
    unit_price: float | None = Field(default=None, ge=0)
    price_tier: str | None = Field(default=None, pattern="^(low|mid|high)$")


class StockMovementResponse(StockMovementCreate):
    id: int
    created_by: int | None = None
    created_at: datetime
    status: str
    validated_by: int | None = None
    created_by_name: str | None = None
    validated_by_name: str | None = None
    validated_at: datetime | None = None
    confirmation_message: str | None = None
    total_value: float | None = None

    model_config = ConfigDict(from_attributes=True)


class StockMovementValidate(BaseModel):
    confirmation_message: str = Field(min_length=1, max_length=500)


class StockMovementSummary(BaseModel):
    stock_type: str
    quantity: float
    unit: str
    movement_type: str
    movement_date: datetime
