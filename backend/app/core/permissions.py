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

    # OWNER access should remain possible even when a farm is inactive,
    # so the owner can reactivate or manage it.
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
    farm = db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    if not farm.active and not is_enterprise_owner(user, farm.enterprise_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This farm is deactivated. Contact the enterprise owner for access.",
        )
    membership = db.execute(select(FarmMembership).where(
        FarmMembership.user_id == user.id,
        FarmMembership.farm_id == farm_id,
    )).scalar_one_or_none()
    if membership is not None and not membership.is_active and not is_enterprise_owner(user, farm.enterprise_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your access to this farm is deactivated. Contact the enterprise owner.",
        )
    if not can_access_farm(
        user,
        farm_id,
        db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this farm",
        )


def can_access_enterprise(
    user: User,
    enterprise_id: int,
    db: Session,
) -> bool:
    return is_enterprise_owner(user, enterprise_id, db)


def require_enterprise_access(
    user: User,
    enterprise_id: int,
    db: Session,
):
    enterprise = db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enterprise not found",
        )
    if not can_access_enterprise(user, enterprise_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this enterprise",
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

    if farm_role == "OWNER":
        return
    if farm_role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the farm owner or an authorized "
                "manager can create flocks"
            ),
        )
    require_membership_permission(user, farm_id, "create_flock", db)


def require_membership_permission(user: User, farm_id: int, permission: str, db: Session):
    if user.role == "OWNER":
        return
    membership = db.execute(select(FarmMembership).where(
        FarmMembership.user_id == user.id,
        FarmMembership.farm_id == farm_id,
        FarmMembership.is_active.is_(True),
    )).scalar_one_or_none()
    if not membership or not (membership.permissions or {}).get(permission, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permission required: {permission}")


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

    farm = db.get(Farm, flock.farm_id)
    if flock.archived and (farm is None or not is_enterprise_owner(user, farm.enterprise_id, db)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This flock is deactivated. Contact the enterprise owner for access.",
        )

    require_farm_access(
        user,
        flock.farm_id,
        db,
    )