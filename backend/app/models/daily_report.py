from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.farm import Base


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    flock_id: Mapped[int | None] = mapped_column(ForeignKey("flocks.id", ondelete="RESTRICT"), nullable=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    bird_count: Mapped[int] = mapped_column(Integer, nullable=False)
    mortality: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    eggs_produced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    laying_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    hen_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    egg_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cartons: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    alveoli: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    remaining_eggs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    feed_used_bags: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    water_used_liters: Mapped[float] = mapped_column(Float, nullable=False, default=0)