from fastapi import FastAPI
import asyncio
from app.services.reminder_scheduler import reminder_loop
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import seed_demo_data

app = FastAPI(title="FlightProject API", version="0.1.0")

# Configurable CORS origins (CORS_ORIGINS env). If empty -> dev defaults.
origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    if settings.env.lower() in {"dev", "development"}:
        seed_demo_data()
    try:
        asyncio.create_task(reminder_loop())
    except Exception:
        pass
