from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import importlib.util
from app.core.config import settings

# Postgres-only: DATABASE_URL must be set. We intentionally removed any SQLite fallback
# to avoid divergence between local/dev and docker environments.
SQLALCHEMY_DATABASE_URL = settings.database_url
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set (Postgres only setup)")

# If the provided URL is the plain 'postgresql://' (or legacy 'postgres://') SQLAlchemy
# will try to load the default driver (psycopg2). We only have 'psycopg' v3 installed
# (dependency: psycopg[binary]) and not 'psycopg2'. To avoid a ModuleNotFoundError we
# transparently adjust the URL to use the 'psycopg' driver if psycopg2 is absent.
try:
    psycopg2_present = importlib.util.find_spec("psycopg2") is not None  # type: ignore
except Exception:  # pragma: no cover - defensive
    psycopg2_present = False

if not psycopg2_present and SQLALCHEMY_DATABASE_URL.startswith(("postgres://", "postgresql://")) and "+psycopg" not in SQLALCHEMY_DATABASE_URL:
    # Normalize legacy prefix 'postgres://' -> 'postgresql://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = "postgresql://" + SQLALCHEMY_DATABASE_URL[len("postgres://"):]
    # Inject driver
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
