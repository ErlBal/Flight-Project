from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
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


@router.get("/users", response_model=dict)
def list_users(
    company_id: int | None = None,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    """Paginated list of users.

    Returns:
        items: current page of users (with companies list for managers)
        total: total number of users under current filter
        page, page_size, pages
    """
    page = max(page, 1)
    page_size = max(1, min(page_size, 200))  # cap upper bound

    q = db.query(User)
    if company_id is not None:
        # Filter: only managers of the specified company (keep non-managers so list doesn't lose them)
        # Logic: keep users who are not company_manager OR are managers of this company.
        q = q.join(CompanyManager, isouter=True).filter(
            (User.role != "company_manager") | (CompanyManager.company_id == company_id)
        )
    if search:
        s = f"%{search.strip()}%"
        # ILIKE for PostgreSQL (fallback to lower() for other DBs)
        try:
            q = q.filter((User.email.ilike(s)) | (User.full_name.ilike(s)))
        except AttributeError:
            # SQLite fallback emulation
            q = q.filter((func.lower(User.email).like(s.lower())) | (func.lower(User.full_name).like(s.lower())))
    q = q.order_by(User.id.asc())

    total = q.count()
    offset = (page - 1) * page_size
    users = q.offset(offset).limit(page_size).all()

    # Preload only for managers on this page
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

    items = []
    for u in users:
        data = {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        if u.role == "company_manager":
            user_links = links_by_user.get(u.id, [])
            cids = [l.company_id for l in user_links]
            cnames = [companies_map[cid].name for cid in cids if cid in companies_map]
            data["companies"] = cids
            data["company_names"] = cnames
        items.append(data)

    pages = (total + page_size - 1) // page_size if total else 1
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


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


@router.get("/stats/export")
def export_service_stats(range: str = "all", fmt: str = Query("csv", pattern="^(csv|xlsx)$"), db: Session = Depends(get_db)):
    data = service_stats(range, db)
    rows = [["metric", "value"]] + [[k, str(v)] for k, v in data.items()]
    if fmt == "csv":
        import io, csv
        buf = io.StringIO()
        w = csv.writer(buf)
        for r in rows: w.writerow(r)
        out = buf.getvalue().encode("utf-8-sig")
        return Response(out, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=service_stats_{range}.csv"})
    else:
        import html
        def esc(s: str): return html.escape(s, quote=True)
        xml_rows = []
        for r in rows:
            xml_rows.append('<Row>' + ''.join(f'<Cell><Data ss:Type="String">{esc(c)}</Data></Cell>' for c in r) + '</Row>')
        xml = (
            "<?xml version=\"1.0\"?>"\
            "<?mso-application progid=\"Excel.Sheet\"?>"\
            "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">"\
            "<Worksheet ss:Name=\"ServiceStats\"><Table>" + ''.join(xml_rows) + "</Table></Worksheet></Workbook>"
        )
        return Response(xml.encode('utf-8'), media_type='application/vnd.ms-excel', headers={"Content-Disposition": f"attachment; filename=service_stats_{range}.xml"})


@router.get("/stats/series", response_model=dict)
def service_stats_series(
    range: str = "week",
    metrics: str | None = None,
    granularity: str = "day",
    limit_days: int = Query(180, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Return a time series of service metrics aggregated by day.

    Parameters:
        range: all|today|week|month (all = entire history but limited by limit_days)
        metrics: comma separated list of metrics (passengers,revenue,flights,seats_sold,seats_capacity,load_factor)
        granularity: currently only 'day' is supported
        limit_days: maximum length of the series for range=all

    Response format:
        { range, granularity, metrics:[...], points:[ { date:'YYYY-MM-DD', values:{metric: value,...}} ] }
    """
    if granularity != "day":
        raise HTTPException(status_code=400, detail="only 'day' granularity supported")

    allowed = ["passengers", "revenue", "flights", "seats_sold", "seats_capacity", "load_factor"]
    if metrics:
        requested = [m.strip() for m in metrics.split(",") if m.strip()]
        for m in requested:
            if m not in allowed:
                raise HTTPException(status_code=400, detail=f"unknown metric: {m}")
    else:
        requested = ["passengers", "revenue", "flights", "load_factor"]

    # Date range
    now = datetime.utcnow()
    def _time_range(name: str):
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

    start, end = _time_range(range)
    # For range=all determine earliest data point
    if range == "all":
        # Minimum timestamps across tickets and flights
        min_ticket_dt = db.query(func.min(Ticket.purchased_at)).scalar()
        min_flight_dt = db.query(func.min(Flight.departure)).scalar()
        earliest = None
        for dt in (min_ticket_dt, min_flight_dt):
            if dt and (earliest is None or dt < earliest):
                earliest = dt
        if earliest is None:
            # No data
            return {"range": range, "granularity": granularity, "metrics": requested, "points": []}
    # Enforce limit_days cap
        if (now - earliest).days > limit_days:
            start = now - timedelta(days=limit_days)
        else:
            start = earliest
        end = now
    if start is None or end is None:
        # Safety fallback (unexpected range value)
        start = now - timedelta(days=7)
        end = now

    # Normalize to start of the day boundaries
    start_day = datetime(start.year, start.month, start.day)
    end_day = datetime(end.year, end.month, end.day)
    if end_day < end:
    # ensure current day included
        end_day = end_day

    # Ticket aggregation (passengers / seats_sold / revenue)
    tickets_q = db.query(
        func.date(Ticket.purchased_at).label("d"),
        func.count(Ticket.id).label("passengers"),
        func.coalesce(func.sum(Ticket.price_paid), 0).label("revenue"),
    ).filter(Ticket.status == "paid", Ticket.purchased_at >= start_day, Ticket.purchased_at <= end)
    tickets_rows = tickets_q.group_by(func.date(Ticket.purchased_at)).all()
    tickets_map = {str(r.d): r for r in tickets_rows}

    # Flight aggregation (flights / seats_capacity)
    flights_q = db.query(
        func.date(Flight.departure).label("d"),
        func.count(Flight.id).label("flights"),
        func.coalesce(func.sum(Flight.seats_total), 0).label("seats_capacity"),
    ).filter(Flight.departure >= start_day, Flight.departure <= end)
    flights_rows = flights_q.group_by(func.date(Flight.departure)).all()
    flights_map = {str(r.d): r for r in flights_rows}

    # Build list of days
    days = []
    cursor = start_day
    # Inclusive up to end day
    while cursor.date() <= end.date():
        days.append(cursor.strftime("%Y-%m-%d"))
        cursor = cursor + timedelta(days=1)

    points = []
    for day in days:
        tr = tickets_map.get(day)
        fr = flights_map.get(day)
        passengers_val = int(getattr(tr, "passengers", 0) or 0)
        revenue_val = float(getattr(tr, "revenue", 0) or 0)
        flights_val = int(getattr(fr, "flights", 0) or 0)
        capacity_val = int(getattr(fr, "seats_capacity", 0) or 0)
        seats_sold_val = passengers_val  # paid tickets = sold seats
        load_factor_val = float(seats_sold_val) / capacity_val if capacity_val else 0.0
        values = {}
        if "passengers" in requested: values["passengers"] = passengers_val
        if "revenue" in requested: values["revenue"] = revenue_val
        if "flights" in requested: values["flights"] = flights_val
        if "seats_sold" in requested: values["seats_sold"] = seats_sold_val
        if "seats_capacity" in requested: values["seats_capacity"] = capacity_val
        if "load_factor" in requested: values["load_factor"] = load_factor_val
        points.append({"date": day, "values": values})

    return {
        "range": range,
        "granularity": granularity,
        "metrics": requested,
        "points": points,
        "from": days[0] if days else None,
        "to": days[-1] if days else None,
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


@router.post("/companies/{company_id}/unassign-manager", response_model=dict)
def unassign_manager(company_id: int, payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").lower().strip()
    if not email:
        return {"error": "email required"}
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "company not found"}
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"error": "user not found"}
    link = db.query(CompanyManager).filter(CompanyManager.user_id == user.id, CompanyManager.company_id == company.id).first()
    if not link:
        return {"status": "noop"}
    db.delete(link)
    db.commit()
    return {"status": "ok"}
