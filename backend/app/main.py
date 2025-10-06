from fastapi import FastAPI
import asyncio
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from app.services.reminder_scheduler import reminder_loop

from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import seed_demo_data

def _run_migrations_if_needed():
    """Apply Alembic migrations automatically in production if enabled.

    This removes the need to open a remote shell (useful on PaaS like Railway).
    Controlled by env var AUTO_APPLY_MIGRATIONS (default: '1'). Safe to run repeatedly.
    """
    if settings.env.lower() != "prod":
        return
    if os.getenv("AUTO_APPLY_MIGRATIONS", "1") != "1":
        return
    try:
        from alembic import command  # type: ignore
        from alembic.config import Config  # type: ignore
        alembic_ini = Path(__file__).resolve().parents[1] / "alembic.ini"
        if not alembic_ini.exists():
            print(f"[migrate] alembic.ini not found at {alembic_ini}, skipping auto-migrations")
            return
        cfg = Config(str(alembic_ini))
        # Ensure script_location resolves correctly when launched from arbitrary CWD
        script_location = Path(__file__).resolve().parents[1] / "alembic"
        if script_location.exists():
            cfg.set_main_option("script_location", str(script_location))
        print("[migrate] Applying Alembic migrations -> head ...")
        command.upgrade(cfg, "head")
        print("[migrate] Migrations applied successfully")
    except Exception as e:  # pragma: no cover
        # Do not kill the app on migration failure, just log; can be retried manually.
        print(f"[migrate] Migration failed: {e}")

app = FastAPI(title="FlightProject API", version="0.1.0")

# Configurable CORS origins (CORS_ORIGINS env). If empty -> dev defaults.
origins = settings.cors_origins
print("[startup] Resolved CORS origins:", origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary debug middleware to help diagnose missing CORS header issues in prod.
# Remove after confirming that the production frontend origin is present.
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore

class _OriginDebugMiddleware(BaseHTTPMiddleware):  # pragma: no cover (diagnostic only)
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            print(f"[cors-debug] Incoming Origin '{origin}' not in allowed origins {origins}")
        return await call_next(request)

app.add_middleware(_OriginDebugMiddleware)

app.include_router(api_router)

# Duplicate routes without trailing slash for most-called public endpoints to avoid 307 redirects from front-end queries.
from fastapi import APIRouter
from app.api.routes.flights import router as flights_router  # type: ignore
from app.api.routes.tickets import router as tickets_router  # type: ignore
from app.api.routes.content import router as content_router  # type: ignore

alias_router = APIRouter()

# Simple alias endpoints mapping (only GET roots) — we re-declare path operation functions via includes with custom prefix.
# To minimize duplication, just provide a lightweight ping and rely on frontend using canonical slashed routes gradually.
@alias_router.get("/flights")
async def flights_alias_redirect_note():
    return {"detail": "Use /flights/ - alias provided to avoid redirect", "ok": True}

@alias_router.get("/content/banners")
async def banners_alias():
    return {"detail": "Use /content/banners/ - alias", "ok": True}

@alias_router.get("/content/offers")
async def offers_alias():
    return {"detail": "Use /content/offers/ - alias", "ok": True}

app.include_router(alias_router)

@app.on_event("startup")
def startup():
    # On startup only seed idempotent data (admin, manager, demo company) AFTER migrations applied.
    _run_migrations_if_needed()
    if settings.env.lower() in {"dev", "development"}:
        seed_demo_data()
    try:
        asyncio.create_task(reminder_loop())
    except Exception:
        pass
