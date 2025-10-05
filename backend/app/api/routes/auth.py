from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.company_manager import CompanyManager
from app.models.company import Company
from app.core.config import settings
from app.schemas.auth import Token, UserRegister, UserOut, UserLogin
from app.db.session import get_db
from app.models.user import User

router = APIRouter()

# NOTE: DB-backed implementation with auto-provision by email lists (dev-friendly)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Классический логин: пользователь уже должен существовать. Без автосоздания.
    Возвращает 401 если:
      - пользователь не найден
      - пароль неверен
    Возвращает 403 если пользователь заблокирован.
    """
    email = form_data.username.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is blocked")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")
    company_ids: list[int] = []
    if user.role == "company_manager":
        links = db.query(CompanyManager).filter(CompanyManager.user_id == user.id).all()
        company_ids = [l.company_id for l in links]
    access_token = create_access_token(subject=email, roles=[user.role], company_ids=company_ids)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login-json", response_model=Token)
def login_json(payload: UserLogin, db: Session = Depends(get_db)):
    """JSON логин без автосоздания. Поведение идентично /login."""
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is blocked")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")
    company_ids: list[int] = []
    if user.role == "company_manager":
        links = db.query(CompanyManager).filter(CompanyManager.user_id == user.id).all()
        company_ids = [l.company_id for l in links]
    access_token = create_access_token(subject=email, roles=[user.role], company_ids=company_ids)
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
