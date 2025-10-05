from datetime import datetime
import random, string
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.flight import Flight
from app.models.notification import Notification
from app.models.ticket_reminder import TicketReminder
from datetime import timedelta
from app.api.deps import get_current_identity
from app.services.notification_ws import manager as ws_manager
import asyncio

router = APIRouter()

# In-memory throttle store { (email, flight_id): last_ts }
_last_purchase: dict[tuple[str, int], float] = {}
_THROTTLE_SECONDS = 2.0

def _gen_confirmation_id() -> str:
    return "F" + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))

class CreateTicketBody(BaseModel):
    flight_id: int
    quantity: int = Field(1, ge=1, le=10, description="Number of seats to purchase (1-10)")

@router.post("")
@router.post("/")
def create_ticket(payload: CreateTicketBody, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Purchase one or multiple tickets for a flight.

    Backward compatibility: if quantity == 1, response contains both
    confirmation_id (single) and confirmation_ids (array of length 1).
    """
    email, _roles = identity
    flight_id = payload.flight_id
    qty = payload.quantity or 1
    # Rate limit / double-click protection
    import time
    key = (email.lower(), flight_id)
    now_ts = time.time()
    last = _last_purchase.get(key)
    if last and (now_ts - last) < _THROTTLE_SECONDS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many purchase attempts, wait a moment")
    _last_purchase[key] = now_ts
    flight = db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flight not found")

    # Atomic seat decrement (Postgres) using UPDATE ... WHERE ... RETURNING to avoid race conditions
    dialect_name = db.bind.dialect.name if db.bind else ""
    upd = db.execute(
        text(
            """
            UPDATE flights
            SET seats_available = seats_available - :qty
            WHERE id = :fid AND seats_available >= :qty
            RETURNING seats_available
            """
        ),
        {"qty": qty, "fid": flight_id},
    )
    row = upd.fetchone()
    updated = 1 if row is not None else 0

    if not updated:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough seats available")

    # Refresh flight to ensure we have the latest price after raw UPDATE (avoid stale in-session object)
    db.refresh(flight)

    confirmations = []
    now = datetime.utcnow()
    price_snapshot = flight.price
    for _ in range(qty):
        ticket = Ticket(
            confirmation_id=_gen_confirmation_id(),
            user_email=email.lower(),
            flight_id=flight_id,
            status="paid",
            purchased_at=now,
            price_paid=price_snapshot,
        )
        db.add(ticket)
        confirmations.append(ticket)
    # Notification (one aggregated notification if multiple seats)
    msg = f"Purchase confirmed: {qty} seat(s) on flight {flight.flight_number} {flight.origin}->{flight.destination}"
    notif = Notification(user_email=email.lower(), type="purchase", message=msg, read=False)
    db.add(notif)
    db.commit()
    confirmation_ids = [t.confirmation_id for t in confirmations]
    result = {"confirmation_ids": confirmation_ids, "quantity": qty}
    if qty == 1:
        result["confirmation_id"] = confirmation_ids[0]
    # Push обновлённых seats
    try:
        asyncio.create_task(ws_manager.broadcast({
            "type": "flight_seats", "data": {"flight_id": flight_id, "seats_available": flight.seats_available}
        }))
    except RuntimeError:
        pass
    return result

@router.get("/my")
def my_tickets(
    db: Session = Depends(get_db),
    identity=Depends(get_current_identity),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    confirmation_id: str | None = Query(None, description="Filter by confirmation id prefix or exact"),
    status_filter: str | None = Query(None, pattern="^(paid|refunded|canceled)$"),
):
    email, _roles = identity
    q = db.query(Ticket).filter(Ticket.user_email == email)
    if confirmation_id:
        cid = confirmation_id.strip().upper()
        if len(cid) < 3:
            # небольшая защита от слишком короткого поиска (можно убрать)
            pass
        if '%' in cid or '_' in cid:
            # избегаем wildcard injection — просто игнорируем такие символы
            cid = cid.replace('%','').replace('_','')
        q = q.filter(Ticket.confirmation_id.like(f"{cid}%"))
    if status_filter:
        q = q.filter(Ticket.status == status_filter)
    total = q.count()
    q = q.order_by(Ticket.purchased_at.desc())
    offset = (page - 1) * page_size
    items_db = q.offset(offset).limit(page_size).all()
    if not items_db:
        return {"items": [], "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1)//page_size if total else 1}
    flight_ids = {t.flight_id for t in items_db}
    flights_map = {f.id: f for f in db.query(Flight).filter(Flight.id.in_(flight_ids)).all()}
    # Load existing reminders for these tickets
    ticket_ids = [t.id for t in items_db]
    reminders_map: dict[int, list[TicketReminder]] = {}
    if ticket_ids:
        for r in db.query(TicketReminder).filter(TicketReminder.ticket_id.in_(ticket_ids)).all():
            reminders_map.setdefault(r.ticket_id, []).append(r)
    resp_items = []
    for t in items_db:
        f = flights_map.get(t.flight_id)
        flight_data = None
        if f:
            flight_data = {
                "id": f.id,
                "airline": f.airline,
                "flight_number": f.flight_number,
                "origin": f.origin,
                "destination": f.destination,
                "departure": f.departure.isoformat(),
                "arrival": f.arrival.isoformat(),
                "stops": f.stops,
            }
        rems = []
        for r in reminders_map.get(t.id, []):
            rems.append({
                "id": r.id,
                "hours_before": r.hours_before,
                "type": r.type,
                "scheduled_at": r.scheduled_at.isoformat(),
                "sent": r.sent,
            })
        resp_items.append({
            "confirmation_id": t.confirmation_id,
            "status": t.status,
            "flight_id": t.flight_id,
            "email": t.user_email,
            "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
            "price_paid": float(t.price_paid) if t.price_paid is not None else None,
            "flight": flight_data,
            "reminders": rems,
        })
    return {
        "items": resp_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1)//page_size if total else 1,
    }

@router.get("/{confirmation_id}")
def get_ticket(confirmation_id: str, db: Session = Depends(get_db)):
    t = db.query(Ticket).filter(Ticket.confirmation_id == confirmation_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return {
        "confirmation_id": t.confirmation_id,
        "status": t.status,
        "flight_id": t.flight_id,
        "email": t.user_email,
        "purchased_at": t.purchased_at.isoformat(),
    }

@router.post("/{confirmation_id}/cancel")
def cancel_ticket(confirmation_id: str, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Cancel a ticket.

    Rules:
    - Only the owner of the ticket can cancel (basic security hardening).
    - If flight departure is within 24 hours -> cancellation is forbidden (HTTP 400).
    - If >24h: seat is returned (status -> refunded).
    - If already refunded/canceled: idempotent return of current status.
    """
    email, roles = identity
    t = db.query(Ticket).filter(Ticket.confirmation_id == confirmation_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if t.user_email.lower() != email.lower():
        # Allow privileged roles (admin/company_manager) to cancel? For now, only owner.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    f = db.get(Flight, t.flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid flight")
    if t.status not in ("paid",):
        return {"status": t.status}
    now = datetime.utcnow()
    time_left = f.departure - now
    if time_left < timedelta(hours=24):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel within 24 hours of departure")
    # Early cancellation: return seat & mark refunded
    # Возвращаем место
    f.seats_available += 1
    # TODO: при наличии отдельного ws канала обновления рейсов можно пушить изменение seats_available
    t.status = "refunded"
    db.commit()
    # broadcast seats update
    try:
        asyncio.create_task(ws_manager.broadcast({
            "type": "flight_seats", "data": {"flight_id": f.id, "seats_available": f.seats_available}
        }))
    except RuntimeError:
        pass
    return {"status": t.status}

class ReminderCreateBody(BaseModel):
    hours_before: int = Field(..., ge=1, le=240, description="Hours before departure to notify (1-240)")

@router.post("/{confirmation_id}/reminder", status_code=201)
def set_custom_reminder(confirmation_id: str, body: ReminderCreateBody, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    t = db.query(Ticket).filter(Ticket.confirmation_id == confirmation_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if t.user_email.lower() != email.lower():
        raise HTTPException(status_code=403, detail="Forbidden")
    f = db.get(Flight, t.flight_id)
    if not f:
        raise HTTPException(status_code=400, detail="Flight missing")
    # only allow future flights
    if f.departure <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Flight already departed or in progress")
    # Remove existing custom reminder
    db.query(TicketReminder).filter(TicketReminder.ticket_id == t.id, TicketReminder.type == "custom").delete()
    sched_at = f.departure - timedelta(hours=body.hours_before)
    if sched_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reminder time already passed")
    r = TicketReminder(ticket_id=t.id, user_email=email.lower(), hours_before=body.hours_before, type="custom", scheduled_at=sched_at)
    db.add(r)
    db.commit(); db.refresh(r)
    return {"id": r.id, "hours_before": r.hours_before, "scheduled_at": r.scheduled_at.isoformat(), "type": r.type}

@router.delete("/{confirmation_id}/reminder/{reminder_id}")
def delete_custom_reminder(confirmation_id: str, reminder_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    t = db.query(Ticket).filter(Ticket.confirmation_id == confirmation_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if t.user_email.lower() != email.lower():
        raise HTTPException(status_code=403, detail="Forbidden")
    r = db.query(TicketReminder).filter(TicketReminder.id == reminder_id, TicketReminder.ticket_id == t.id, TicketReminder.type == "custom").first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(r)
    db.commit()
    return {"status": "deleted"}

