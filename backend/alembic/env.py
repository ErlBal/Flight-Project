from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import logging
import sys

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")
logger.setLevel(logging.DEBUG)
logger.debug("[env.py] loaded alembic env module")

# Add current app models metadata
from app.models.base import Base  # noqa: E402
from app.models import user, flight, ticket, company, company_manager  # noqa: F401,E402
from app.models import banner, offer  # noqa: F401,E402

target_metadata = Base.metadata

_run_id = getattr(config, "_debug_run_id", 0) + 1
setattr(config, "_debug_run_id", _run_id)
logger.debug(f"[env.py] run sequence id={_run_id}")

# DATABASE_URL from env (alembic.ini placeholder replaced at runtime)
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")


def run_migrations_offline():
    logger.debug("[env.py] entering run_migrations_offline")
    url = DB_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        logger.debug("[env.py] offline begin_transaction")
        context.run_migrations()
        logger.debug("[env.py] offline migrations finished")


def run_migrations_online():
    logger.debug("[env.py] entering run_migrations_online")
    connectable = engine_from_config(
        {"sqlalchemy.url": DB_URL},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        logger.debug("[env.py] obtained connection")
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            logger.debug("[env.py] online begin_transaction")
            context.run_migrations()
            logger.debug("[env.py] online migrations finished")

logger.debug(f"[env.py] context offline? {context.is_offline_mode()}")
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
logger.debug("[env.py] end of env.py module execution")
