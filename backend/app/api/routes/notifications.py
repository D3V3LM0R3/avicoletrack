from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.schemas.notification import FarmNotificationCreate
from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.core.permissions import require_farm_access, require_membership_permission


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    ).scalars().all()


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.read_at = notification.read_at or datetime.utcnow()
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/farm", response_model=list[NotificationResponse], status_code=201)
def send_farm_notification(data: FarmNotificationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_farm_access(current_user, data.farm_id, db)
    require_membership_permission(current_user, data.farm_id, "send_notification", db)
    owner_id = db.execute(select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id).where(Farm.id == data.farm_id)).scalar_one()
    manager_ids = db.execute(select(FarmMembership.user_id).where(FarmMembership.farm_id == data.farm_id, FarmMembership.role == "MANAGER", FarmMembership.is_active.is_(True))).scalars().all()
    notifications = [Notification(user_id=user_id, title=data.title, message=data.message) for user_id in {owner_id, *manager_ids}]
    db.add_all(notifications)
    db.commit()
    return notifications