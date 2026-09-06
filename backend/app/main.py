from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlsplit

from app.core.config import settings

from app.api.routes import auth
from app.api.routes import personnel
from app.api.routes import daily_reports
from app.api.routes import farms
from app.api.routes import flocks
from app.api.routes import flock_races
from app.api.routes import health
from app.api.routes import notifications
from app.api.routes import analytics
from app.api.routes import events
from app.api.routes import market_prices
from app.api.routes import stock_movements
from app.api.routes import chat
from app.api.routes import games
from app.api.routes import game


app = FastAPI(
    title="AvicoleTrack API",
    description=(
        "Backend API for the AvicoleTrack "
        "poultry farm management platform."
    ),
    version="0.1.0",
)

frontend_url_parts = urlsplit(settings.frontend_url)
frontend_origin = (
    f"{frontend_url_parts.scheme}://{frontend_url_parts.netloc}"
    if frontend_url_parts.scheme and frontend_url_parts.netloc
    else settings.frontend_url
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, frontend_origin],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(personnel.router)
app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(flocks.router)
app.include_router(flock_races.router)
app.include_router(daily_reports.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(events.router)
app.include_router(market_prices.router)
app.include_router(stock_movements.router)
app.include_router(chat.router)
app.include_router(games.router)


@app.get("/")
def root():
    return {
        "name": "AvicoleTrack API",
        "version": "0.1.0",
        "status": "running",
    }