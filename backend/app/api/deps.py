from typing import List, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_roles(token: str = Depends(oauth2_scheme)) -> List[str]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        roles = payload.get("roles") or []
        if not isinstance(roles, list):
            roles = [roles]
        return roles
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_roles(*allowed: str):
    def checker(roles: List[str] = Depends(get_current_roles)):
        if not any(r in roles for r in allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return checker

def get_current_identity(token: str = Depends(oauth2_scheme)) -> Tuple[str, List[str]]:
    """Return (email, roles) from the JWT token.

    (Keeping signature backward-compatible; company_ids can be fetched separately if needed.)
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Missing subject")
        roles = payload.get("roles") or []
        if not isinstance(roles, list):
            roles = [roles]
        return sub, roles
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
