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
from app.models.company_manager import CompanyManager

router = APIRouter(dependencies=[Depends(require_roles("admin"))])


@router.get("/users", response_model=List[dict])
def list_users(db: Session = Depends(get_db)):
    """List users with company mapping for company managers.

    Adds fields:
      companies: list of company ids (if manager)
      company_names: list of company names (resolved)
    """
    users = db.query(User).all()
    # Preload manager links & companies to avoid N+1
    manager_user_ids = [u.id for u in users if u.role == "company_manager"]
    links = []
    if manager_user_ids:
        links = db.query(CompanyManager).filter(CompanyManager.user_id.in_(manager_user_ids)).all()
    company_ids = {l.company_id for l in links}
    companies_map = {}
    if company_ids:
        comps = db.query(Company).filter(Company.id.in_(company_ids)).all()
        companies_map = {c.id: c for c in comps}
    links_by_user: dict[int, list[CompanyManager]] = {}
    for l in links:
        links_by_user.setdefault(l.user_id, []).append(l)
    resp = []
    for u in users:
        data = {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        if u.role == "company_manager":
            user_links = links_by_user.get(u.id, [])
            cids = [l.company_id for l in user_links]
            cnames = [companies_map[cid].name for cid in cids if cid in companies_map]
            data["companies"] = cids
            data["company_names"] = cnames
        resp.append(data)
    return resp


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

    now = datetime.utcnow()
    active_flights = db.query(func.count(Flight.id)).filter(Flight.departure > now).scalar() or 0
    completed_flights = db.query(func.count(Flight.id)).filter(Flight.departure <= now).scalar() or 0

    tickets_q = db.query(Ticket).filter(Ticket.status == "paid")
    if start and end:
        tickets_q = tickets_q.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    passengers = tickets_q.count()  # paid tickets treated as passengers

    sales_q = db.query(func.coalesce(func.sum(Ticket.price_paid), 0)).filter(Ticket.status == "paid")
    if start and end:
        sales_q = sales_q.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    sales = sales_q.scalar()
    # Seats capacity and sold for range (capacity over flights in range; sold = paid tickets in range)
    seats_capacity_q = db.query(func.coalesce(func.sum(Flight.seats_total), 0))
    if start and end:
        seats_capacity_q = seats_capacity_q.filter(Flight.departure >= start, Flight.departure < end)
    seats_capacity = seats_capacity_q.scalar() or 0
    seats_sold = passengers
    load_factor = float(seats_sold) / float(seats_capacity) if seats_capacity else 0.0
    return {
        "users": users,
        "companies": companies,
        "flights": flights,
        "active_flights": active_flights,
        "completed_flights": completed_flights,
        "passengers": passengers,
        "seats_capacity": int(seats_capacity),
        "seats_sold": int(seats_sold),
        "load_factor": load_factor,
        "revenue": float(sales or 0),
        "total_sales": float(sales or 0),  # backward compatibility
    }


@router.post("/users/{user_id}/block", response_model=dict)
def block_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return {"error": "not found"}
    u.is_active = False
    db.commit()
    return {"status": "ok"}


@router.post("/users/{user_id}/unblock", response_model=dict)
def unblock_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return {"error": "not found"}
    u.is_active = True
    db.commit()
    return {"status": "ok"}


@router.post("/companies", response_model=dict)
def create_company(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    if not name:
        return {"error": "name required"}
    existing = db.query(Company).filter(Company.name == name).first()
    if existing:
        return {"id": existing.id}
    c = Company(name=name, is_active=True)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id}


@router.post("/companies/{company_id}/deactivate", response_model=dict)
def deactivate_company(company_id: int, db: Session = Depends(get_db)):
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        return {"error": "not found"}
    c.is_active = False
    db.commit()
    return {"status": "ok"}


@router.post("/companies/{company_id}/assign-manager", response_model=dict)
def assign_manager(company_id: int, payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").lower().strip()
    if not email:
        return {"error": "email required"}
    company = db.query(Company).filter(Company.id == company_id, Company.is_active == True).first()
    if not company:
        return {"error": "company not found or inactive"}
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"error": "user not found"}
    if user.role != "company_manager":
        user.role = "company_manager"
    link = db.query(CompanyManager).filter(CompanyManager.user_id == user.id, CompanyManager.company_id == company.id).first()
    if not link:
        link = CompanyManager(user_id=user.id, company_id=company.id)
        db.add(link)
    db.commit()
    return {"status": "ok"}
