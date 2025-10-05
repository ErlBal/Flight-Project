from datetime import datetime
import random, string
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.flight import Flight
from app.models.notification import Notification
from datetime import timedelta
from app.api.deps import get_current_identity

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

    # Атомарное списание мест (Postgres only): используем UPDATE ... WHERE ... RETURNING
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

    # Нужны актуальные данные цены -> если мы делали raw UPDATE в Postgres, у нас объект flight в сессии может быть устаревшим
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
    return result

@router.get("/my")
def my_tickets(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    items = db.query(Ticket).filter(Ticket.user_email == email).order_by(Ticket.purchased_at.desc()).all()
    return [
        {
            "confirmation_id": t.confirmation_id,
            "status": t.status,
            "flight_id": t.flight_id,
            "email": t.user_email,
            "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
            "price_paid": float(t.price_paid) if t.price_paid is not None else None,
        }
        for t in items
    ]

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
def cancel_ticket(confirmation_id: str, db: Session = Depends(get_db)):
    t = db.query(Ticket).filter(Ticket.confirmation_id == confirmation_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    f = db.get(Flight, t.flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid flight")
    now = datetime.utcnow()
    time_left = f.departure - now
    if t.status not in ("paid",):
        return {"status": t.status}
    if time_left < timedelta(hours=24):
        # late cancellation: mark canceled (no seat return)
        t.status = "canceled"
    else:
        # early cancellation: refund & return seat
        f.seats_available += 1
        t.status = "refunded"
    db.commit()
    return {"status": t.status}
