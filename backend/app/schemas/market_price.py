from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class MarketPriceCreate(BaseModel):
    product: str = Field(min_length=1, max_length=150)
    product_key: str | None = Field(default=None, max_length=80)
    region: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)
    price_low: float | None = Field(default=None, gt=0)
    price_mid: float | None = Field(default=None, gt=0)
    price_high: float | None = Field(default=None, gt=0)
    note_low: str | None = Field(default=None, max_length=255)
    note_mid: str | None = Field(default=None, max_length=255)
    note_high: str | None = Field(default=None, max_length=255)
    tags: str | None = Field(default=None, max_length=500)
    unit: str = Field(min_length=1, max_length=50)
    source: str = Field(min_length=1, max_length=255)
    price_date: date


class MarketPriceResponse(MarketPriceCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MarketPriceUpdate(BaseModel):
    product: str | None = Field(default=None, min_length=1, max_length=150)
    product_key: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, min_length=1, max_length=100)
    price: float | None = Field(default=None, gt=0)
    price_low: float | None = Field(default=None, gt=0)
    price_mid: float | None = Field(default=None, gt=0)
    price_high: float | None = Field(default=None, gt=0)
    note_low: str | None = Field(default=None, max_length=255)
    note_mid: str | None = Field(default=None, max_length=255)
    note_high: str | None = Field(default=None, max_length=255)
    tags: str | None = Field(default=None, max_length=500)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    source: str | None = Field(default=None, min_length=1, max_length=255)