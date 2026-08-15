from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.farm import Farm
from app.models.flock import Flock
from app.schemas.flock import FlockCreate, FlockResponse

router = APIRouter(prefix="/flocks", tags=["Flocks"])


@router.post("", response_model=FlockResponse, status_code=201)
def create_flock(flock_data: FlockCreate, db: Session = Depends(get_db)):
    farm = db.get(Farm, flock_data.farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")

    flock = Flock(
        farm_id=flock_data.farm_id,
        bird_count=flock_data.bird_count,
        breed=flock_data.breed,
        start_date=flock_data.start_date,
    )
    db.add(flock)
    db.commit()
    db.refresh(flock)
    return flock


@router.get("", response_model=list[FlockResponse])
def list_flocks(db: Session = Depends(get_db)):
    result = db.execute(select(Flock).order_by(Flock.id))
    return result.scalars().all()


@router.get("/{flock_id}", response_model=FlockResponse)
def get_flock(flock_id: int, db: Session = Depends(get_db)):
    flock = db.get(Flock, flock_id)
    if flock is None:
        raise HTTPException(status_code=404, detail="Flock not found")
    return flock