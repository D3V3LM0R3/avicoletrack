from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.daily_report import DailyReport
from app.models.farm import Farm
from app.models.flock import Flock
from app.schemas.daily_report import DailyReportCreate, DailyReportResponse

router = APIRouter(prefix="/daily-reports", tags=["Daily Reports"])


@router.post("", response_model=DailyReportResponse, status_code=201)
def create_daily_report(report_data: DailyReportCreate, db: Session = Depends(get_db)):
    farm = db.get(Farm, report_data.farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")

    flock = None
    if report_data.flock_id is not None:
        flock = db.get(Flock, report_data.flock_id)
        if flock is None:
            raise HTTPException(status_code=404, detail="Flock not found")

    laying_percentage = None
    if report_data.bird_count > 0:
        laying_percentage = (report_data.eggs_produced / report_data.bird_count) * 100

    ratio = None
    if report_data.bird_count > 0:
        ratio = report_data.eggs_produced / report_data.bird_count

    report = DailyReport(
        farm_id=report_data.farm_id,
        flock_id=report_data.flock_id,
        report_date=report_data.report_date,
        bird_count=report_data.bird_count,
        mortality=report_data.mortality,
        eggs_produced=report_data.eggs_produced,
        laying_percentage=laying_percentage,
        ratio=ratio,
        hen_age=report_data.hen_age,
        egg_stock=report_data.egg_stock,
        cartons=report_data.cartons,
        alveoli=report_data.alveoli,
        remaining_eggs=report_data.remaining_eggs,
        notes=report_data.notes,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return report


@router.get("", response_model=list[DailyReportResponse])
def list_daily_reports(db: Session = Depends(get_db)):
    reports = db.query(DailyReport).order_by(DailyReport.report_date.desc()).all()
    return reports


@router.get("/{report_id}", response_model=DailyReportResponse)
def get_daily_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(DailyReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Daily report not found")
    return report