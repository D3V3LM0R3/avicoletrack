from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.invitations import hash_invitation_token
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.enterprise import Enterprise
from app.models.farm_membership import FarmMembership
from app.models.invitation import Invitation
from app.models.user import User
from app.schemas.auth import (
    LoginResponse,
    RegisterRequest,
    UserResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = data.email.lower()

    existing_user = db.execute(
        select(User).where(
            User.email == email
        )
    ).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    now = datetime.utcnow()

    # ==========================================================
    # INVITATION REGISTRATION
    # ==========================================================

    if data.invitation_token:

        token_hash = hash_invitation_token(
            data.invitation_token
        )

        invitation = db.execute(
            select(Invitation).where(
                Invitation.token_hash == token_hash,
                Invitation.is_active.is_(True),
                Invitation.used_at.is_(None),
            )
        ).scalar_one_or_none()

        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation",
            )

        if invitation.expires_at <= now:
            invitation.is_active = False
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired",
            )

        if invitation.invited_email.lower() != email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation was issued to another email address",
            )

        # Verify that the farm still exists and belongs
        # to the invitation's enterprise.
        from app.models.farm import Farm

        farm = db.execute(
            select(Farm).where(
                Farm.id == invitation.farm_id,
                Farm.enterprise_id == invitation.enterprise_id,
                Farm.active.is_(True),
            )
        ).scalar_one_or_none()

        if farm is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The invited farm is no longer available",
            )

        user = User(
            name=data.name,
            email=email,
            password_hash=hash_password(data.password),
            role=invitation.role,
            is_active=True,
            created_at=now,
            updated_at=now,
        )

        db.add(user)
        db.flush()

        membership = FarmMembership(
            user_id=user.id,
            farm_id=invitation.farm_id,
            role=invitation.role,
            created_at=now,
            updated_at=now,
            is_active=True,
        )

        db.add(membership)

        invitation.used_at = now
        invitation.is_active = False

        db.commit()
        db.refresh(user)

        return user

    # ==========================================================
    # PUBLIC OWNER REGISTRATION
    # ==========================================================

    if not data.enterprise_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enterprise name is required for owner registration",
        )

    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role="OWNER",
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    db.add(user)
    db.flush()

    enterprise = Enterprise(
        name=data.enterprise_name,
        owner_id=user.id,
        created_at=now,
        updated_at=now,
        is_active=True,
    )

    db.add(enterprise)

    db.commit()
    db.refresh(user)

    return user


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.execute(
        select(User).where(
            User.email == form_data.username.lower()
        )
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(
        form_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user