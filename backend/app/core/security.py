from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Prefer argon2, keep bcrypt as fallback for compatibility
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str | Any, roles: list[str], expires_delta: Optional[timedelta] = None, company_ids: list[int] | None = None) -> str:
    expire = datetime.now(tz=timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode: dict[str, Any] = {"sub": str(subject), "exp": expire, "roles": roles}
    if company_ids:
        to_encode["company_ids"] = company_ids
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode an access token without role verification.
    Raises jwt.PyJWTError if invalid and returns the payload as a dict.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return payload
