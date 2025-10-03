from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.models.base import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    confirmation_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    flight_id: Mapped[int] = mapped_column(Integer, ForeignKey("flights.id"))
    status: Mapped[str] = mapped_column(String(32), default="paid")  # paid, refunded, canceled
    purchased_at: Mapped[datetime] = mapped_column(DateTime)
