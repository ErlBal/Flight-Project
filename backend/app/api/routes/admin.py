from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.company import Company
from app.models.flight import Flight
from app.models.ticket import Ticket

router = APIRouter(dependencies=[Depends(require_roles("admin"))])


@router.get("/users", response_model=List[dict])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        for u in users
    ]


@router.get("/companies", response_model=List[dict])
def list_companies(db: Session = Depends(get_db)):
    companies = db.query(Company).all()
    return [
        {"id": c.id, "name": c.name, "is_active": c.is_active}
        for c in companies
    ]


@router.get("/stats", response_model=dict)
def service_stats(db: Session = Depends(get_db)):
    users = db.query(func.count(User.id)).scalar() or 0
    companies = db.query(func.count(Company.id)).scalar() or 0
    flights = db.query(func.count(Flight.id)).scalar() or 0
    tickets = db.query(func.count(Ticket.id)).scalar() or 0
    # total sales: sum price of flights for paid tickets (rough approx)
    sales = db.query(func.coalesce(func.sum(Flight.price), 0)).join(Ticket, Ticket.flight_id == Flight.id).filter(Ticket.status == "paid").scalar()
    return {
        "users": users,
        "companies": companies,
        "flights": flights,
        "tickets": tickets,
        "total_sales": float(sales or 0),
    }
