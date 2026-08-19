from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.invitations import (
    generate_invitation_token,
    hash_invitation_token,
)
from app.core.permissions import (
    require_enterprise_owner,
)
from app.db.session import get_db
from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.models.invitation import Invitation
from app.models.user import User
from app.schemas.invitation import (
    InvitationCancelResponse,
    InvitationCreate,
    InvitationCreatedResponse,
    InvitationResponse,
)


router = APIRouter(
    prefix="/personnel",
    tags=["Personnel"],
)


@router.post(
    "/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only an enterprise owner can invite personnel.
    require_enterprise_owner(
        current_user,
        data.enterprise_id,
        db,
    )

    # Verify that the farm belongs to that enterprise.
    farm = db.execute(
        select(Farm).where(
            Farm.id == data.farm_id,
            Farm.enterprise_id == data.enterprise_id,
            Farm.active.is_(True),
        )
    ).scalar_one_or_none()

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found in this enterprise",
        )

    email = data.email.lower()

    # Don't allow an invitation for an already registered user.
    existing_user = db.execute(
        select(User).where(
            User.email == email,
        )
    ).scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Deactivate older unused invitations for this email/farm.
    old_invitations = db.execute(
        select(Invitation).where(
            Invitation.invited_email == email,
            Invitation.farm_id == data.farm_id,
            Invitation.is_active.is_(True),
            Invitation.used_at.is_(None),
        )
    ).scalars().all()

    for old_invitation in old_invitations:
        old_invitation.is_active = False

    token = generate_invitation_token()
    token_hash = hash_invitation_token(token)

    now = datetime.utcnow()
    expires_at = now + timedelta(
        hours=data.expires_in_hours
    )

    invitation = Invitation(
        enterprise_id=data.enterprise_id,
        farm_id=data.farm_id,
        invited_email=email,
        role=data.role,
        token_hash=token_hash,
        expires_at=expires_at,
        used_at=None,
        created_by=current_user.id,
        is_active=True,
        created_at=now,
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return InvitationCreatedResponse(
    id=invitation.id,
    enterprise_id=invitation.enterprise_id,
    farm_id=invitation.farm_id,
    invited_email=invitation.invited_email,
    role=invitation.role,
    expires_at=invitation.expires_at,
    used_at=invitation.used_at,
    is_active=invitation.is_active,
    created_at=invitation.created_at,
    invitation_token=token,
)


@router.get(
    "/farms/{farm_id}",
    response_model=list[InvitationResponse],
)
def list_farm_invitations(
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

    require_enterprise_owner(
        current_user,
        farm.enterprise_id,
        db,
    )

    invitations = db.execute(
        select(Invitation)
        .where(
            Invitation.farm_id == farm_id,
        )
        .order_by(
            Invitation.created_at.desc()
        )
    ).scalars().all()

    return invitations


@router.get(
    "/farms/{farm_id}/members",
)
def list_farm_members(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(
        Farm,
        farm_id,
    )

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_enterprise_owner(
        current_user,
        farm.enterprise_id,
        db,
    )

    members = db.execute(
        select(
            User.id,
            User.name,
            User.email,
            User.role,
            FarmMembership.role.label("farm_role"),
            FarmMembership.is_active,
            FarmMembership.created_at,
        )
        .join(
            FarmMembership,
            FarmMembership.user_id == User.id,
        )
        .where(
            FarmMembership.farm_id == farm_id,
        )
        .order_by(User.id)
    ).all()

    return [
        {
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "role": member.role,
            "farm_role": member.farm_role,
            "is_active": member.is_active,
            "created_at": member.created_at,
        }
        for member in members
    ]


@router.patch(
    "/memberships/{membership_id}/deactivate",
)
def deactivate_membership(
    membership_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.get(
        FarmMembership,
        membership_id,
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    farm = db.get(
        Farm,
        membership.farm_id,
    )

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_enterprise_owner(
        current_user,
        farm.enterprise_id,
        db,
    )

    membership.is_active = False

    db.commit()

    return {
        "message": "Farm membership deactivated",
        "membership_id": membership.id,
    }


@router.patch(
    "/memberships/{membership_id}/activate",
)
def activate_membership(
    membership_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.get(
        FarmMembership,
        membership_id,
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    farm = db.get(
        Farm,
        membership.farm_id,
    )

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_enterprise_owner(
        current_user,
        farm.enterprise_id,
        db,
    )

    membership.is_active = True

    db.commit()

    return {
        "message": "Farm membership activated",
        "membership_id": membership.id,
    }
    
    
@router.delete(
    "/invitations/{invitation_id}",
    response_model=InvitationCancelResponse,
)
def cancel_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation = db.get(
        Invitation,
        invitation_id,
    )

    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Only the owner of the invitation's enterprise
    # can cancel it.
    require_enterprise_owner(
        current_user,
        invitation.enterprise_id,
        db,
    )

    # Already cancelled.
    if not invitation.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is already inactive",
        )

    # Already accepted.
    if invitation.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been used",
        )

    invitation.is_active = False

    db.commit()

    return {
        "message": "Invitation cancelled",
        "invitation_id": invitation.id,
    }
    
    
    
@router.delete(
    "/farms/{farm_id}/invitations",
)
def cancel_farm_invitations(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(
        Farm,
        farm_id,
    )

    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found",
        )

    require_enterprise_owner(
        current_user,
        farm.enterprise_id,
        db,
    )

    invitations = db.execute(
        select(Invitation).where(
            Invitation.farm_id == farm_id,
            Invitation.is_active.is_(True),
            Invitation.used_at.is_(None),
        )
    ).scalars().all()

    cancelled_count = 0

    for invitation in invitations:
        invitation.is_active = False
        cancelled_count += 1

    db.commit()

    return {
        "message": "Active farm invitations cancelled",
        "farm_id": farm_id,
        "cancelled_count": cancelled_count,
    }
   
@router.patch(
    "/invitations/{invitation_id}/reactivate",
    response_model=InvitationResponse,
)
def reactivate_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation = db.get(
        Invitation,
        invitation_id,
    )

    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Only the enterprise owner can reactivate invitations.
    require_enterprise_owner(
        current_user,
        invitation.enterprise_id,
        db,
    )

    # An invitation that has already been accepted
    # can never be reactivated.
    if invitation.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been used",
        )

    now = datetime.utcnow()

    # Do not allow expired invitations to be reactivated.
    if invitation.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired and cannot be reactivated",
        )

    # Already active.
    if invitation.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is already active",
        )

    invitation.is_active = True

    db.commit()
    db.refresh(invitation)

    return invitation