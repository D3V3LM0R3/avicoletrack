from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.email import send_auth_email
from app.core.invitations import generate_invitation_token, hash_invitation_token
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
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    EmailVerificationRequest,
    MessageResponse,
    LoginResponse,
    RegisterRequest,
    ResendVerificationRequest,
    UserResponse,
    UserUpdate,
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
    verification_token = generate_invitation_token()

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
            email_verified=False,
            email_verification_token_hash=hash_invitation_token(verification_token),
            email_verification_expires_at=now + timedelta(hours=24),
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

        send_auth_email(
            email,
            "Vérifiez votre adresse e-mail",
            f"Ouvrez {settings.frontend_url}/verify-email?token={verification_token}",
        )

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
        email_verified=False,
        email_verification_token_hash=hash_invitation_token(verification_token),
        email_verification_expires_at=now + timedelta(hours=24),
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

    send_auth_email(
        email,
        "Vérifiez votre adresse e-mail",
        f"Ouvrez {settings.frontend_url}/verify-email?token={verification_token}",
    )

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

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before signing in",
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

    enterprise = db.execute(
        select(Enterprise)
        .where(Enterprise.owner_id == user.id, Enterprise.is_active.is_(True))
        .order_by(Enterprise.id)
    ).scalars().first()

    return {
        "access_token": token,
        "token_type": "bearer",
           "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role,
               "is_active": user.is_active, "email_verified": user.email_verified,
               "enterprise_name": enterprise.name if enterprise else None},
    }


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    email = data.email.lower()
    user = db.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if user is None:
        return {
            "message": "If an account exists for this email, a reset link has been generated.",
            "email": email,
            "reset_requested": False,
        }

    reset_token = generate_invitation_token()
    user.password_reset_token_hash = hash_invitation_token(reset_token)
    user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    send_auth_email(
        email,
        "Réinitialisation de votre mot de passe",
        f"Ouvrez {settings.frontend_url}/reset-password?token={reset_token}",
    )
    return {
        "message": "If an account exists for this email, a reset link has been generated.",
        "email": email,
        "reset_requested": True,
    }


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: EmailVerificationRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(
        User.email_verification_token_hash == hash_invitation_token(data.token),
    )).scalar_one_or_none()
    if user is None or user.email_verification_expires_at is None or user.email_verification_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return {"message": "Email address verified"}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == data.email.lower())).scalar_one_or_none()
    if user is None or user.email_verified:
        return {"message": "If the account exists and needs verification, a new email has been sent."}

    verification_token = generate_invitation_token()
    user.email_verification_token_hash = hash_invitation_token(verification_token)
    user.email_verification_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    send_auth_email(
        user.email,
        "Vérifiez votre adresse e-mail",
        f"Ouvrez {settings.frontend_url}/verify-email?token={verification_token}",
    )
    return {"message": "If the account exists and needs verification, a new email has been sent."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(
        User.password_reset_token_hash == hash_invitation_token(data.token),
    )).scalar_one_or_none()
    if user is None or user.password_reset_expires_at is None or user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user.password_hash = hash_password(data.password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully"}


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enterprise = db.execute(
        select(Enterprise)
        .where(Enterprise.owner_id == current_user.id, Enterprise.is_active.is_(True))
        .order_by(Enterprise.id)
    ).scalars().first()
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email,
            "role": current_user.role, "is_active": current_user.is_active,
            "email_verified": current_user.email_verified,
            "enterprise_name": enterprise.name if enterprise else None}


@router.patch(
    "/me",
    response_model=UserResponse,
)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = data.name.strip()
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user