from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.models.flock import Flock
from app.models.user import User


def is_enterprise_owner(
    user: User,
    enterprise_id: int,
    db: Session,
) -> bool:

    enterprise = db.execute(
        select(Enterprise).where(
            Enterprise.id == enterprise_id,
            Enterprise.owner_id == user.id,
            Enterprise.is_active.is_(True),
        )
    ).scalar_one_or_none()

    return enterprise is not None


def can_access_farm(
    user: User,
    farm_id: int,
    db: Session,
) -> bool:

    # OWNER access:
    # The farm must belong to an active enterprise
    # owned by this specific user.
    if user.role == "OWNER":

        owner_farm = db.execute(
            select(Farm)
            .join(
                Enterprise,
                Farm.enterprise_id == Enterprise.id,
            )
            .where(
                Farm.id == farm_id,
                Farm.active.is_(True),
                Enterprise.owner_id == user.id,
                Enterprise.is_active.is_(True),
            )
        ).scalar_one_or_none()

        return owner_farm is not None

    # MANAGER / WORKER access:
    # Must have an active membership for this exact farm.
    membership = db.execute(
        select(FarmMembership)
        .join(
            Farm,
            FarmMembership.farm_id == Farm.id,
        )
        .where(
            FarmMembership.user_id == user.id,
            FarmMembership.farm_id == farm_id,
            FarmMembership.is_active.is_(True),
            Farm.active.is_(True),
        )
    ).scalar_one_or_none()

    return membership is not None


def require_farm_access(
    user: User,
    farm_id: int,
    db: Session,
):
    if not can_access_farm(
        user,
        farm_id,
        db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this farm",
        )


def require_enterprise_owner(
    user: User,
    enterprise_id: int,
    db: Session,
):
    if not is_enterprise_owner(
        user,
        enterprise_id,
        db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the enterprise owner can perform this action",
        )


def can_access_flock(
    user: User,
    flock_id: int,
    db: Session,
) -> bool:

    flock = db.execute(
        select(Flock).where(
            Flock.id == flock_id,
        )
    ).scalar_one_or_none()

    if flock is None:
        return False

    return can_access_farm(
        user,
        flock.farm_id,
        db,
    )


def require_flock_access(
    user: User,
    flock_id: int,
    db: Session,
):
    if not can_access_flock(
        user,
        flock_id,
        db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this flock",
        )
      
      
def get_farm_role(
    user: User,
    farm_id: int,
    db: Session,
) -> str | None:

    # Enterprise owner has OWNER privileges
    # over farms belonging to their enterprise.
    if user.role == "OWNER":

        owner_farm = db.execute(
            select(Farm)
            .join(
                Enterprise,
                Farm.enterprise_id == Enterprise.id,
            )
            .where(
                Farm.id == farm_id,
                Enterprise.owner_id == user.id,
                Enterprise.is_active.is_(True),
                Farm.active.is_(True),
            )
        ).scalar_one_or_none()

        if owner_farm is not None:
            return "OWNER"

    membership = db.execute(
        select(FarmMembership.role)
        .join(
            Farm,
            FarmMembership.farm_id == Farm.id,
        )
        .where(
            FarmMembership.user_id == user.id,
            FarmMembership.farm_id == farm_id,
            FarmMembership.is_active.is_(True),
            Farm.active.is_(True),
        )
    ).scalar_one_or_none()

    return membership
   
def require_flock_create_access(
    user: User,
    farm_id: int,
    db: Session,
):
    farm_role = get_farm_role(
        user,
        farm_id,
        db,
    )

    if farm_role not in ("OWNER", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the farm owner or an authorized "
                "manager can create flocks"
            ),
        )


def require_flock_access(
    user: User,
    flock_id: int,
    db: Session,
):
    flock = db.execute(
        select(Flock).where(
            Flock.id == flock_id,
        )
    ).scalar_one_or_none()

    if flock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flock not found",
        )

    require_farm_access(
        user,
        flock.farm_id,
        db,
    )