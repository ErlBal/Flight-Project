from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

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
    airlines: str | None = Query(None, description="Comma separated airlines filter"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    date: str | None = Query(None, description="Flight departure date YYYY-MM-DD"),
    dep_after: str | None = Query(None, description="Departure >= ISO datetime"),
    dep_before: str | None = Query(None, description="Departure <= ISO datetime"),
    arr_after: str | None = Query(None, description="Arrival >= ISO datetime"),
    arr_before: str | None = Query(None, description="Arrival <= ISO datetime"),
    passengers: int | None = Query(None, ge=1, description="Required seats available"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    sort_by: str = Query("departure", pattern="^(price|departure|stops)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    dep_time_from: str | None = Query(None, description="Departure time-of-day from HH:MM (UTC)"),
    dep_time_to: str | None = Query(None, description="Departure time-of-day to HH:MM (UTC)"),
    arr_time_from: str | None = Query(None, description="Arrival time-of-day from HH:MM (UTC)"),
    arr_time_to: str | None = Query(None, description="Arrival time-of-day to HH:MM (UTC)"),
    max_stops: int | None = Query(None, ge=0, description="Max number of stops (layovers)"),
    stops_min: int | None = Query(None, ge=0),
    stops_max: int | None = Query(None, ge=0),
):
    q = db.query(Flight)
    if origin:
        q = q.filter(Flight.origin == origin)
    if destination:
        q = q.filter(Flight.destination == destination)
    if airline:
        q = q.filter(Flight.airline == airline)
    if airlines:
        parts = [a.strip() for a in airlines.split(',') if a.strip()]
        if parts:
            q = q.filter(Flight.airline.in_(parts))
    if min_price is not None:
        q = q.filter(Flight.price >= min_price)
    if max_price is not None:
        q = q.filter(Flight.price <= max_price)
    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.combine(day, datetime.min.time())
            end_dt = start_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            q = q.filter(Flight.departure >= start_dt, Flight.departure <= end_dt)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format, expected YYYY-MM-DD")
    if passengers is not None:
        q = q.filter(Flight.seats_available >= passengers)

    # advanced datetime window filters (added after date window so they can further constrain)
    def _parse_iso(ts: str, label: str):
        try:
            return datetime.fromisoformat(ts)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid {label} datetime; expected ISO 8601")

    if dep_after:
        q = q.filter(Flight.departure >= _parse_iso(dep_after, 'dep_after'))
    if dep_before:
        q = q.filter(Flight.departure <= _parse_iso(dep_before, 'dep_before'))
    if arr_after:
        q = q.filter(Flight.arrival >= _parse_iso(arr_after, 'arr_after'))
    if arr_before:
        q = q.filter(Flight.arrival <= _parse_iso(arr_before, 'arr_before'))

    # stops filters (min/max supersede legacy max_stops if provided)
    if stops_min is not None:
        q = q.filter(Flight.stops >= stops_min)
    if stops_max is not None:
        q = q.filter(Flight.stops <= stops_max)
    elif max_stops is not None:
        q = q.filter(Flight.stops <= max_stops)

    # time-of-day filtering (departure and arrival); Python side to stay DB agnostic
    if dep_time_from or dep_time_to or arr_time_from or arr_time_to:
        def _parse_hm(val: str):
            try:
                return datetime.strptime(val, "%H:%M").time()
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid time format HH:MM")
        dep_from_t = _parse_hm(dep_time_from) if dep_time_from else None
        dep_to_t = _parse_hm(dep_time_to) if dep_time_to else None
        arr_from_t = _parse_hm(arr_time_from) if arr_time_from else None
        arr_to_t = _parse_hm(arr_time_to) if arr_time_to else None
        flights_filtered = []
        for f_obj in q.all():
            dt_dep = f_obj.departure.time()
            dt_arr = f_obj.arrival.time()
            if dep_from_t and dt_dep < dep_from_t:
                continue
            if dep_to_t and dt_dep > dep_to_t:
                continue
            if arr_from_t and dt_arr < arr_from_t:
                continue
            if arr_to_t and dt_arr > arr_to_t:
                continue
            flights_filtered.append(f_obj)
        total = len(flights_filtered)
        if sort_by == "price":
            flights_filtered.sort(key=lambda x: float(x.price), reverse=(sort_dir == "desc"))
        elif sort_by == "stops":
            flights_filtered.sort(key=lambda x: x.stops, reverse=(sort_dir == "desc"))
        else:
            flights_filtered.sort(key=lambda x: x.departure, reverse=(sort_dir == "desc"))
        start = (page - 1) * page_size
        items = flights_filtered[start:start + page_size]
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
                "stops": f.stops,
            } for f in items
        ], "total": total, "page": page, "page_size": page_size}
    total = q.count()
    # sorting
    if sort_by == "price":
        order_col = Flight.price
    elif sort_by == "stops":
        order_col = Flight.stops
    else:
        order_col = Flight.departure
    if sort_dir == "desc":
        order_col = order_col.desc()
    q = q.order_by(order_col)
    offset = (page - 1) * page_size
    items = q.offset(offset).limit(page_size).all()
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
            "stops": f.stops,
        } for f in items
    ], "total": total, "page": page, "page_size": page_size}

@router.get("/{flight_id}")
def flight_detail(flight_id: int, db: Session = Depends(get_db)):
    f = db.get(Flight, flight_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    duration_minutes = int((f.arrival - f.departure).total_seconds() // 60)
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
        "stops": f.stops,
        "duration_minutes": duration_minutes,
        "layovers": [],  # placeholder for future implementation
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
            stops=int(payload.get("stops", 0)),
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
    if "stops" in payload:
        val = int(payload["stops"])
        if val < 0:
            raise HTTPException(status_code=400, detail="stops must be >= 0")
        f.stops = val
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
