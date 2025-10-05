from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.deps import get_current_identity
from app.models.notification import Notification

router = APIRouter()

class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    created_at: datetime
    read: bool

    class Config:
        from_attributes = True

class NotificationMark(BaseModel):
    read: bool

@router.get("/", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    items = db.query(Notification).filter(Notification.user_email == email.lower()).order_by(Notification.created_at.desc()).limit(200).all()
    return items

@router.get("/unread-count", response_model=dict)
def unread_count(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    count = db.query(Notification).filter(Notification.user_email == email, Notification.read == False).count()
    return {"unread": count}

@router.post("/{notif_id}/read")
def mark_notification(notif_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_email == email.lower()).first()
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
    n.read = True
    db.commit()
    return {"status": "ok"}


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Пометить все уведомления пользователя прочитанными."""
    email, _roles = identity
    db.query(Notification).filter(Notification.user_email == email.lower(), Notification.read == False).update({Notification.read: True})  # type: ignore
    db.commit()
    return {"status": "ok"}
