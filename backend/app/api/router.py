from fastapi import APIRouter

from app.api.routes import health, auth, flights, tickets, company, admin

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])  # GET /
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])  # POST /login, /register
api_router.include_router(flights.router, prefix="/flights", tags=["flights"])  # GET /, GET /{id}
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])  # POST /, GET /{confirmation_id}
api_router.include_router(company.router, prefix="/company", tags=["company"])  # company manager endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])  # admin endpoints
