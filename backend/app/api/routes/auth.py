from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.auth import Token, UserRegister, UserOut

router = APIRouter()

# NOTE: These are stubs; real implementation will use DB

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # MVP: Determine role by email lists from env; replace with DB lookup later
    email = form_data.username.lower()
    role = "user"
    if email in [e.lower() for e in settings.admin_emails]:
        role = "admin"
    elif email in [e.lower() for e in settings.manager_emails]:
        role = "company_manager"
    access_token = create_access_token(subject=email, roles=[role])
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserOut)
def register(payload: UserRegister):
    # Stub: assign role by email lists for now
    email = payload.email.lower()
    role = "user"
    if email in [e.lower() for e in settings.admin_emails]:
        role = "admin"
    elif email in [e.lower() for e in settings.manager_emails]:
        role = "company_manager"
    return {"id": 1, "email": payload.email, "full_name": payload.full_name, "role": role, "is_active": True}
