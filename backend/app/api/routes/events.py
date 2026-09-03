from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.permissions import require_farm_access, require_membership_permission
from app.db.session import get_db
from app.models.enterprise import Enterprise
from app.models.event import Event
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.models.flock import Flock
from app.models.notification import Notification
from app.models.user import User
from app.schemas.event import EventCreate, EventResponse, EventUpdate, EventConfirm
from datetime import datetime

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("", response_model=list[EventResponse], status_code=201)
def create_events(data: EventCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = []
    for farm_id in set(data.farm_ids):
        require_farm_access(current_user, farm_id, db)
        require_membership_permission(current_user, farm_id, "create_event", db)
        if data.flock_id is not None:
            flock = db.get(Flock, data.flock_id)
            if flock is None or flock.farm_id != farm_id or flock.archived:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="La bande sélectionnée n'appartient pas à cette ferme.")
        event = Event(farm_id=farm_id, type=data.type, title=data.title, event_date=data.event_date,
                      flock_id=data.flock_id,
                      description=data.description, reminder_date=data.reminder_date, created_by=current_user.id,
                      financial_type=data.financial_type, financial_amount=data.financial_amount)
        db.add(event)
        db.flush()
        owner_id = db.execute(select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id)
                              .where(Farm.id == farm_id)).scalar_one()
        manager_ids = db.execute(select(FarmMembership.user_id).where(
            FarmMembership.farm_id == farm_id, FarmMembership.role == "MANAGER",
            FarmMembership.is_active.is_(True))).scalars().all()
        notification_users = {owner_id, *manager_ids}
        for user_id in notification_users:
            db.add(Notification(
                user_id=user_id,
                event_id=event.id,
                title="Événement créé",
                message=f"L'événement '{data.title}' a été créé pour la ferme #{farm_id} et est en attente de validation.",
            ))
        if data.reminder_date:
            for user_id in notification_users:
                db.add(Notification(user_id=user_id, event_id=event.id, title=f"Rappel: {data.title}",
                                     message=f"{data.title} est prévu le {data.event_date:%d/%m/%Y %H:%M}.",
                                     scheduled_at=data.reminder_date))
        events.append(event)
    db.commit()
    return events


@router.get("", response_model=list[EventResponse])
def list_events(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = db.execute(select(Event).order_by(Event.event_date)).scalars().all()
    accessible = [event for event in events if _can_access(event, current_user, db)]
    user_ids = {user_id for event in accessible for user_id in (event.created_by, event.confirmed_by) if user_id}
    users = {user.id: user.name for user in db.execute(select(User).where(User.id.in_(user_ids))).scalars().all()} if user_ids else {}
    for event in accessible:
        event.created_by_name = users.get(event.created_by)
        event.confirmed_by_name = users.get(event.confirmed_by)
    return accessible


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, data: EventUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable.")
    require_farm_access(current_user, event.farm_id, db)
    if current_user.role not in {"OWNER", "MANAGER"}:
        raise HTTPException(status_code=403, detail="Seul un responsable peut modifier un événement.")
    if data.flock_id is not None:
        flock = db.get(Flock, data.flock_id)
        if flock is None or flock.farm_id != event.farm_id or flock.archived:
            raise HTTPException(status_code=400, detail="La bande sélectionnée n'appartient pas à cette ferme.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}/cancel", response_model=EventResponse)
def cancel_event(
    event_id: int,
    data: EventConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    confirmation_message = data.confirmation_message.strip()
    if not confirmation_message:
        raise HTTPException(status_code=422, detail="A cancellation message is required")
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    require_farm_access(current_user, event.farm_id, db)
    if current_user.role not in {"OWNER", "MANAGER"}:
        raise HTTPException(status_code=403, detail="Seul un responsable peut annuler un événement.")

    if event.status != "pending":
        raise HTTPException(status_code=400, detail="Seuls les événements en attente peuvent être annulés.")

    event.status = "cancelled"
    event.confirmation_message = confirmation_message
    event.confirmed_by = current_user.id
    event.confirmed_at = datetime.utcnow()

    owner_id = db.execute(select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id)
                          .where(Farm.id == event.farm_id)).scalar_one()
    manager_ids = db.execute(select(FarmMembership.user_id).where(
        FarmMembership.farm_id == event.farm_id,
        FarmMembership.role == "MANAGER",
        FarmMembership.is_active.is_(True),
    )).scalars().all()
    for user_id in {owner_id, *manager_ids}:
        db.add(Notification(
            user_id=user_id,
            event_id=event.id,
            title="Événement annulé",
            message=f"L'événement '{event.title}' a été annulé le {datetime.utcnow():%d/%m/%Y %H:%M}.",
        ))

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    if current_user.role != "OWNER":
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut supprimer un événement.")
    require_farm_access(current_user, event.farm_id, db)

    if event.status != "pending":
        raise HTTPException(status_code=400, detail="Seuls les événements en attente peuvent être supprimés.")

    db.delete(event)
    db.commit()
    return None


@router.patch("/{event_id}/confirm", response_model=EventResponse)
def confirm_event(
    event_id: int,
    data: EventConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manager confirms an event"""
    confirmation_message = data.confirmation_message.strip()
    if not confirmation_message:
        raise HTTPException(status_code=422, detail="A confirmation message is required")
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    require_farm_access(current_user, event.farm_id, db)
    if current_user.role not in {"OWNER", "MANAGER"}:
        raise HTTPException(status_code=403, detail="Seul un responsable peut confirmer un événement.")
    if event.status != "pending":
        raise HTTPException(status_code=409, detail="Cet événement a déjà été traité.")

    event.status = "confirmed"
    event.confirmation_message = confirmation_message
    event.confirmed_by = current_user.id
    event.confirmed_at = datetime.utcnow()

    owner_id = db.execute(select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id)
                          .where(Farm.id == event.farm_id)).scalar_one()
    manager_ids = db.execute(select(FarmMembership.user_id).where(
        FarmMembership.farm_id == event.farm_id,
        FarmMembership.role == "MANAGER",
        FarmMembership.is_active.is_(True),
    )).scalars().all()
    for user_id in {owner_id, *manager_ids}:
        db.add(Notification(
            user_id=user_id,
            event_id=event.id,
            title="Événement confirmé",
            message=f"L'événement '{event.title}' a été confirmé le {datetime.utcnow():%d/%m/%Y %H:%M}.",
        ))

    db.commit()
    db.refresh(event)
    return event


def _can_access(event: Event, user: User, db: Session) -> bool:
    try:
        require_farm_access(user, event.farm_id, db)
        return True
    except Exception:
        return False