from sqlalchemy import String, Integer, ForeignKey, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.models.base import Base

class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    airline: Mapped[str] = mapped_column(String(120))
    flight_number: Mapped[str] = mapped_column(String(32), index=True)
    origin: Mapped[str] = mapped_column(String(64), index=True)
    destination: Mapped[str] = mapped_column(String(64), index=True)
    departure: Mapped[datetime] = mapped_column(DateTime)
    arrival: Mapped[datetime] = mapped_column(DateTime)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    seats_total: Mapped[int] = mapped_column(Integer)
    seats_available: Mapped[int] = mapped_column(Integer)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    # Количество пересадок (0 = прямой). Используется для фильтрации.
    stops: Mapped[int] = mapped_column(Integer, default=0)
