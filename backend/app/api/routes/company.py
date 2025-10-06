from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_roles, get_current_identity
from app.db.session import get_db
from app.models.flight import Flight
from app.models.company import Company
from app.models.user import User
from app.models.ticket import Ticket
from app.models.notification import Notification
from app.models.company_manager import CompanyManager
from app.services.notification_ws import manager as ws_manager
from sqlalchemy import func
from datetime import datetime, timedelta

router = APIRouter(dependencies=[Depends(require_roles("company_manager", "admin"))])


def _get_manager_company_ids(db: Session, email: str) -> list[int]:
    """Return list of company ids for manager email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return []
    links = db.query(CompanyManager).filter(CompanyManager.user_id == user.id).all()
    if links:
        return [l.company_id for l in links]
    # Fallback legacy (single heuristic)
    if user.full_name:
        company = db.query(Company).filter(Company.name == user.full_name).first()
        if company:
            return [company.id]
    fallback = db.query(Company).filter(Company.is_active == True).first()
    return [fallback.id] if fallback else []


@router.get("/flights", response_model=dict)
def list_company_flights(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    sort: str = Query("departure_asc"),
    status: str = Query("all", pattern="^(all|active|completed)$"),
    db: Session = Depends(get_db),
    identity=Depends(get_current_identity)
):
    """List flights with pagination and sorting.

        sort options:
            departure_asc|departure_desc|arrival_asc|arrival_desc|price_asc|price_desc|
            seats_available_desc|seats_available_asc|created_desc|revenue_est_desc|revenue_est_asc
    (created_desc = surrogate by id descending.)
    """
    email, roles = identity
    if "admin" in roles:
        q = db.query(Flight)
    else:
        company_ids = _get_manager_company_ids(db, email)
        if not company_ids:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 1}
        q = db.query(Flight).filter(Flight.company_id.in_(company_ids))

    # Filter by status (active = future, completed = past)
    now = datetime.utcnow()
    if status == "active":
        q = q.filter(Flight.departure > now)
    elif status == "completed":
        q = q.filter(Flight.departure <= now)

    # Sorting
    if sort == "departure_asc":
        q = q.order_by(Flight.departure.asc())
    elif sort == "departure_desc":
        q = q.order_by(Flight.departure.desc())
    elif sort == "arrival_asc":
        q = q.order_by(Flight.arrival.asc())
    elif sort == "arrival_desc":
        q = q.order_by(Flight.arrival.desc())
    elif sort == "price_asc":
        q = q.order_by(Flight.price.asc())
    elif sort == "price_desc":
        q = q.order_by(Flight.price.desc())
    elif sort == "seats_available_desc":
        q = q.order_by(Flight.seats_available.desc())
    elif sort == "seats_available_asc":
        q = q.order_by(Flight.seats_available.asc())
    elif sort == "created_desc":
        q = q.order_by(Flight.id.desc())
    elif sort == "revenue_est_desc":
    # seats_sold = seats_total - seats_available; estimate = price * (seats_total - seats_available)
    # For sorting we use an expression; price Numeric -> could cast to float (optional)
        rev_expr = (Flight.price * (Flight.seats_total - Flight.seats_available))
        q = q.order_by(rev_expr.desc())
    elif sort == "revenue_est_asc":
        rev_expr = (Flight.price * (Flight.seats_total - Flight.seats_available))
        q = q.order_by(rev_expr.asc())
    else:
        q = q.order_by(Flight.departure.asc())

    total = q.count()
    pages = (total + page_size - 1) // page_size if total else 1
    if page > pages:
        page = pages
    offset = (page - 1) * page_size
    flights = q.offset(offset).limit(page_size).all()

    items = []
    # Preload company names
    company_ids_set = {f.company_id for f in flights if f.company_id}
    company_map: dict[int, str] = {}
    if company_ids_set:
        for c in db.query(Company).filter(Company.id.in_(company_ids_set)).all():
            company_map[c.id] = c.name
    for f in flights:
        items.append({
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
            "company_name": company_map.get(f.company_id) if f.company_id else None,
            # Add server-side revenue estimate (sold * price)
            "revenue_est": float(f.price) * max(0, (f.seats_total - f.seats_available)),
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.post("/flights", response_model=dict)
def create_company_flight(payload: dict, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, roles = identity
    if "admin" in roles:
        raise HTTPException(status_code=403, detail="Admin cannot create flights via this endpoint")
    else:
        company_ids = _get_manager_company_ids(db, email)
        if not company_ids:
            raise HTTPException(status_code=400, detail="No company mapped for manager")
        company_id = company_ids[0]  # default create first company
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
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email) if "admin" not in roles else []
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if "admin" not in roles and company_ids and f.company_id not in company_ids:
        raise HTTPException(status_code=403, detail="Not your company flight")
    # 1. can't edit a past flight
    now = datetime.utcnow()
    if f.departure <= now:
        raise HTTPException(status_code=400, detail="Past flight cannot be edited")

    # Determine sold (paid) tickets
    sold = db.query(func.count(Ticket.id)).filter(Ticket.flight_id == f.id, Ticket.status == "paid").scalar() or 0

    # Rule: seats_total cannot be reduced below sold
    new_seats_total = payload.get("seats_total", f.seats_total)
    if new_seats_total < sold:
        raise HTTPException(status_code=400, detail="seats_total cannot be less than already sold seats")

    changed_fields = {}
    editable_keys = ["airline", "flight_number", "origin", "destination", "departure", "arrival", "price", "seats_total"]
    for key in editable_keys:
        if key in payload and getattr(f, key) != payload[key]:
            changed_fields[key] = {"old": getattr(f, key), "new": payload[key]}
            setattr(f, key, payload[key])

    seats_available_changed = False
    if "seats_total" in changed_fields:
    # first auto-adjust seats_available based on sold
        f.seats_available = max(0, f.seats_total - sold)

    if "seats_available" in payload:
    # Allow manual edit with rules: sold <= seats_available <= seats_total
        try:
            new_sa = int(payload["seats_available"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid seats_available")
        if new_sa < sold:
            raise HTTPException(status_code=400, detail="seats_available cannot be less than sold seats")
        if new_sa > f.seats_total:
            raise HTTPException(status_code=400, detail="seats_available cannot exceed seats_total")
        if f.seats_available != new_sa:
            seats_available_changed = True
            changed_fields["seats_available"] = {"old": f.seats_available, "new": new_sa}
            f.seats_available = new_sa

    # Restriction: price can only change for future flights (already ensured f.departure > now)
    # Direct setting of seats_available via payload is ignored; it's calculated above

    db.commit()

    # If there are changes — create notifications for users with paid tickets
    if changed_fields:
        tickets_paid = db.query(Ticket).filter(Ticket.flight_id == f.id, Ticket.status == "paid").all()
        if tickets_paid:
            # Build short description of changes
            def fmt_val(v):
                if hasattr(v, 'isoformat'):
                    try:
                        return v.isoformat()
                    except:  # noqa
                        return str(v)
                return str(v)
            summary_parts = []
            for k, diff in changed_fields.items():
                summary_parts.append(f"{k}: {fmt_val(diff['old'])} -> {fmt_val(diff['new'])}")
            summary = ", ".join(summary_parts)[:900]
            created_notifications: list[Notification] = []
            # Group by user_email so we don't send one per ticket
            from collections import defaultdict
            by_user: dict[str, int] = defaultdict(int)
            for t in tickets_paid:
                by_user[t.user_email] += 1
            for user_email, count in by_user.items():
                suffix = "" if count == 1 else f" (tickets: {count})"
                n = Notification(
                    user_email=user_email,
                    type="flight_update",
                    message=f"Your flight {f.flight_number} was updated: {summary}{suffix}"
                )
                db.add(n)
                created_notifications.append(n)
            db.commit()
            # Push via WebSocket (fire & forget)
            import asyncio
            async def _push():
                for n in created_notifications:
                    await ws_manager.send_to_user(n.user_email, {"type": "notification", "data": {
                        "id": n.id,
                        "type": n.type,
                        "message": n.message,
                        "created_at": n.created_at.isoformat(),
                        "read": n.read,
                    }})
            try:
                asyncio.create_task(_push())
            except RuntimeError:
                # If there's no current loop (e.g. in a sync Uvicorn worker context) — ignore
                pass

    # If seats_total or seats_available changed — push updated seats_available
    if "seats_total" in changed_fields or seats_available_changed:
        import asyncio
        try:
            asyncio.create_task(ws_manager.broadcast({
                "type": "flight_seats", "data": {"flight_id": f.id, "seats_available": f.seats_available}
            }))
        except RuntimeError:
            pass
    return {"status": "ok", "changed": list(changed_fields.keys())}


@router.delete("/flights/{flight_id}", response_model=dict)
def delete_company_flight(flight_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email) if "admin" not in roles else []
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if "admin" not in roles and company_ids and f.company_id not in company_ids:
        raise HTTPException(status_code=403, detail="Not your company flight")
    # Admin can delete any flight; manager is forbidden to delete past flights
    now = datetime.utcnow()
    if "admin" not in roles and f.departure <= now:
        raise HTTPException(status_code=400, detail="Past flight cannot be deleted")

    # Find all paid tickets and mark refund + create notifications
    tickets_paid = db.query(Ticket).filter(Ticket.flight_id == f.id, Ticket.status == "paid").all()
    refund_count = 0
    created_notifications: list[Notification] = []
    from collections import defaultdict
    user_ticket_counts: dict[str, int] = defaultdict(int)
    for t in tickets_paid:
        t.status = "refunded"
        refund_count += 1
        user_ticket_counts[t.user_email] += 1
    for user_email, count in user_ticket_counts.items():
        plural = "" if count == 1 else f" (tickets: {count})"
        n = Notification(
            user_email=user_email,
            type="flight_cancel",
            message=f"Your flight {f.flight_number} was cancelled. Tickets refunded: {count}{plural}."
        )
        db.add(n)
        created_notifications.append(n)

    db.delete(f)
    db.commit()
    # WS push
    import asyncio
    async def _push():
        for n in created_notifications:
            await ws_manager.send_to_user(n.user_email, {"type": "notification", "data": {
                "id": n.id,
                "type": n.type,
                "message": n.message,
                "created_at": n.created_at.isoformat(),
                "read": n.read,
            }})
    try:
        asyncio.create_task(_push())
    except RuntimeError:
        pass
    return {"status": "deleted", "refunded_tickets": refund_count}


@router.post("/flights/{flight_id}/seats-adjust", response_model=dict)
def adjust_seats(flight_id: int, delta: int = Query(..., ge=-1000, le=1000), db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Quick adjustment of available seats by delta (can be negative/positive).
    Rules: 0 <= seats_available+delta <= seats_total; also >= sold (paid).
    """
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email) if "admin" not in roles else []
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if "admin" not in roles and company_ids and f.company_id not in company_ids:
        raise HTTPException(status_code=403, detail="Not your company flight")
    sold = db.query(func.count(Ticket.id)).filter(Ticket.flight_id == f.id, Ticket.status == "paid").scalar() or 0
    new_value = f.seats_available + delta
    if new_value < 0:
        raise HTTPException(status_code=400, detail="Resulting seats_available would be negative")
    if new_value > f.seats_total:
        raise HTTPException(status_code=400, detail="Resulting seats_available exceeds seats_total")
    if new_value < sold:
        raise HTTPException(status_code=400, detail="Resulting seats_available less than sold seats")
    if delta == 0:
        return {"status": "noop", "seats_available": f.seats_available}
    f.seats_available = new_value
    db.commit()
    # WS broadcast
    import asyncio
    try:
        asyncio.create_task(ws_manager.broadcast({
            "type": "flight_seats", "data": {"flight_id": f.id, "seats_available": f.seats_available}
        }))
    except RuntimeError:
        pass
    return {"status": "ok", "seats_available": f.seats_available}


