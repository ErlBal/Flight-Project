from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.db.session import SessionLocal
from app.models.flight import Flight
from app.models.ticket import Ticket
from app.models.ticket_reminder import TicketReminder
from app.models.notification import Notification
from app.services.notification_ws import manager as ws_manager
import asyncio

STANDARD_HOURS = [24, 2]
SCAN_INTERVAL_SECONDS = 60
LOOKAHEAD_HOURS = 26
MAX_BATCH = 200

async def _send_notification(email: str, message: str):
    try:
        await ws_manager.send_to_user(email, {"type": "notification", "data": {"type": "reminder", "message": message, "created_at": datetime.utcnow().isoformat()}})
    except Exception:
        pass

def _create_notification(db: Session, email: str, message: str):
    n = Notification(user_email=email, type="reminder", message=message)
    db.add(n)

def _process_standard(db: Session, now: datetime):
    window_start = now
    window_end = now + timedelta(hours=LOOKAHEAD_HOURS)
    flights = db.query(Flight).filter(Flight.departure >= window_start, Flight.departure <= window_end).all()
    if not flights:
        return []
    flight_map = {f.id: f for f in flights}
    flight_ids = list(flight_map.keys())
    tickets = db.query(Ticket).filter(Ticket.flight_id.in_(flight_ids), Ticket.status == "paid").all()
    if not tickets:
        return []
    existing = db.query(TicketReminder).filter(TicketReminder.ticket_id.in_([t.id for t in tickets]), TicketReminder.type == "standard").all()
    existing_map = {(r.ticket_id, r.hours_before): r for r in existing}
    created = []
    for t in tickets:
        f = flight_map.get(t.flight_id)
        if not f:
            continue
        for h in STANDARD_HOURS:
            sched_at = f.departure - timedelta(hours=h)
            if sched_at <= now:
                continue
            key = (t.id, h)
            if key in existing_map:
                continue
            r = TicketReminder(ticket_id=t.id, user_email=t.user_email, hours_before=h, type="standard", scheduled_at=sched_at)
            db.add(r)
            existing_map[key] = r
            created.append(r)
            if len(created) >= MAX_BATCH:
                break
        if len(created) >= MAX_BATCH:
            break
    return created

def _fire_due(db: Session, now: datetime):
    due = db.query(TicketReminder).filter(and_(TicketReminder.sent == False, TicketReminder.scheduled_at <= now)).limit(MAX_BATCH).all()  # noqa: E712
    if not due:
        return []
    ticket_ids = {r.ticket_id for r in due}
    tickets = {t.id: t for t in db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).all()}
    flight_ids = {t.flight_id for t in tickets.values()}
    flights = {f.id: f for f in db.query(Flight).filter(Flight.id.in_(flight_ids)).all()}
    fired = []
    for r in due:
        t = tickets.get(r.ticket_id)
        if not t:
            continue
        f = flights.get(t.flight_id)
        if not f:
            continue
        hours = r.hours_before
        message = f"Reminder: Flight {f.flight_number} {f.origin}->{f.destination} departs at {f.departure.isoformat()} (in ~{hours}h)."
        _create_notification(db, r.user_email, message)
        r.sent = True
        fired.append((r, message))
    return fired

async def reminder_loop():
    await asyncio.sleep(3)
    while True:
        now = datetime.utcnow()
        try:
            db = SessionLocal()
            _process_standard(db, now)
            fired = _fire_due(db, now)
            db.commit()
            for r, msg in fired:
                await _send_notification(r.user_email, msg)
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            try:
                db.close()
            except Exception:
                pass
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)
