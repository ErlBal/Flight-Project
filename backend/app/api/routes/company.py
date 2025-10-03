from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles, get_current_identity
from app.db.session import get_db
from app.models.flight import Flight
from app.models.company import Company
from app.models.user import User
from app.models.ticket import Ticket

router = APIRouter(dependencies=[Depends(require_roles("company_manager", "admin"))])


def _get_manager_company_id(db: Session, email: str) -> Optional[int]:
    # For now, map manager user to company by matching user full_name to company name (placeholder).
    # In future, use a proper association table.
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    # naive mapping: if user's full_name matches a company name
    if user.full_name:
        company = db.query(Company).filter(Company.name == user.full_name).first()
        if company:
            return company.id
    # fallback: first active company
    company = db.query(Company).filter(Company.is_active == True).first()
    return company.id if company else None


@router.get("/flights", response_model=List[dict])
def list_company_flights(
    db: Session = Depends(get_db),
    identity=Depends(get_current_identity),
):
    email, _roles = identity
    company_id = _get_manager_company_id(db, email)
    if not company_id:
        return []
    flights = db.query(Flight).filter(Flight.company_id == company_id).all()
    return [
        {
            "id": f.id,
            "airline": f.airline,
            "flight_number": f.flight_number,
            "origin": f.origin,
            "destination": f.destination,
            "departure": f.departure.isoformat() if f.departure else None,
            "arrival": f.arrival.isoformat() if f.arrival else None,
            "price": float(f.price),
            "seats_total": f.seats_total,
            "seats_available": f.seats_available,
            "company_id": f.company_id,
        }
        for f in flights
    ]


@router.post("/flights", response_model=dict)
def create_company_flight(payload: dict, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    company_id = _get_manager_company_id(db, email)
    if not company_id:
        raise HTTPException(status_code=400, detail="No company mapped for manager")
    f = Flight(
        airline=payload.get("airline", ""),
        flight_number=payload.get("flight_number", ""),
        origin=payload.get("origin", ""),
        destination=payload.get("destination", ""),
        departure=payload.get("departure"),
        arrival=payload.get("arrival"),
        price=payload.get("price", 0.0),
        seats_total=payload.get("seats_total", 0),
        seats_available=payload.get("seats_available", 0),
        company_id=company_id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id}


@router.put("/flights/{flight_id}", response_model=dict)
def update_company_flight(flight_id: int, payload: dict, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    company_id = _get_manager_company_id(db, email)
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if company_id and f.company_id and f.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not your company flight")
    for key in ["airline", "flight_number", "origin", "destination", "departure", "arrival", "price", "seats_total", "seats_available"]:
        if key in payload:
            setattr(f, key, payload[key])
    db.commit()
    return {"status": "ok"}


@router.delete("/flights/{flight_id}", response_model=dict)
def delete_company_flight(flight_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    company_id = _get_manager_company_id(db, email)
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if company_id and f.company_id and f.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not your company flight")
    db.delete(f)
    db.commit()
    return {"status": "deleted"}


@router.get("/flights/{flight_id}/passengers", response_model=List[dict])
def list_passengers(flight_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, _roles = identity
    company_id = _get_manager_company_id(db, email)
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if company_id and f.company_id and f.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not your company flight")
    tickets = db.query(Ticket).filter(Ticket.flight_id == flight_id, Ticket.status == "paid").all()
    return [
        {
            "confirmation_id": t.confirmation_id,
            "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
        }
        for t in tickets
    ]
