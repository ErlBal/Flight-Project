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
from app.models.user import User
from app.models.company_manager import CompanyManager
from app.core.config import settings

def create_tables():
    Base.metadata.create_all(bind=engine)
    # Lightweight migration: ensure tickets.price_paid exists (Postgres-friendly)
    # Use a transaction so DDL is committed on Postgres
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "ALTER TABLE IF EXISTS tickets ADD COLUMN IF NOT EXISTS price_paid NUMERIC(10,2)"
            )
    except Exception:
        # Best-effort migration; ignore if database doesn't support this syntax
        pass

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

     # Demo flights удалены по запросу. Оставляем блок закомментированным для возможного будущего использования.
     # if db.query(Flight).count() == 0:
     #     now = datetime.utcnow()
     #     flights = [
     #         Flight(airline="DemoAir", flight_number="DA101", origin="ALA", destination="NQZ",
     #                departure=now + timedelta(days=1), arrival=now + timedelta(days=1, hours=1, minutes=30),
     #                price=39.00, seats_total=180, seats_available=120, company_id=demo_company.id),
     #         Flight(airline="DemoAir", flight_number="DA202", origin="ALA", destination="DXB",
     #                departure=now + timedelta(days=2), arrival=now + timedelta(days=2, hours=4, minutes=30),
     #                price=129.00, seats_total=200, seats_available=150, company_id=demo_company.id),
     #     ]
     #     db.add_all(flights)
     #     db.commit()

        # Seed default admin and manager (idempotent)
        admin_email = (settings.seed_admin_email or "admin@example.com").lower()
        admin_pwd = settings.seed_admin_password or "Admin1234!"
        manager_email = (settings.seed_manager_email or "manager@example.com").lower()
        manager_pwd = settings.seed_manager_password or "Manager1234!"

        from app.core.security import get_password_hash

        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                email=admin_email,
                full_name="Admin",
                hashed_password=get_password_hash(admin_pwd),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        manager = db.query(User).filter(User.email == manager_email).first()
        if not manager:
            manager = User(
                email=manager_email,
                full_name="Manager",
                hashed_password=get_password_hash(manager_pwd),
                role="company_manager",
                is_active=True,
            )
            db.add(manager)
            db.commit()
            db.refresh(manager)

        # Ensure manager is assigned to DemoAir
        if manager:
            exists = (
                db.query(CompanyManager)
                .filter(CompanyManager.user_id == manager.id, CompanyManager.company_id == demo_company.id)
                .first()
            )
            if not exists:
                link = CompanyManager(user_id=manager.id, company_id=demo_company.id)
                db.add(link)
                db.commit()
    finally:
        db.close()
