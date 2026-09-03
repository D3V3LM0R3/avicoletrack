from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.permissions import require_farm_access, require_membership_permission
from app.db.session import get_db
from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.models.flock import Flock
from app.models.notification import Notification
from app.models.stock_movement import StockMovement
from app.models.market_price import MarketPrice
from app.models.user import User
from app.schemas.stock_movement import StockMovementCreate, StockMovementResponse, StockMovementValidate

router = APIRouter(prefix="/stock-movements", tags=["Stock Movements"])

VALID_STOCK_TYPES = {
    "Aliments",
    "Œufs",
    "Cartons",
    "Alvéoles",
    "Sujets",
    "aliments",
    "oeufs",
    "cartons",
    "alveoles",
    "sujets",
    "Autre",
    "autre",
    "other",
}
VALID_MOVEMENT_TYPES = {"Entrée", "Sortie"}


def _resolve_price(db: Session, movement: StockMovement) -> tuple[float | None, int | None, str | None]:
    if movement.unit_price is not None:
        return float(movement.unit_price), movement.market_price_id, movement.price_tier
    product = (movement.product_name or movement.stock_type).strip().lower()
    category_keys = {
        "œufs": "egg", "oeufs": "egg", "cartons": "carton", "alvéoles": "alveole",
        "alveoles": "alveole", "aliments": "feed", "sujets": "chicken",
    }
    product_key = category_keys.get(product, product)
    price = db.execute(
        select(MarketPrice).where(
            (MarketPrice.product_key.ilike(product_key)) | (MarketPrice.product.ilike(f"%{product}%"))
        ).order_by(MarketPrice.price_date.desc(), MarketPrice.id.desc()).limit(1)
    ).scalars().first()
    if price is None:
        return None, None, None
    tier = movement.price_tier or "mid"
    value = getattr(price, f"price_{tier}", None) or price.price
    return float(value), price.id, tier


def _available_stock(db: Session, farm_id: int, stock_type: str, flock_id: int | None = None) -> float:
    farm = db.get(Farm, farm_id)
    normalized = stock_type.lower()
    if farm is not None:
        if normalized in {"aliments", "aliment"}:
            return max(0.0, float(farm.food_quantity or 0))
        if normalized in {"œufs", "oeufs", "œuf", "egg"}:
            return max(0.0, float(farm.egg_stock or 0))
        if normalized in {"cartons", "carton"}:
            return max(0.0, float(farm.cartons or 0))
        if normalized in {"alvéoles", "alveoles", "alvéole", "alveole"}:
            return max(0.0, float(farm.alveoli or 0))
        if normalized in {"sujets", "sujet"}:
            if flock_id is not None:
                flock = db.get(Flock, flock_id)
                return max(0.0, float(flock.bird_count if flock and flock.farm_id == farm_id else 0))
            return max(0.0, float(sum(row[0] for row in db.query(Flock.bird_count).filter(Flock.farm_id == farm_id, Flock.archived.is_(False)).all())))
    rows = db.execute(
        select(StockMovement.movement_type, StockMovement.quantity).where(
            StockMovement.farm_id == farm_id,
            StockMovement.stock_type == stock_type,
            StockMovement.status == "validated",
        )
    ).all()
    return sum(float(quantity) if movement_type == "Entrée" else -float(quantity) for movement_type, quantity in rows)


