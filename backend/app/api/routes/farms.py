from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.farm import Farm
from app.schemas.farm import FarmCreate, FarmResponse

router = APIRouter(prefix="/farms", tags=["Farms"])


@router.post("", response_model=FarmResponse, status_code=201)
def create_farm(farm_data: FarmCreate, db: Session = Depends(get_db)):
    farm = Farm(name=farm_data.name, location=farm_data.location)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


@router.get("", response_model=list[FarmResponse])
def list_farms(db: Session = Depends(get_db)):
    result = db.execute(select(Farm).order_by(Farm.id))
    return result.scalars().all()


@router.get("/{farm_id }", response_model=FarmResponse)
def get_farm()