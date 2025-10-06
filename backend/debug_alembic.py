"""Helper script to debug application of Alembic migrations.

Run from the backend directory inside an active virtual environment:
    python debug_alembic.py

Prints steps and any exception (if present)."""
from alembic.config import Config
from alembic import command
import os
import sys

def main():
    here = os.path.abspath(os.path.dirname(__file__))
    ini_path = os.path.join(here, "alembic.ini")
    if not os.path.exists(ini_path):
        print("[debug] alembic.ini not found at", ini_path)
        sys.exit(1)
    cfg = Config(ini_path)
    print("[debug] Using alembic.ini:", ini_path)
    print("[debug] script_location:", cfg.get_main_option("script_location"))
    db_url = os.getenv("DATABASE_URL") or cfg.get_main_option("sqlalchemy.url")
    print("[debug] effective sqlalchemy.url (env first):", db_url)
    if not os.getenv("DATABASE_URL"):
        print("[warn] DATABASE_URL env not set. Set it for Postgres-only setup.")
    try:
        print("[debug] upgrading to head...")
        command.upgrade(cfg, "head")
        print("[debug] upgrade complete")
    except Exception as e:
        print("[debug] upgrade failed:")
        import traceback
        traceback.print_exc()
        sys.exit(2)

if __name__ == "__main__":
    main()
