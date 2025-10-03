from datetime import datetime
import random, string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.flight import Flight
from datetime import timedelta
from app.api.deps import get_current_identity

router = APIRouter()

def _gen_confirmation_id() -> str:
    return "F" + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))

@router.post("/")
def create_ticket(flight_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    flight = db.get(Flight, flight_id)
    if not flight or flight.seats_available <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flight unavailable")
    flight.seats_available -= 1
    t = Ticket(
        confirmation_id=_gen_confirmation_id(),
        user_email=email.lower(),
        flight_id=flight_id,
        status="paid",
        purchased_at=datetime.utcnow(),
        price_paid=flight.price,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"confirmation_id": t.confirmation_id}

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
    if f.departure - now >= timedelta(hours=24):
        t.status = "refunded"
        f.seats_available += 1
    else:
        t.status = "canceled"
    db.commit()
    return {"status": t.status}