@router.get("", response_model=list[StockMovementResponse])
def list_stock_movements(
    farm_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "OWNER":
        accessible_farm_ids = db.execute(
            select(Farm.id)
            .join(Enterprise, Farm.enterprise_id == Enterprise.id)
            .where(
                Farm.active.is_(True),
                Enterprise.owner_id == current_user.id,
                Enterprise.is_active.is_(True),
            )
        ).scalars().all()
    else:
        accessible_farm_ids = db.execute(
            select(Farm.id)
            .join(FarmMembership, FarmMembership.farm_id == Farm.id)
            .where(
                Farm.active.is_(True),
                FarmMembership.user_id == current_user.id,
                FarmMembership.is_active.is_(True),
            )
        ).scalars().all()

    if farm_id is not None:
        require_farm_access(current_user, farm_id, db)
        query = select(StockMovement).where(StockMovement.farm_id == farm_id)
    else:
        if not accessible_farm_ids:
            return []
        query = select(StockMovement).where(StockMovement.farm_id.in_(accessible_farm_ids))

    movements = db.execute(
        query.order_by(StockMovement.movement_date.desc(), StockMovement.id.desc())
    ).scalars().all()
    user_ids = {user_id for movement in movements for user_id in (movement.created_by, movement.validated_by) if user_id}
    users = {user.id: user.name for user in db.execute(select(User).where(User.id.in_(user_ids))).scalars().all()} if user_ids else {}
    for movement in movements:
        movement.created_by_name = users.get(movement.created_by)
        movement.validated_by_name = users.get(movement.validated_by)
    return movements


@router.post("", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def create_stock_movement(
    data: StockMovementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can create stock movements")
    require_farm_access(current_user, data.farm_id, db)
    if data.flock_id is not None:
        flock = db.get(Flock, data.flock_id)
        if flock is None or flock.farm_id != data.farm_id or flock.archived:
            raise HTTPException(status_code=400, detail="La bande sélectionnée n'appartient pas à cette ferme.")

    if data.stock_type not in VALID_STOCK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid stock_type")
    if data.movement_type not in VALID_MOVEMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid movement_type")
    if data.movement_type == "Sortie":
        available = _available_stock(db, data.farm_id, data.stock_type, data.flock_id)
        if data.quantity > available:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuffisant pour {data.stock_type}: disponible {available:g} {data.unit}.",
            )
    if data.stock_type.lower() == "sujets":
        if data.flock_id is None:
            raise HTTPException(status_code=400, detail="A flock must be selected for subject stock movements")
        if not data.quantity.is_integer():
            raise HTTPException(status_code=400, detail="Subject movements must use a whole number")

    stock_movement = StockMovement(
        farm_id=data.farm_id,
        flock_id=data.flock_id,
        stock_type=data.stock_type,
        movement_type=data.movement_type,
        quantity=data.quantity,
        unit=data.unit,
        product_name=data.product_name or data.stock_type,
        market_price_id=data.market_price_id,
        unit_price=data.unit_price,
        price_tier=data.price_tier or "mid",
        note=data.note,
        movement_date=data.movement_date or datetime.utcnow(),
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        status="pending",
    )

    db.add(stock_movement)
    db.flush()

    manager_ids = db.execute(
        select(FarmMembership.user_id).where(
            FarmMembership.farm_id == data.farm_id,
            FarmMembership.role == "MANAGER",
            FarmMembership.is_active.is_(True),
        )
    ).scalars().all()

    for user_id in set(manager_ids):
        db.add(
            Notification(
                user_id=user_id,
                title="Mouvement de stock à confirmer",
                message=(
                    f"Le mouvement {data.movement_type.lower()} de {data.quantity} {data.unit} "
                    f"({data.stock_type}) a été enregistré le {stock_movement.movement_date:%d/%m/%Y %H:%M}. "
                    "Merci de confirmer la saisie et l'heure exacte."
                ),
            )
        )

    db.commit()
    db.refresh(stock_movement)
    return stock_movement


@router.patch("/{movement_id}/validate", response_model=StockMovementResponse)
def validate_stock_movement(
    movement_id: int,
    data: StockMovementValidate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    confirmation_message = data.confirmation_message.strip()
    if not confirmation_message:
        raise HTTPException(status_code=422, detail="A confirmation message is required")
    movement = db.get(StockMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    require_farm_access(current_user, movement.farm_id, db)
    if current_user.role == "WORKER":
        require_membership_permission(current_user, movement.farm_id, "confirm_stock_movement", db)
    elif current_user.role not in {"OWNER", "MANAGER"}:
        raise HTTPException(status_code=403, detail="You are not allowed to validate stock movements")
    if movement.status != "pending":
        raise HTTPException(status_code=409, detail="This stock movement has already been processed")
    if movement.movement_type == "Sortie":
        available = _available_stock(db, movement.farm_id, movement.stock_type, movement.flock_id)
        if movement.quantity > available:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {movement.stock_type}: disponible {available:g} {movement.unit}.")

    if movement.stock_type.lower() == "sujets":
        if movement.flock_id is None:
            raise HTTPException(status_code=400, detail="A flock must be selected before a subject stock movement can be validated")
        delta = movement.quantity if movement.movement_type == "Entrée" else -movement.quantity
        flock = db.get(Flock, movement.flock_id)
        if flock is None or flock.archived or flock.farm_id != movement.farm_id:
            raise HTTPException(status_code=400, detail="The flock is no longer available")
        next_count = flock.bird_count + int(delta)
        if next_count < 0:
            raise HTTPException(status_code=400, detail="The flock cannot have a negative headcount")
        flock.bird_count = next_count
        flock.updated_at = datetime.utcnow()

    movement.status = "validated"
    movement.validated_by = current_user.id
    movement.validated_at = datetime.utcnow()
    movement.confirmation_message = confirmation_message
    unit_price, market_price_id, price_tier = _resolve_price(db, movement)
    movement.unit_price = unit_price
    movement.market_price_id = market_price_id
    movement.price_tier = price_tier
    movement.total_value = (unit_price * float(movement.quantity)) if unit_price is not None else None
    if movement.stock_type.lower() in {"aliments"}:
        farm = db.get(Farm, movement.farm_id)
        if farm is not None:
            farm.food_quantity = float(farm.food_quantity or 0) + (float(movement.quantity) if movement.movement_type == "Entrée" else -float(movement.quantity))
    elif movement.stock_type.lower() in {"œufs", "oeufs"}:
        farm = db.get(Farm, movement.farm_id)
        if farm is not None:
            farm.egg_stock = max(0, int(farm.egg_stock or 0) + (int(movement.quantity) if movement.movement_type == "Entrée" else -int(movement.quantity)))
            farm.cartons = farm.egg_stock // 360
            farm.alveoli = (farm.egg_stock % 360) // 30
    if movement.stock_type.lower() == "sujets":
        farm = db.get(Farm, movement.farm_id)
        if farm is not None:
            farm.subject_count = sum(
                row[0] for row in db.query(Flock.bird_count).filter(Flock.farm_id == farm.id, Flock.archived.is_(False)).all()
            )

    manager_ids = db.execute(
        select(FarmMembership.user_id).where(
            FarmMembership.farm_id == movement.farm_id,
            FarmMembership.role == "MANAGER",
            FarmMembership.is_active.is_(True),
        )
    ).scalars().all()
    owner_id = db.execute(
        select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id).where(Farm.id == movement.farm_id)
    ).scalar_one()
    for user_id in {owner_id, *manager_ids}:
        db.add(Notification(
            user_id=user_id,
            title="Mouvement confirmé",
            message=(
                f"Le mouvement {movement.movement_type.lower()} de {movement.quantity} {movement.unit} "
                f"({movement.stock_type}) a été confirmé le {movement.validated_at:%d/%m/%Y %H:%M}."
                f"{f' Observation: {movement.confirmation_message}' if movement.confirmation_message else ''}"
            ),
        ))

    db.commit()
    db.refresh(movement)
    return movement


@router.patch("/{movement_id}/cancel", response_model=StockMovementResponse)
def cancel_stock_movement(
    movement_id: int,
    data: StockMovementValidate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    confirmation_message = data.confirmation_message.strip()
    if not confirmation_message:
        raise HTTPException(status_code=422, detail="A cancellation message is required")
    movement = db.get(StockMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    require_farm_access(current_user, movement.farm_id, db)
    if current_user.role == "WORKER":
        require_membership_permission(current_user, movement.farm_id, "confirm_stock_movement", db)
    elif current_user.role not in {"OWNER", "MANAGER"}:
        raise HTTPException(status_code=403, detail="You are not allowed to cancel stock movements")
    if movement.status != "pending":
        raise HTTPException(status_code=409, detail="This stock movement has already been processed")

    movement.status = "cancelled"
    movement.validated_by = current_user.id
    movement.validated_at = datetime.utcnow()
    movement.confirmation_message = confirmation_message

    manager_ids = db.execute(
        select(FarmMembership.user_id).where(
            FarmMembership.farm_id == movement.farm_id,
            FarmMembership.role == "MANAGER",
            FarmMembership.is_active.is_(True),
        )
    ).scalars().all()
    owner_id = db.execute(
        select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id).where(Farm.id == movement.farm_id)
    ).scalar_one()
    for user_id in {owner_id, *manager_ids}:
        db.add(Notification(
            user_id=user_id,
            title="Mouvement annulé",
            message=(
                f"Le mouvement {movement.movement_type.lower()} de {movement.quantity} {movement.unit} "
                f"({movement.stock_type}) a été annulé le {movement.validated_at:%d/%m/%Y %H:%M}."
                f"{f' Motif: {movement.confirmation_message}' if movement.confirmation_message else ''}"
            ),
        ))

    db.commit()
    db.refresh(movement)
    return movement


@router.delete("/{movement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_movement(
    movement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    movement = db.get(StockMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    require_farm_access(current_user, movement.farm_id, db)
    if current_user.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only the owner can delete stock movements")
    if movement.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending stock movements can be deleted")
    db.delete(movement)
    db.commit()
    return None


@router.get("/summary", response_model=list[dict])
def stock_summary(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_farm_access(current_user, farm_id, db)
    rows = db.execute(
        select(
            StockMovement.stock_type,
            StockMovement.unit,
            StockMovement.movement_type,
            StockMovement.quantity,
            StockMovement.movement_date,
        )
        .where(StockMovement.farm_id == farm_id)
        .where(StockMovement.status == "validated")
        .order_by(StockMovement.movement_date.desc())
    ).all()

    summary = []
    for stock_type, unit, movement_type, quantity, movement_date in rows:
        summary.append(
            {
                "stock_type": stock_type,
                "unit": unit,
                "movement_type": movement_type,
                "quantity": float(quantity),
                "movement_date": movement_date,
            }
        )

    return summary
