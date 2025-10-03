from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from datetime import datetime, timedelta
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
def service_stats(range: str = "all", db: Session = Depends(get_db)):
    def _time_range(name: str):
        now = datetime.utcnow()
        if name == "today":
            start = datetime(now.year, now.month, now.day)
            end = start + timedelta(days=1)
        elif name == "week":
            start = now - timedelta(days=7)
            end = now
        elif name == "month":
            start = now - timedelta(days=30)
            end = now
        else:
            return None, None
        return start, end

    users = db.query(func.count(User.id)).scalar() or 0
    companies = db.query(func.count(Company.id)).scalar() or 0
    flights_q = db.query(Flight)
    start, end = _time_range(range)
    if start and end:
        flights_q = flights_q.filter(Flight.departure >= start, Flight.departure < end)
    flights = flights_q.count()

    tickets_q = db.query(Ticket)
    if start and end:
        tickets_q = tickets_q.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    tickets = tickets_q.count()

    sales_q = db.query(func.coalesce(func.sum(Ticket.price_paid), 0)).filter(Ticket.status == "paid")
    if start and end:
        sales_q = sales_q.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    sales = sales_q.scalar()
    return {
        "users": users,
        "companies": companies,
        "flights": flights,
        "tickets": tickets,
        "total_sales": float(sales or 0),
    }
