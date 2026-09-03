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
from app.schemas.farm_membership import FarmMembershipUpdate


router = APIRouter(
    prefix="/personnel",
    tags=["Personnel"],
)


@router.get("/farms/{farm_id}/my-permissions")
def get_my_farm_permissions(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if current_user.role == "OWNER":
        return {"permissions": {"create_flock": True, "create_event": True, "send_notification": True, "confirm_stock_movement": True, "export_daily_reports": True, "export_event_reports": True, "export_movement_reports": True}}
    membership = db.execute(select(FarmMembership).where(
        FarmMembership.farm_id == farm_id,
        FarmMembership.user_id == current_user.id,
        FarmMembership.is_active.is_(True),
    )).scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")
    return {"permissions": membership.permissions or {}}


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
            FarmMembership.id.label("membership_id"),
            User.id,
            User.name,
            User.email,
            User.role,
            FarmMembership.role.label("farm_role"),
            FarmMembership.is_active,
            FarmMembership.created_at,
            FarmMembership.permissions,
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
            "membership_id": member.membership_id,
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "role": member.role,
            "farm_role": member.farm_role,
            "is_active": member.is_active,
            "created_at": member.created_at,
            "permissions": member.permissions or {},
        }
        for member in members
    ]


@router.patch("/memberships/{membership_id}/permissions")
def update_membership_permissions(membership_id: int, permissions: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.get(FarmMembership, membership_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    farm = db.get(Farm, membership.farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    require_enterprise_owner(current_user, farm.enterprise_id, db)
    allowed = {"create_flock", "create_event", "send_notification", "confirm_stock_movement", "export_daily_reports", "export_event_reports", "export_movement_reports"}
    membership.permissions = {key: bool(permissions.get(key, False)) for key in allowed}
    db.commit()
    return {"membership_id": membership.id, "permissions": membership.permissions}


@router.patch("/memberships/{membership_id}")
def update_membership(membership_id: int, data: FarmMembershipUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.get(FarmMembership, membership_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    current_farm = db.get(Farm, membership.farm_id)
    target_farm = db.get(Farm, data.farm_id)
    if current_farm is None or target_farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    require_enterprise_owner(current_user, current_farm.enterprise_id, db)
    if target_farm.enterprise_id != current_farm.enterprise_id:
        raise HTTPException(status_code=403, detail="The target farm must belong to the same enterprise")
    duplicate = db.execute(select(FarmMembership).where(
        FarmMembership.user_id == membership.user_id,
        FarmMembership.farm_id == data.farm_id,
        FarmMembership.id != membership.id,
    )).scalar_one_or_none()
    if duplicate:
        raise HTTPException(status_code=409, detail="This member already belongs to the target farm")
    membership.farm_id = data.farm_id
    membership.role = data.role.value
    db.commit()
    return {"membership_id": membership.id, "farm_id": membership.farm_id, "role": membership.role}


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