from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

app = FastAPI(title="FlightProject API", version="0.1.0")

# Allow local dev and Cloud Run defaults
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"  # tighten in prod
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
