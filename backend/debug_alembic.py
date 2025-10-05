"""Вспомогательный скрипт для отладки применения Alembic миграций.

Запускать из каталога backend внутри активного venv:
    python debug_alembic.py

Печатает шаги и исключение (если есть)."""
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
    db_url = cfg.get_main_option("sqlalchemy.url")
    print("[debug] sqlalchemy.url:", db_url)
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
