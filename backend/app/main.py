from fastapi import FastAPI

from app.api.routes import auth
from app.api.routes import personnel
from app.api.routes import daily_reports
from app.api.routes import farms
from app.api.routes import flocks
from app.api.routes import health


app = FastAPI(
    title="AvicoleTrack API",
    description=(
        "Backend API for the AvicoleTrack "
        "poultry farm management platform."
    ),
    version="0.1.0",
)


app.include_router(health.router)
app.include_router(personnel.router)
app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(flocks.router)
app.include_router(daily_reports.router)


@app.get("/")
def root():
    return {
        "name": "AvicoleTrack API",
        "version": "0.1.0",
        "status": "running",
    }