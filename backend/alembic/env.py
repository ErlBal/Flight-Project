from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import logging
import sys
from pathlib import Path

# Ensure the project root (which contains the 'app' package) is on sys.path even
# if Alembic is executed with CWD set to the 'alembic' directory inside the container.
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # /app
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")

# Add current app models metadata
from app.models.base import Base  # noqa: E402
from app.models import user, flight, ticket, company, company_manager  # noqa: F401,E402
from app.models import banner, offer  # noqa: F401,E402
from app.models import ticket_reminder  # noqa: F401,E402

target_metadata = Base.metadata

_ran = getattr(config, "_single_pass_done", False)
if _ran:
    # Suppress second invocation (framework quirk); first run already applied migrations.
    raise SystemExit(0)
setattr(config, "_single_pass_done", True)

# DATABASE_URL must be provided (Postgres only). No SQLite fallback.
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise SystemExit("DATABASE_URL env var is required for migrations (Postgres only setup)")


def run_migrations_offline():
    url = DB_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": DB_URL},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
