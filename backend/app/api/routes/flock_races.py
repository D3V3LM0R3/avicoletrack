from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.flock_race_preset import FlockRacePreset
from app.models.user import User
from app.schemas.flock_race_preset import FlockRacePresetResponse

router = APIRouter(prefix="/flock-races", tags=["Flock Races"])


@router.get("", response_model=list[FlockRacePresetResponse])
def list_flock_race_presets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all available flock race presets"""
    presets = db.execute(select(FlockRacePreset).order_by(FlockRacePreset.category, FlockRacePreset.name)).scalars().all()
    return presets


@router.get("/by-category/{category}", response_model=list[FlockRacePresetResponse])
def list_flock_races_by_category(
    category: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get flock race presets by category"""
    presets = db.execute(
        select(FlockRacePreset)
        .where(FlockRacePreset.category == category)
        .order_by(FlockRacePreset.name)
    ).scalars().all()
    return presets
