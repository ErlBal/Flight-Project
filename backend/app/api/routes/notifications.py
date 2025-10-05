from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.deps import get_current_identity
from app.models.notification import Notification
from app.services.notification_ws import manager
from app.core.security import decode_access_token

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
    # WS push
    import asyncio
    try:
        from app.services.notification_ws import manager as ws_manager  # local import to avoid circular
        asyncio.create_task(ws_manager.send_to_user(email.lower(), {"type": "notification_read", "data": {"id": n.id}}))
    except RuntimeError:
        pass
    return {"status": "ok"}


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Пометить все уведомления пользователя прочитанными."""
    email, _roles = identity
    db.query(Notification).filter(Notification.user_email == email.lower(), Notification.read == False).update({Notification.read: True})  # type: ignore
    db.commit()
    import asyncio
    try:
        from app.services.notification_ws import manager as ws_manager
        asyncio.create_task(ws_manager.send_to_user(email.lower(), {"type": "notification_mark_all", "data": {}}))
    except RuntimeError:
        pass
    return {"status": "ok"}


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    """WebSocket для мгновенных уведомлений.
    Клиент передаёт access token в query (?token=...). Мы декодируем email.
    Сообщения сервер шлёт в формате:
      {"type": "notification", "data": { NotificationOut }}
    Дополнительно возможно будущее: unread_count diff, ping/pong.
    """
    # Попытка декодировать токен
    try:
        payload = decode_access_token(token)
        email = (payload.get("sub") or "").lower()
        if not email:
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(email, websocket)
    try:
        while True:
            # Ожидаем входящих сообщений (пока не нужны) — поддерживаем ping от клиента
            _ = await websocket.receive_text()
            # Можно реализовать простую эхо-реакцию / ping.
            # Сейчас игнорируем.
    except WebSocketDisconnect:
        await manager.disconnect(email, websocket)
    except Exception:
        await manager.disconnect(email, websocket)
