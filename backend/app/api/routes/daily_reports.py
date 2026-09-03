from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_farm_access, require_flock_access
from app.models.daily_report import DailyReport
from app.models.farm import Farm
from app.models.flock import Flock
from app.models.user import User
from app.schemas.daily_report import DailyReportCreate, DailyReportResponse, DailyReportUpdate
from app.services.daily_reports import calculate_kpis, create_report_alerts

router = APIRouter(prefix="/daily-reports", tags=["Daily Reports"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _created_at_for_comparison(value: datetime) -> datetime:
    return value.replace(tzinfo=None) if value.tzinfo is not None else value


def _sync_report_effects(
    db: Session,
    report: DailyReport,
    previous_feed: float = 0,
    previous_water: float = 0,
    previous_eggs: int = 0,
    previous_mortality: int = 0,
) -> None:
    farm = db.get(Farm, report.farm_id)
    if farm is not None:
        farm.egg_stock = max(0, int(farm.egg_stock or 0) + int(report.eggs_produced or 0) - previous_eggs)
        farm.cartons = farm.egg_stock // 360
        farm.alveoli = (farm.egg_stock % 360) // 30
        farm.mortality = max(0, int(report.mortality or 0))
        farm.food_quantity = max(0.0, float(farm.food_quantity or 0.0) + previous_feed - float(report.feed_used_bags or 0.0))
        farm.water_quantity = max(0.0, float(farm.water_quantity or 0.0) + previous_water - float(report.water_used_liters or 0.0))
    if report.flock_id is not None:
        flock = db.get(Flock, report.flock_id)
        if flock is not None and flock.farm_id == report.farm_id:
            if previous_mortality:
                flock.bird_count = max(0, int(flock.bird_count or 0) + previous_mortality - int(report.mortality or 0))
            else:
                flock.bird_count = max(0, int(report.bird_count or 0) - int(report.mortality or 0))
            flock.updated_at = _utc_now()

    if farm is not None:
        farm.subject_count = sum(
            row[0] for row in db.query(Flock.bird_count).filter(Flock.farm_id == farm.id, Flock.archived.is_(False)).all()
        )


@router.post("", response_model=DailyReportResponse, status_code=201)
def create_daily_report(
    report_data: DailyReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, report_data.farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")

    flock = db.get(Flock, report_data.flock_id) if report_data.flock_id is not None else None
    if report_data.flock_id is not None and flock is None:
        raise HTTPException(status_code=404, detail="Flock not found")
    if flock is not None and flock.farm_id != report_data.farm_id:
        raise HTTPException(status_code=400, detail="The flock does not belong to this farm")
    require_farm_access(current_user, report_data.farm_id, db)
    if flock is not None:
        require_flock_access(current_user, flock.id, db)
    if report_data.mortality > report_data.bird_count:
        raise HTTPException(status_code=422, detail="Mortality cannot exceed bird count")
    if report_data.eggs_produced > report_data.bird_count:
        raise HTTPException(status_code=422, detail="Eggs produced cannot exceed bird count")

    report = db.query(DailyReport).filter(
        DailyReport.farm_id == report_data.farm_id,
        DailyReport.flock_id == report_data.flock_id,
        DailyReport.report_date == report_data.report_date,
    ).first()
    if report is None:
        report = DailyReport(
            farm_id=report_data.farm_id,
            flock_id=report_data.flock_id,
            report_date=report_data.report_date,
            created_by=current_user.id,
            created_at=_utc_now(),
        )
        db.add(report)
    for field, value in report_data.model_dump().items():
        if field not in {"farm_id", "flock_id"}:
            setattr(report, field, value)
    calculate_kpis(report)
    _sync_report_effects(db, report)
    db.add(report)
    db.commit()
    db.refresh(report)
    create_report_alerts(db, report)
    db.commit()
    report.author_name = current_user.name
    report.created_by_name = current_user.name

    return report


@router.patch("/{report_id}", response_model=DailyReportResponse)
def update_daily_report(
    report_id: int,
    report_data: DailyReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.get(DailyReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Daily report not found")
    require_farm_access(current_user, report.farm_id, db)
    if report.flock_id is not None:
        require_flock_access(current_user, report.flock_id, db)

    if report.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the report creator can edit this report")
    if report.created_at is None:
        report.created_at = _utc_now()
        db.flush()
    if _created_at_for_comparison(report.created_at) < _utc_now() - timedelta(hours=2):
        raise HTTPException(status_code=403, detail="Reports can only be edited within two hours of creation")
    previous_feed = float(report.feed_used_bags or 0)
    previous_water = float(report.water_used_liters or 0)
    previous_eggs = int(report.eggs_produced or 0)
    previous_mortality = int(report.mortality or 0)
    for field, value in report_data.model_dump(exclude_unset=True).items():
        setattr(report, field, value)
    if report.mortality > report.bird_count:
        raise HTTPException(status_code=422, detail="Mortality cannot exceed bird count")
    if report.eggs_produced > report.bird_count:
        raise HTTPException(status_code=422, detail="Eggs produced cannot exceed bird count")
    calculate_kpis(report)
    _sync_report_effects(db, report, previous_feed=previous_feed, previous_water=previous_water, previous_eggs=previous_eggs, previous_mortality=previous_mortality)
    create_report_alerts(db, report)
    db.commit()
    db.refresh(report)
    report.author_name = current_user.name
    report.created_by_name = current_user.name
    return report


@router.get("", response_model=list[DailyReportResponse])
def list_daily_reports(
    farm_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports_query = db.query(DailyReport)
    if farm_id is not None:
        require_farm_access(current_user, farm_id, db)
        reports_query = reports_query.filter(DailyReport.farm_id == farm_id)
    reports = reports_query.filter(
        or_(DailyReport.notes.is_(None), ~DailyReport.notes.startswith("Action:"))
    ).order_by(DailyReport.report_date.desc()).all()
    reports = [report for report in reports if _can_access_report(report, current_user, db)]
    author_ids = {report.created_by for report in reports if report.created_by is not None}
    authors = {user.id: user.name for user in db.execute(select(User).where(User.id.in_(author_ids))).scalars().all()} if author_ids else {}
    for report in reports:
        report.author_name = authors.get(report.created_by)
        report.created_by_name = report.author_name
    return reports


@router.get("/{report_id}", response_model=DailyReportResponse)
def get_daily_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.get(DailyReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Daily report not found")
    require_farm_access(current_user, report.farm_id, db)
    if report.flock_id is not None:
        require_flock_access(current_user, report.flock_id, db)
    if report.created_by:
        author = db.get(User, report.created_by)
        report.author_name = author.name if author else None
    return report


def _can_access_report(report: DailyReport, user: User, db: Session) -> bool:
    try:
        require_farm_access(user, report.farm_id, db)
        if report.flock_id is not None:
            require_flock_access(user, report.flock_id, db)
        return True
    except HTTPException:
        return False