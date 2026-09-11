from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.permissions import require_farm_access
from app.db.session import get_db
from app.models.daily_report import DailyReport
from app.models.farm import Farm
from app.models.flock import Flock
from app.models.user import User
from app.models.stock_movement import StockMovement
from app.models.market_price import MarketPrice
from app.models.event import Event
from app.models.enterprise import Enterprise

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/farm-comparison")
def compare_farms(
    farm_ids: list[int] = Query(..., min_length=1, max_length=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for farm_id in farm_ids:
        require_farm_access(current_user, farm_id, db)
    reports = db.execute(select(DailyReport).where(DailyReport.farm_id.in_(farm_ids))).scalars().all()
    farms = db.execute(select(Farm).where(Farm.id.in_(farm_ids))).scalars().all()
    flock_rows = db.execute(
        select(Flock).where(Flock.farm_id.in_(farm_ids), Flock.archived.is_(False))
    ).scalars().all()
    latest_reports = _latest_reports_by_flock(reports)
    totals = {farm_id: {"hens_reported": 0, "eggs": 0, "laying": [], "mortality": 0, "stock": 0} for farm_id in farm_ids}
    for flock in flock_rows:
        totals[flock.farm_id]["hens_reported"] += flock.bird_count or 0
    for report in latest_reports:
        total = totals[report.farm_id]
        total["eggs"] += report.eggs_produced or 0
        total["mortality"] += report.mortality or 0
        if report.laying_percentage is not None:
            total["laying"].append(report.laying_percentage)
    for farm in farms:
        totals[farm.id]["stock"] = farm.egg_stock or 0
    return [
        {
            "farm_id": farm_id,
            "hens_reported": total["hens_reported"],
            "eggs": total["eggs"],
            "average_laying_percentage": sum(total["laying"]) / len(total["laying"]) if total["laying"] else None,
            "mortality": total["mortality"],
            "stock": total["stock"],
        }
        for farm_id in farm_ids
        for total in [totals.get(farm_id, {"hens_reported": 0, "eggs": 0, "laying": [], "mortality": 0, "stock": 0})]
    ]


@router.get("/dashboard")
def dashboard(period: str = Query("today", pattern="^(today|7d|30d|custom)$"), start_date: date | None = Query(None), end_date: date | None = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    farms = db.execute(select(Farm).where(Farm.active.is_(True))).scalars().all()
    farms = [farm for farm in farms if _can_access(farm.id, current_user, db)]
    farm_ids = [farm.id for farm in farms]

    start_date = start_date or date.today()
    if period == "7d":
        start_date -= timedelta(days=6)
    elif period == "30d":
        start_date -= timedelta(days=29)

    reports_query = select(DailyReport).where(DailyReport.farm_id.in_(farm_ids), DailyReport.report_date >= start_date)
    if end_date:
        reports_query = reports_query.where(DailyReport.report_date <= end_date)
    reports = db.execute(reports_query).scalars().all() if farm_ids else []

    flock_totals = {}
    for farm in farms:
        flock_rows = db.execute(
            select(Flock).where(Flock.farm_id == farm.id, Flock.archived.is_(False))
        ).scalars().all()
        flock_totals[farm.id] = sum(flock.bird_count for flock in flock_rows)

    latest_reports = _latest_reports_by_flock(reports)
    total_hens = sum(flock_totals.values())
    total_eggs = sum(report.eggs_produced or 0 for report in latest_reports)
    total_mortality = sum(report.mortality or 0 for report in latest_reports)
    total_stock = sum(farm.egg_stock or 0 for farm in farms)
    total_food = sum(farm.food_quantity or 0 for farm in farms)

    return {
        "farms": len(farms),
        "hens": total_hens,
        "eggs": total_eggs,
        "mortality": total_mortality,
        "stock": total_stock,
        "average_laying_percentage": sum(report.laying_percentage or 0 for report in latest_reports) / len(latest_reports) if latest_reports else None,
        "food": total_food,
        "farms_detail": [{
            "farm_id": farm.id,
            "farm_name": farm.name,
            "hens": flock_totals.get(farm.id, 0),
            "eggs": sum(report.eggs_produced or 0 for report in latest_reports if report.farm_id == farm.id),
            "mortality": sum(report.mortality or 0 for report in latest_reports if report.farm_id == farm.id),
            "stock": farm.egg_stock or 0,
            "food": farm.food_quantity or 0,
        } for farm in farms],
    }


@router.get("/farms/{farm_id}/overview")
def farm_overview(
    farm_id: int,
    period: str = Query("30d", pattern="^(7d|30d|90d|year|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return current farm stock and period-based production activity."""
    farm = db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    require_farm_access(current_user, farm_id, db)

    end_date = date.today()
    start_date = None
    if period == "7d":
        start_date = end_date - timedelta(days=6)
    elif period == "30d":
        start_date = end_date - timedelta(days=29)
    elif period == "90d":
        start_date = end_date - timedelta(days=89)
    elif period == "year":
        start_date = date(end_date.year, 1, 1)

    reports_query = select(DailyReport).where(DailyReport.farm_id == farm_id)
    if start_date is not None:
        reports_query = reports_query.where(DailyReport.report_date >= start_date)
    reports = db.execute(reports_query.order_by(DailyReport.report_date, DailyReport.id)).scalars().all()

    production = sum(report.eggs_produced or 0 for report in reports)
    mortality = sum(report.mortality or 0 for report in reports)
    laying_values = [report.laying_percentage for report in reports if report.laying_percentage is not None]
    average_laying = sum(laying_values) / len(laying_values) if laying_values else None

    monthly: dict[str, dict[str, float | int]] = {}
    for report in reports:
        month_key = report.report_date.strftime("%Y-%m")
        bucket = monthly.setdefault(month_key, {"production": 0, "mortality": 0})
        bucket["production"] += report.eggs_produced or 0
        bucket["mortality"] += report.mortality or 0

    best_production = max(monthly.items(), key=lambda item: item[1]["production"], default=None)
    highest_mortality = max(monthly.items(), key=lambda item: item[1]["mortality"], default=None)
    monthly_activity = [
        {
            "label": month,
            "production": values["production"],
            "mortality": values["mortality"],
        }
        for month, values in sorted(monthly.items())
    ]

    return {
        "farm": {
            "id": farm.id,
            "name": farm.name,
            "location": farm.location,
            "active": farm.active,
        },
        "period": period,
        "period_start": start_date.isoformat() if start_date else None,
        "period_end": end_date.isoformat(),
        "stock": {
            "food_quantity": float(farm.food_quantity or 0),
            "food_unit": farm.food_unit,
            "food_type": farm.food_type,
            "eggs": farm.egg_stock or 0,
            "alveoli": farm.alveoli or 0,
            "cartons": farm.cartons or 0,
        },
        "results": {
            "production": production,
            "mortality": mortality,
            "average_laying_percentage": average_laying,
            "report_count": len(reports),
        },
        "highlights": {
            "best_production_month": {
                "month": best_production[0],
                "production": best_production[1]["production"],
            } if best_production else None,
            "highest_mortality_month": {
                "month": highest_mortality[0],
                "mortality": highest_mortality[1]["mortality"],
            } if highest_mortality else None,
        },
        "activity": monthly_activity,
    }


def _latest_reports_by_flock(reports: list[DailyReport]) -> list[DailyReport]:
    latest: dict[tuple[int, int], DailyReport] = {}
    for report in reports:
        if report.flock_id is None:
            continue
        key = (report.farm_id, report.flock_id)
        current = latest.get(key)
        if current is None or (report.report_date, report.id or 0) > (current.report_date, current.id or 0):
            latest[key] = report
    return list(latest.values())


def _can_access(farm_id: int, user: User, db: Session) -> bool:
    try:
        require_farm_access(user, farm_id, db)
        return True
    except Exception:
        return False


@router.get("/owner/financial-summary")
def owner_financial_summary(
    period: str = Query("30d", pattern="^(1d|7d|30d|90d|year|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get owner's complete financial summary across all farms"""
    if current_user.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only owners can view financial summary")

    # Get owner's enterprise and farms
    enterprise = db.execute(
        select(Enterprise).where(Enterprise.owner_id == current_user.id)
    ).scalars().first()
    
    if not enterprise:
        return {
            "total_capital": 0,
            "total_revenue": 0,
            "total_cost": 0,
            "net_profit": 0,
            "margin_percentage": 0,
            "farms": []
        }

    farms = db.execute(select(Farm).where(Farm.enterprise_id == enterprise.id, Farm.active.is_(True))).scalars().all()
    farm_ids = [farm.id for farm in farms]
    
    # Calculate date range
    end_date = date.today()
    start_date = end_date
    if period == "7d":
        start_date -= timedelta(days=6)
    elif period == "1d":
        start_date = end_date
    elif period == "30d":
        start_date -= timedelta(days=29)
    elif period == "90d":
        start_date -= timedelta(days=89)
    elif period == "year":
        start_date = date(end_date.year, 1, 1)

    # Get stock movements (inputs/outputs)
    movements = db.execute(
        select(StockMovement).where(
            and_(
                StockMovement.farm_id.in_(farm_ids),
                StockMovement.movement_date >= start_date,
            )
        )
    ).scalars().all()

    # Transaction values are snapshots captured at movement validation time.
    capital = Decimal(0)
    revenue = Decimal(0)
    total_cost = Decimal(0)
    feed_cost = Decimal(0)
    bird_cost = Decimal(0)

    for movement in movements:
        if movement.status != "validated":
            continue
        
        value = Decimal(str(movement.total_value or 0))
        if movement.movement_type == "Entrée":
            capital += value
            if "aliment" in movement.stock_type.lower(): feed_cost += value
            if any(word in movement.stock_type.lower() for word in ("sujet", "volaille", "poule", "oiseau", "chick")): bird_cost += value
            total_cost += value
        elif movement.movement_type == "Sortie":
            revenue += value

    events = db.execute(select(Event).where(Event.farm_id.in_(farm_ids), Event.event_date >= start_date)).scalars().all() if farm_ids else []
    event_cost = sum((Decimal(str(event.financial_amount or 0)) for event in events if event.status == "confirmed" and event.financial_type == "cost"), Decimal(0))
    event_benefit = sum((Decimal(str(event.financial_amount or 0)) for event in events if event.status == "confirmed" and event.financial_type == "benefit"), Decimal(0))
    total_cost = total_cost + event_cost
    revenue = revenue + event_benefit

    if capital == 0:
        bird_price = db.execute(select(MarketPrice).where(MarketPrice.product_key == "chicken").order_by(MarketPrice.price_date.desc()).limit(1)).scalars().first()
        flock_count = db.execute(select(Flock.bird_count).where(Flock.farm_id.in_(farm_ids), Flock.archived.is_(False))).scalars().all()
        capital = sum((Decimal(str(count or 0)) for count in flock_count), Decimal(0)) * Decimal(str((bird_price.price_mid if bird_price and bird_price.price_mid else bird_price.price if bird_price else 0)))
    net_profit = revenue - total_cost
    margin_percentage = float((net_profit / revenue * 100)) if revenue > 0 else 0

    # Get farm details
    farms_detail = []
    for farm in farms:
        farm_movements = [m for m in movements if m.farm_id == farm.id]
        farm_capital = Decimal(0)
        farm_revenue = Decimal(0)
        farm_cost = Decimal(0)

        for m in farm_movements:
            if m.status != "validated":
                continue
            value = Decimal(str(m.total_value or 0))
            if m.movement_type == "Entrée":
                farm_cost += value
                farm_capital += value
            else:
                farm_revenue += value
        for event in events:
            if event.farm_id == farm.id and event.status == "confirmed" and event.financial_amount:
                if event.financial_type == "cost": farm_cost += Decimal(str(event.financial_amount))
                elif event.financial_type == "benefit": farm_revenue += Decimal(str(event.financial_amount))

        farm_profit = farm_revenue - farm_cost
        farm_margin = float((farm_profit / farm_revenue * 100)) if farm_revenue > 0 else 0

        farms_detail.append({
            "farm_id": farm.id,
            "farm_name": farm.name,
            "capital": float(farm_capital),
            "revenue": float(farm_revenue),
            "cost": float(farm_cost),
            "profit": float(farm_profit),
            "margin_percentage": farm_margin
        })

    farm_report_stats = []
    for farm in farms:
        farm_reports = db.execute(
            select(DailyReport).where(
                DailyReport.farm_id == farm.id,
                DailyReport.report_date >= start_date,
                DailyReport.report_date <= end_date,
            )
        ).scalars().all()
        farm_report_stats.append({
            "farm_id": farm.id,
            "farm_name": farm.name,
            "eggs": sum(int(report.eggs_produced or 0) for report in farm_reports),
            "mortality": sum(int(report.mortality or 0) for report in farm_reports),
        })
    best_eggs = max(farm_report_stats, key=lambda item: item["eggs"], default=None)
    highest_mortality = max(farm_report_stats, key=lambda item: item["mortality"], default=None)

    return {
        "period": period,
        "total_capital": float(capital),
        "total_revenue": float(revenue),
        "total_cost": float(total_cost),
        "net_profit": float(net_profit),
        "margin_percentage": margin_percentage,
        "farms": sorted(farms_detail, key=lambda x: x["profit"], reverse=True),
        "comparison": {"highest_productivity": best_eggs, "highest_mortality": highest_mortality, "farms": farm_report_stats},
    }


@router.get("/owner/market-prices")
def owner_market_prices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get latest market prices for key products"""
    if current_user.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only owners can view market prices")

    products = ["Volaille", "Aliment", "Œuf", "Alvéole", "Carton"]
    prices_by_product = {}

    for product in products:
        latest = db.execute(
            select(MarketPrice)
            .where(MarketPrice.product.ilike(f"%{product}%"))
            .order_by(MarketPrice.price_date.desc())
            .limit(1)
        ).scalars().first()

        if latest:
            prices_by_product[product] = {
                "price": float(latest.price),
                "price_low": float(latest.price_low or latest.price),
                "price_mid": float(latest.price_mid or latest.price),
                "price_high": float(latest.price_high or latest.price),
                "notes": {"low": latest.note_low, "mid": latest.note_mid, "high": latest.note_high},
                "tags": latest.tags,
                "unit": latest.unit,
                "date": latest.price_date.isoformat(),
                "source": latest.source
            }

    return prices_by_product


@router.get("/owner/profit-trends")
def owner_profit_trends(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get profit trends over the last N months"""
    if current_user.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only owners can view profit trends")

    enterprise = db.execute(
        select(Enterprise).where(Enterprise.owner_id == current_user.id)
    ).scalars().first()

    if not enterprise:
        return {"trends": []}

    farm_ids = [farm.id for farm in db.execute(select(Farm).where(Farm.enterprise_id == enterprise.id, Farm.active.is_(True))).scalars().all()]
    end_date = date.today()
    start_date = end_date - timedelta(days=30 * months)

    movements = db.execute(
        select(StockMovement).where(
            and_(
                StockMovement.farm_id.in_(farm_ids),
                StockMovement.movement_date >= start_date,
                StockMovement.status == "validated"
            )
        )
    ).scalars().all()

    # Group by month
    monthly_data = {}
    for movement in movements:
        month_key = movement.movement_date.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {"revenue": Decimal(0), "cost": Decimal(0)}

        stock_type = movement.stock_type.lower()

        if movement.movement_type == "Sortie" and "œuf" in stock_type:
            price = db.execute(
                select(MarketPrice)
                .where(MarketPrice.product.ilike("%œuf%"))
                .order_by(MarketPrice.price_date.desc())
                .limit(1)
            ).scalars().first()
            quantity = Decimal(str(movement.quantity or 0))
            unit_price = Decimal(str(price.price)) if price else Decimal("1.5")
            monthly_data[month_key]["revenue"] += quantity * unit_price

        elif movement.movement_type == "Entrée":
            if "aliment" in stock_type:
                price = db.execute(
                    select(MarketPrice)
                    .where(MarketPrice.product.ilike("%aliment%"))
                    .order_by(MarketPrice.price_date.desc())
                    .limit(1)
                ).scalars().first()
                quantity = Decimal(str(movement.quantity or 0))
                unit_price = Decimal(str(price.price)) if price else Decimal("50")
                monthly_data[month_key]["cost"] += quantity * unit_price
            elif "volaille" in stock_type:
                price = db.execute(
                    select(MarketPrice)
                    .where(MarketPrice.product.ilike("%volaille%"))
                    .order_by(MarketPrice.price_date.desc())
                    .limit(1)
                ).scalars().first()
                quantity = Decimal(str(movement.quantity or 0))
                unit_price = Decimal(str(price.price)) if price else Decimal("100")
                monthly_data[month_key]["cost"] += quantity * unit_price

    trends = [
        {
            "month": month,
            "revenue": float(data["revenue"]),
            "cost": float(data["cost"]),
            "profit": float(data["revenue"] - data["cost"])
        }
        for month in sorted(monthly_data.keys())
        for data in [monthly_data[month]]
    ]

    return {"trends": trends}