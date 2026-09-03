from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.models.notification import Notification
from app.models.user import User

LOW_EGG_STOCK_THRESHOLD = 100
HIGH_MORTALITY_RATE = 5.0
MIN_LAYING_PERCENTAGE = 30.0
MAX_LAYING_PERCENTAGE = 100.0


def calculate_kpis(report):
    live_hens = report.bird_count - report.mortality
    report.laying_percentage = (
        report.eggs_produced / live_hens * 100 if live_hens > 0 else None
    )
    report.ratio = report.eggs_produced / live_hens if live_hens > 0 else None


def create_report_alerts(db: Session, report) -> None:
    alerts: list[tuple[str, str]] = []
    laying = report.laying_percentage
    mortality_rate = report.mortality / report.bird_count * 100 if report.bird_count else 0

    if report.egg_stock <= 0:
        alerts.append(("Stock d'œufs vide", "Le stock d'œufs est à 0. Une action rapide est nécessaire."))
    elif report.egg_stock <= LOW_EGG_STOCK_THRESHOLD:
        alerts.append(("Stock d'œufs faible", f"Le stock est de {report.egg_stock} œufs."))

    if report.bird_count <= 0:
        alerts.append(("Effectif nul", "L'effectif est à 0. Vérifiez la saisie et la santé du troupeau."))

    if report.eggs_produced <= 0:
        alerts.append(("Production nulle", "La production d'œufs est à 0 pour cette période."))

    if mortality_rate > HIGH_MORTALITY_RATE:
        alerts.append(("Mortalité élevée", f"Le taux de mortalité est de {mortality_rate:.1f} %."))
    if laying is not None and not MIN_LAYING_PERCENTAGE <= laying <= MAX_LAYING_PERCENTAGE:
        alerts.append(("Production inhabituelle", f"Le taux de ponte est de {laying:.1f} %."))

    owner_id = select(Enterprise.owner_id).join(Farm, Farm.enterprise_id == Enterprise.id).where(
        Farm.id == report.farm_id
    ).scalar_subquery()
    recipient_ids = db.execute(
        select(User.id).where(
            (User.id == owner_id)
            | User.id.in_(
                select(FarmMembership.user_id).where(
                    FarmMembership.farm_id == report.farm_id,
                    FarmMembership.role == "MANAGER",
                    FarmMembership.is_active.is_(True),
                )
            )
        )
    ).scalars().all()

    for title, message in alerts:
        for user_id in recipient_ids:
            exists = db.execute(
                select(Notification.id).where(
                    Notification.user_id == user_id,
                    Notification.title == title,
                    Notification.message == message,
                )
            ).scalar_one_or_none()
            if exists is None:
                db.add(Notification(user_id=user_id, title=title, message=message))