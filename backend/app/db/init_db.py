from datetime import datetime, timedelta
from app.db.session import engine, SessionLocal
from app.models import user  # noqa: F401
from app.models import company  # noqa: F401
from app.models import company_manager  # noqa: F401
from app.models import flight  # noqa: F401
from app.models import ticket  # noqa: F401
from app.models.base import Base
from app.models.flight import Flight
from app.models.company import Company

def create_tables():
    Base.metadata.create_all(bind=engine)

def seed_demo_data():
    db = SessionLocal()
    try:
        # ensure at least one demo company
        demo_company = db.query(Company).filter(Company.name == "DemoAir").first()
        if not demo_company:
            demo_company = Company(name="DemoAir", is_active=True)
            db.add(demo_company)
            db.commit()
            db.refresh(demo_company)

        if db.query(Flight).count() == 0:
            now = datetime.utcnow()
            flights = [
                Flight(airline="DemoAir", flight_number="DA101", origin="ALA", destination="NQZ",
                       departure=now + timedelta(days=1), arrival=now + timedelta(days=1, hours=1, minutes=30),
                       price=39.00, seats_total=180, seats_available=120, company_id=demo_company.id),
                Flight(airline="DemoAir", flight_number="DA202", origin="ALA", destination="DXB",
                       departure=now + timedelta(days=2), arrival=now + timedelta(days=2, hours=4, minutes=30),
                       price=129.00, seats_total=200, seats_available=150, company_id=demo_company.id),
            ]
            db.add_all(flights)
            db.commit()
    finally:
        db.close()
