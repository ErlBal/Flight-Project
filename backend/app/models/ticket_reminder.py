from sqlalchemy import Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.models.base import Base

class TicketReminder(Base):
    __tablename__ = "ticket_reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    hours_before: Mapped[int] = mapped_column(Integer)  # e.g. 24, 2, or custom
    type: Mapped[str] = mapped_column(String(16), default="custom")  # standard|custom
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)  # when to fire (UTC)
    sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
