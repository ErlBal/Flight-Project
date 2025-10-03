from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.flight import Flight
from app.api.deps import require_roles
from datetime import datetime

router = APIRouter()

@router.get("/")
def list_flights(
    db: Session = Depends(get_db),
    origin: str | None = None,
    destination: str | None = None,
    airline: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
):
    q = db.query(Flight)
    if origin:
        q = q.filter(Flight.origin == origin)
    if destination:
        q = q.filter(Flight.destination == destination)
    if airline:
        q = q.filter(Flight.airline == airline)
    if min_price is not None:
        q = q.filter(Flight.price >= min_price)
    if max_price is not None:
        q = q.filter(Flight.price <= max_price)
    total = q.count()
    items = q.limit(50).all()
    return {"items": [
        {
            "id": f.id,
            "airline": f.airline,
            "flight_number": f.flight_number,
            "origin": f.origin,
            "destination": f.destination,
            "departure": f.departure.isoformat(),
            "arrival": f.arrival.isoformat(),
            "price": float(f.price),
            "seats_available": f.seats_available,
        } for f in items
    ], "total": total}

@router.get("/{flight_id}")
def flight_detail(flight_id: int, db: Session = Depends(get_db)):
    f = db.get(Flight, flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return {
        "id": f.id,
        "airline": f.airline,
        "flight_number": f.flight_number,
        "origin": f.origin,
        "destination": f.destination,
        "departure": f.departure.isoformat(),
        "arrival": f.arrival.isoformat(),
        "price": float(f.price),
        "seats_available": f.seats_available,
    }

@router.post("/", dependencies=[Depends(require_roles("company_manager", "admin"))])
def create_flight(payload: dict, db: Session = Depends(get_db)):
    try:
        f = Flight(
            airline=payload["airline"],
            flight_number=payload["flight_number"],
            origin=payload["origin"],
            destination=payload["destination"],
            departure=datetime.fromisoformat(payload["departure"]),
            arrival=datetime.fromisoformat(payload["arrival"]),
            price=float(payload["price"]),
            seats_total=int(payload["seats_total"]),
            seats_available=int(payload["seats_available"]),
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id}

@router.put("/{flight_id}", dependencies=[Depends(require_roles("company_manager", "admin"))])
def update_flight(flight_id: int, payload: dict, db: Session = Depends(get_db)):
    f = db.get(Flight, flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for key in ["airline", "flight_number", "origin", "destination"]:
        if key in payload:
            setattr(f, key, payload[key])
    if "departure" in payload:
        f.departure = datetime.fromisoformat(payload["departure"])
    if "arrival" in payload:
        f.arrival = datetime.fromisoformat(payload["arrival"])
    if "price" in payload:
        f.price = float(payload["price"])
    if "seats_total" in payload:
        f.seats_total = int(payload["seats_total"])
    if "seats_available" in payload:
        f.seats_available = int(payload["seats_available"])
    db.commit()
    return {"status": "ok"}

@router.delete("/{flight_id}", dependencies=[Depends(require_roles("company_manager", "admin"))])
def delete_flight(flight_id: int, db: Session = Depends(get_db)):
    f = db.get(Flight, flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(f)
    db.commit()
    return {"status": "deleted"}
