from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.permissions import (
    require_farm_access,
    require_flock_access,
    require_flock_create_access,
)
from app.db.session import get_db
from app.models.farm import Farm
from app.models.flock import Flock
from app.models.user import User
from app.schemas.flock import FlockCreate, FlockResponse, FlockUpdate


router = APIRouter(
    prefix="/flocks",
    tags=["Flocks"],
)


@router.post(
    "",
    response_model=FlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_flock(
    flock_data: FlockCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Make sure the farm actually exists.
    farm = db.get(
        Farm,
        flock_data.farm_id,
    )

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    # OWNER or authorized MANAGER only.
    #
    # This checks:
    # OWNER   -> owns the farm's enterprise
    # MANAGER -> active membership on this farm
    # WORKER  -> rejected
    require_flock_create_access(
        current_user,
        farm.id,
        db,
    )

    # The farm_id used here comes from the verified farm.
    # We never replace it with an arbitrary enterprise/farm
    # supplied somewhere else by the client.
    flock = Flock(
        farm_id=farm.id,
        name=(flock_data.name.strip() if flock_data.name else None),
        bird_count=flock_data.bird_count,
        initial_bird_count=flock_data.bird_count,
        breed=flock_data.breed,
        start_date=flock_data.start_date,
        updated_at=datetime.utcnow(),
    )

    db.add(flock)
    db.commit()
    db.refresh(flock)

    return flock


@router.get(
    "",
    response_model=list[FlockResponse],
)
def list_flocks(
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Return ONLY flocks belonging to farms this user
    # is authorized to access.
    #
    # OWNER:
    #   farms belonging to their enterprises
    #
    # MANAGER / WORKER:
    #   farms where they have active membership

    from app.models.enterprise import Enterprise
    from app.models.farm_membership import FarmMembership

    if current_user.role == "OWNER":
        result = db.execute(
            select(Flock)
            .join(
                Farm,
                Flock.farm_id == Farm.id,
            )
            .join(
                Enterprise,
                Farm.enterprise_id == Enterprise.id,
            )
            .where(
                Enterprise.owner_id == current_user.id,
                Enterprise.is_active.is_(True),
                Farm.active.is_(True),
                *(([]) if include_archived else [Flock.archived.is_(False)]),
            )
            .order_by(Flock.id)
        )

    else:
        result = db.execute(
            select(Flock)
            .join(
                Farm,
                Flock.farm_id == Farm.id,
            )
            .join(
                FarmMembership,
                FarmMembership.farm_id == Farm.id,
            )
            .where(
                FarmMembership.user_id == current_user.id,
                FarmMembership.is_active.is_(True),
                Farm.active.is_(True),
                *(([]) if include_archived else [Flock.archived.is_(False)]),
            )
            .order_by(Flock.id)
        )

    return result.scalars().all()


@router.get(
    "/{flock_id}",
    response_model=FlockResponse,
)
def get_flock(
    flock_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = db.get(
        Flock,
        flock_id,
    )

    if flock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flock not found",
        )

    # This resolves:
    #
    # Flock -> Farm -> Enterprise/Membership
    #
    # before allowing access.
    require_flock_access(
        current_user,
        flock_id,
        db,
    )

    return flock


@router.patch("/{flock_id}", response_model=FlockResponse)
def update_flock(
    flock_id: int,
    data: FlockUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = db.get(Flock, flock_id)
    if flock is None:
        raise HTTPException(status_code=404, detail="Flock not found")
    require_flock_access(current_user, flock_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(flock, field, value)
    if data.archived is not None:
        flock.archived_at = datetime.utcnow() if data.archived else None
    flock.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(flock)
    return flock