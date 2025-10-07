## FlightProject
Domain: airline ticketing (flights, tickets, companies, notifications).

### Project link
https://flight-project-omega.vercel.app

### YouTube link
https://youtu.be/M22cENFLSK8


### Repository Structure
- `backend/` FastAPI application (Python 3.11, SQLAlchemy 2, Alembic, JWT)
- `frontend/` React 18 + Vite + TypeScript client
- `infra/` Docker Compose (Postgres + services)
- `docs/` Operational and API notes

### Core Technologies
Backend: FastAPI, SQLAlchemy, Pydantic, PyJWT, Alembic
Frontend: React, Vite, TypeScript, Axios
Database: PostgreSQL
Containerization: Docker, docker-compose (dev)

### Environments
Local development: docker-compose (Postgres + backend + frontend dev server)
Production backend: Railway (FastAPI + Postgres external)
Production frontend: Vercel (static build served over CDN)

### Deployment (Current State)
Backend host: https://flight-project-production.up.railway.app
Frontend host: https://flight-project-omega.vercel.app
WebSocket expected path (mounted): /notifications/ws/notifications
API base path: root (e.g. /health/, /auth/login, /flights/)

### Environment Variables (Key)
`ENV` (dev|prod) – runtime environment selector
`DATABASE_URL` – Postgres connection string
`SECRET_KEY` – JWT signing key
`ACCESS_TOKEN_EXPIRE_MINUTES` – access token lifetime
`CORS_ORIGINS` – comma-separated allowed origins (must include frontend domain in prod)
`ADMIN_EMAILS`, `MANAGER_EMAILS` – initial role assignment on first login

### Frontend Build Configuration
Required build-time vars:
`VITE_API_BASE` = https://flight-project-production.up.railway.app
Optional override (if path changes):
`VITE_WS_URL` (defaults to API base transformed to wss + websocket path)

### Authentication
JWT (Bearer) in Authorization header. Roles: user, company_manager, admin.
Token validation server-side; WebSocket token via query (?token=) or Authorization header.

### Database Schema (High-Level)
Tables: users, companies, company_manager links, flights, tickets, notifications, banners, offers.
Migrations: Alembic versions under `backend/alembic/versions/`.

### Notifications
Transport: WebSocket (JSON messages). Fallback to polling for unread count every 30s.
WS auth: query param `token` or `Authorization: Bearer <token>`.

### Deployment Procedure (Current)
1. Push to main (GitHub) → manual or CI build (frontend) → deploy to Vercel.
2. Backend: build & deploy container/image on Railway (start command runs uvicorn).
3. Alembic auto-migration enabled in production startup (controlled by env `AUTO_APPLY_MIGRATIONS=1`).
4. Set environment variables in Railway dashboard (at minimum: ENV=prod, DATABASE_URL, SECRET_KEY, CORS_ORIGINS).
5. Frontend environment variable `VITE_API_BASE` points to Railway backend URL.

### CORS
Configured via FastAPI CORSMiddleware using `settings.cors_origins` (derived from `CORS_ORIGINS`). Must explicitly list Vercel production URL.

### Local Development (Condensed)
Prerequisites: Docker + Docker Compose.
Commands (conceptual):
1. Set `.env` in backend (DATABASE_URL for local Postgres in compose).
2. `docker compose up --build` (from `infra/` or repo root depending on compose file location).
3. Frontend dev server: Vite on :5173 (hot reload).
4. Backend API: Uvicorn on :8000.
