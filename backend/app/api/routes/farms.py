from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.farm_membership import FarmMembership

from app.core.dependencies import get_current_user
from app.core.permissions import (
    can_access_farm,
    require_enterprise_owner,
    require_farm_access,
)
from app.db.session import get_db
from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.user import User
from app.schemas.farm import (
    FarmCreate,
    FarmResponse,
    FarmUpdate,
)


router = APIRouter(
    prefix="/farms",
    tags=["Farms"],
)

@router.post(
    "",
    response_model=FarmResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_farm(
    data: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Find an active enterprise owned by the current user.
    enterprise = db.execute(
        select(Enterprise)
        .where(
            Enterprise.owner_id == current_user.id,
            Enterprise.is_active.is_(True),
        )
        .order_by(Enterprise.id)
    ).scalars().first()

    if enterprise is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own an active enterprise",
        )

    farm = Farm(
        enterprise_id=enterprise.id,
        name=data.name,
        location=data.location,
        active=True,
        created_at=datetime.utcnow(),
    )

    db.add(farm)
    db.commit()
    db.refresh(farm)

    return farm
  
@router.get(
    "",
    response_model=list[FarmResponse],
)
def list_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # OWNER:
    # Return all active farms belonging to enterprises
    # owned by this user.
    if current_user.role == "OWNER":
        farms = db.execute(
            select(Farm)
            .join(
                Enterprise,
                Farm.enterprise_id == Enterprise.id,
            )
            .where(
                Enterprise.owner_id == current_user.id,
                Enterprise.is_active.is_(True),
                Farm.active.is_(True),
            )
            .order_by(Farm.id)
        ).scalars().all()

        return farms

    # MANAGER / WORKER:
    # Return only farms with an active membership.
    farms = db.execute(
        select(Farm)
        .join(
            FarmMembership,
            FarmMembership.farm_id == Farm.id,
        )
        .where(
            FarmMembership.user_id == current_user.id,
            FarmMembership.is_active.is_(True),
            Farm.active.is_(True),
        )
        .order_by(Farm.id)
    ).scalars().all()

    return farms
   
@router.get(
    "/{farm_id}",
    response_model=FarmResponse,
)
def get_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_farm_access(
        current_user,
        farm_id,
        db,
    )

    return farm
   
@router.patch(
    "/{farm_id}",
    response_model=FarmResponse,
)
def update_farm(
    farm_id: int,
    data: FarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_farm_access(
        current_user,
        farm_id,
        db,
    )

    # A MANAGER/WORKER may access the farm,
    # but cannot modify farm configuration.
    if current_user.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the enterprise owner can modify farm settings",
        )

    enterprise = db.get(
        Enterprise,
        farm.enterprise_id,
    )

    if (
        enterprise is None
        or enterprise.owner_id != current_user.id
        or not enterprise.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this farm",
        )

    if data.name is not None:
        farm.name = data.name

    if data.location is not None:
        farm.location = data.location

    if data.active is not None:
        farm.active = data.active

    db.commit()
    db.refresh(farm)

    return farm

@router.delete(
    "/{farm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_farm_access(
        current_user,
        farm_id,
        db,
    )

    if current_user.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the enterprise owner can deactivate a farm",
        )

    enterprise = db.get(
        Enterprise,
        farm.enterprise_id,
    )

    if (
        enterprise is None
        or enterprise.owner_id != current_user.id
        or not enterprise.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this farm",
        )

    farm.active = False

    db.commit()