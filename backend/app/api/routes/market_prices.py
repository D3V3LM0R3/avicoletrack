import json
from urllib.request import Request, urlopen
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.market_price import MarketPrice
from app.models.user import User
from app.schemas.market_price import MarketPriceCreate, MarketPriceResponse, MarketPriceUpdate

router = APIRouter(prefix="/market-prices", tags=["Market prices"])


@router.get("", response_model=list[MarketPriceResponse])
def list_market_prices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.execute(select(MarketPrice).order_by(MarketPrice.price_date.desc(), MarketPrice.region)).scalars().all()


@router.post("", response_model=MarketPriceResponse, status_code=201)
def create_market_price(data: MarketPriceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ("OWNER", "MANAGER"):
        raise HTTPException(status_code=403, detail="Only owners and managers can add market prices")
    values = data.model_dump()
    values["product_key"] = values.get("product_key") or data.product.strip().lower().replace(" ", "_")
    values["price_low"] = values.get("price_low") or data.price
    values["price_mid"] = values.get("price_mid") or data.price
    values["price_high"] = values.get("price_high") or data.price
    price = MarketPrice(**values)
    db.add(price)
    db.commit()
    db.refresh(price)
    return price


@router.patch("/{price_id}", response_model=MarketPriceResponse)
def update_market_price(price_id: int, data: MarketPriceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ("OWNER", "MANAGER"):
        raise HTTPException(status_code=403, detail="Only owners and managers can edit market prices")
    price = db.get(MarketPrice, price_id)
    if price is None:
        raise HTTPException(status_code=404, detail="Market price not found")
    values = data.model_dump(exclude_unset=True)
    if "product" in values and "product_key" not in values:
        values["product_key"] = values["product"].strip().lower().replace(" ", "_")
    for field, value in values.items():
        setattr(price, field, value)
    if data.price is not None:
        price.price_low = data.price_low or price.price_low or data.price
        price.price_mid = data.price_mid or price.price_mid or data.price
        price.price_high = data.price_high or price.price_high or data.price
    db.commit()
    db.refresh(price)
    return price


@router.post("/refresh", response_model=list[MarketPriceResponse])
def refresh_market_prices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ("OWNER", "MANAGER"):
        raise HTTPException(status_code=403, detail="Only owners and managers can refresh market prices")
    if not settings.market_price_url or not settings.market_price_url.startswith("https://"):
        raise HTTPException(status_code=503, detail="Configure MARKET_PRICE_URL with an HTTPS JSON source")
    try:
        request = Request(settings.market_price_url, headers={"User-Agent": "AvicoleTrack/1.0"})
        with urlopen(request, timeout=10) as response:
            payload = json.load(response)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Market price source is unavailable") from error
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="Market price source must return a JSON list")
    stored = []
    for item in payload:
        try:
            price = MarketPrice(**MarketPriceCreate(**item).model_dump())
        except Exception as error:
            raise HTTPException(status_code=502, detail="Market price source returned invalid data") from error
        db.add(price)
        stored.append(price)
    db.commit()
    for price in stored:
        db.refresh(price)
    return stored