from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.schemas.auth import Token, UserRegister, UserOut
from app.db.session import get_db
from app.models.user import User

router = APIRouter()

# NOTE: DB-backed implementation with auto-provision by email lists (dev-friendly)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form_data.username.lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")
        role = user.role
    else:
        # Auto-provision user on first login based on role-by-email lists
        role = "user"
        if email in [e.lower() for e in settings.admin_emails]:
            role = "admin"
        elif email in [e.lower() for e in settings.manager_emails]:
            role = "company_manager"
        user = User(email=email, full_name=email.split("@")[0], hashed_password=get_password_hash(form_data.password), role=role, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    access_token = create_access_token(subject=email, roles=[role])
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserOut)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = payload.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    role = "user"
    if email in [e.lower() for e in settings.admin_emails]:
        role = "admin"
    elif email in [e.lower() for e in settings.manager_emails]:
        role = "company_manager"
    user = User(email=email, full_name=payload.full_name, hashed_password=get_password_hash(payload.password), role=role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "is_active": user.is_active}
