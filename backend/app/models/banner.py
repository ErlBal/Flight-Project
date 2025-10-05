from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Text
# Use the same Base as other models (previous wrong path caused ImportError and app startup failure)
from app.models.base import Base

class Banner(Base):
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    # Use Text to allow long CDN or tracking URLs beyond 500 chars
    image_url = Column(Text, nullable=True)
    link_url = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
