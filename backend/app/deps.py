"""FastAPI dependencies: current user + role guards (RBAC).

Every protected endpoint declares the roles it accepts, e.g.
    user: User = Depends(require_roles("admin", "user"))
The frontend hides buttons a role can't use, but the server is the authority.
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"This action requires role: {', '.join(roles)}")
        return user
    return checker


# Shorthands
any_role = require_roles("admin", "user", "guest")
member = require_roles("admin", "user")   # signed-in learners and guides
learner = require_roles("user")
admin_only = require_roles("admin")


def can_resolve_appeals(user: User) -> bool:
    return user.role == "admin" or (user.role == "user" and user.is_council)
