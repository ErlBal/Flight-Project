from datetime import datetime
import random, string
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.flight import Flight
from datetime import timedelta
from app.api.deps import get_current_identity

router = APIRouter()

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
    flight = db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flight not found")
    if flight.seats_available < qty:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough seats available")

    confirmations = []
    # decrement seats first to reduce race window (still not fully safe without row lock)
    flight.seats_available -= qty
    now = datetime.utcnow()
    for _ in range(qty):
        t = Ticket(
            confirmation_id=_gen_confirmation_id(),
            user_email=email.lower(),
            flight_id=flight_id,
            status="paid",
            purchased_at=now,
            price_paid=flight.price,
        )
        db.add(t)
        confirmations.append(t)
    db.commit()
    # refresh only first (IDs already available); generate list of confirmation ids
    confirmation_ids = [t.confirmation_id for t in confirmations]
    resp = {"confirmation_ids": confirmation_ids, "quantity": qty}
    if qty == 1:
        resp["confirmation_id"] = confirmation_ids[0]
    return resp

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
    if time_left < timedelta(hours=24):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancellation not allowed (<24h to departure)")
    # разрешено отменить -> возврат места и статус refunded
    if t.status == "paid":
        f.seats_available += 1
    t.status = "refunded"
    db.commit()
    return {"status": t.status}