@router.get("/flights/{flight_id}/passengers", response_model=List[dict])
def list_passengers(flight_id: int, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email) if "admin" not in roles else []
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if "admin" not in roles and company_ids and f.company_id not in company_ids:
        raise HTTPException(status_code=403, detail="Not your company flight")
    tickets = db.query(Ticket).filter(Ticket.flight_id == flight_id, Ticket.status == "paid").all()
    return [
        {
            "confirmation_id": t.confirmation_id,
            "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
            "user_email": t.user_email,
            "status": t.status,
        }
        for t in tickets
    ]


@router.get("/flights/{flight_id}/passengers/export")
def export_passengers(flight_id: int, fmt: str = Query("csv", pattern="^(csv|xlsx)$"), db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email) if "admin" not in roles else []
    f = db.query(Flight).filter(Flight.id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    if "admin" not in roles and company_ids and f.company_id not in company_ids:
        raise HTTPException(status_code=403, detail="Not your company flight")
    tickets = db.query(Ticket).filter(Ticket.flight_id == flight_id, Ticket.status == "paid").all()
    # Additional fields: company and route (origin, destination)
    company_name = db.query(Company.name).filter(Company.id == f.company_id).scalar() if f.company_id else ""
    rows = [
        [
            "confirmation_id",
            "user_email",
            "status",
            "purchased_at",
            "price_paid",
            "company_name",
            "origin",
            "destination",
        ],
    ]
    for t in tickets:
        rows.append([
            t.confirmation_id,
            t.user_email,
            t.status,
            t.purchased_at.isoformat() if t.purchased_at else "",
            str(t.price_paid or 0),
            company_name,
            f.origin,
            f.destination,
        ])
    if fmt == "csv":
        import io, csv
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerows(rows)
        data = buf.getvalue().encode("utf-8-sig")
        filename = f"passengers_f{flight_id}.csv"
        return Response(data, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
    else:  # xlsx minimal (SpreadsheetML XML) – no external dependencies
        # Very simple XML (Excel will open). For a full XLSX you need zip + sheets, but here we
        # use the "XML Spreadsheet 2003" format.
        def esc(s: str):
            import html
            return html.escape(s, quote=True)
        cells_xml = []
        for r in rows:
            cells = ''.join([f'<Cell><Data ss:Type="String">{esc(c)}</Data></Cell>' for c in r])
            cells_xml.append(f"<Row>{cells}</Row>")
        xml = (
            "<?xml version=\"1.0\"?>"\
            "<?mso-application progid=\"Excel.Sheet\"?>"\
            "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">"\
            "<Worksheet ss:Name=\"Passengers\"><Table>" + ''.join(cells_xml) + "</Table></Worksheet></Workbook>"
        )
        data = xml.encode("utf-8")
        filename = f"passengers_f{flight_id}.xml"  # xml extension, Excel will open
        return Response(data, media_type="application/vnd.ms-excel", headers={"Content-Disposition": f"attachment; filename={filename}"})


def _time_range(filter_name: str):
    now = datetime.utcnow()
    if filter_name == "today":
        start = datetime(now.year, now.month, now.day)
        end = start + timedelta(days=1)
    elif filter_name == "week":
        start = now - timedelta(days=7)
        end = now
    elif filter_name == "month":
        start = now - timedelta(days=30)
        end = now
    else:  # all
        return None, None
    return start, end


@router.get("/stats", response_model=dict)
def company_stats(range: str = "all", db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    email, roles = identity
    company_ids = _get_manager_company_ids(db, email)
    if "admin" in roles:
        # aggregate for all companies (admin perspective) - reuse structure
        company_ids = [c.id for c in db.query(Company).all()]
    if not company_ids:
        return {"flights": 0, "active": 0, "completed": 0, "passengers": 0, "revenue": 0.0, "seats_capacity": 0, "seats_sold": 0, "load_factor": 0.0}
    start, end = _time_range(range)

    fq = db.query(Flight).filter(Flight.company_id.in_(company_ids))
    if start and end:
        fq = fq.filter(Flight.departure >= start, Flight.departure < end)
    flights_total = fq.count()

    # Seats capacity for flights in selected range
    seats_capacity = db.query(func.coalesce(func.sum(Flight.seats_total), 0)).filter(Flight.company_id.in_(company_ids))
    if start and end:
        seats_capacity = seats_capacity.filter(Flight.departure >= start, Flight.departure < end)
    seats_capacity = seats_capacity.scalar() or 0

    now = datetime.utcnow()
    active = db.query(Flight).filter(Flight.company_id.in_(company_ids), Flight.departure > now).count()
    completed = db.query(Flight).filter(Flight.company_id.in_(company_ids), Flight.departure <= now).count()

    tq = db.query(Ticket).join(Flight, Ticket.flight_id == Flight.id).filter(Flight.company_id.in_(company_ids), Ticket.status == "paid")
    if start and end:
        tq = tq.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    passengers = tq.count()
    revenue = db.query(func.coalesce(func.sum(Ticket.price_paid), 0)).join(Flight, Ticket.flight_id == Flight.id).filter(Flight.company_id.in_(company_ids), Ticket.status == "paid")
    if start and end:
        revenue = revenue.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    revenue = revenue.scalar() or 0
    # Seats sold (paid tickets) in selected range
    seats_sold_q = db.query(func.count(Ticket.id)).join(Flight, Ticket.flight_id == Flight.id).filter(Flight.company_id.in_(company_ids), Ticket.status == "paid")
    if start and end:
        seats_sold_q = seats_sold_q.filter(Ticket.purchased_at >= start, Ticket.purchased_at < end)
    seats_sold = seats_sold_q.scalar() or 0
    load_factor = float(seats_sold) / float(seats_capacity) if seats_capacity else 0.0
    return {"flights": flights_total, "active": active, "completed": completed, "passengers": passengers, "revenue": float(revenue), "seats_capacity": int(seats_capacity), "seats_sold": int(seats_sold), "load_factor": load_factor}


@router.get("/info", response_model=dict)
def company_info(db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Return list of companies (id, name) accessible to current manager or all for admin."""
    email, roles = identity
    if "admin" in roles:
        companies = db.query(Company).all()
    else:
        ids = _get_manager_company_ids(db, email)
        if not ids:
            return {"companies": []}
        companies = db.query(Company).filter(Company.id.in_(ids)).all()
    return {"companies": [{"id": c.id, "name": c.name} for c in companies]}
