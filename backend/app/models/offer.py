from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, func
from app.models.base import Base


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    price_from = Column(Numeric(10, 2), nullable=True)
    flight_ref = Column(String(50), nullable=True)  # произвольная ссылка: номер рейса, код акции и т.п.
    position = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
