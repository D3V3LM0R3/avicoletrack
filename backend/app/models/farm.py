from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    enterprise_id: Mapped[int] = mapped_column(
        ForeignKey("enterprises.id"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    food_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    food_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    food_unit: Mapped[str] = mapped_column(String(30), nullable=False, default="kg")
    water_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    water_unit: Mapped[str] = mapped_column(String(30), nullable=False, default="L")
    subject_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    egg_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    cartons: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    alveoli: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    mortality: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )