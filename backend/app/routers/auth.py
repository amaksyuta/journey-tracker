from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..database import get_db
from ..deps import any_role
from ..models import User
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> schemas.UserOut:
    return schemas.UserOut(
        id=u.id, username=u.username, display_name=u.display_name, avatar=u.avatar, role=u.role,
        is_council=u.is_council, is_active=u.is_active, studio=u.studio.name if u.studio else None,
        balance=u.balance, xp=u.xp, level=u.level, streak=u.streak, top_skill=u.top_skill,
    )


def _token(u: User) -> schemas.TokenOut:
    return schemas.TokenOut(access_token=create_access_token(u.id, u.role), user=user_out(u))


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    if u is None or not u.is_active or not verify_password(data.password, u.password_hash):
        # Same message for "no such user" and "wrong password" - don't leak usernames.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    return _token(u)


@router.post("/guest", response_model=schemas.TokenOut)
def guest_login(db: Session = Depends(get_db)):
    """'Continue as guest' - signs in as the shared, read-only guest account."""
    if not settings.GUEST_LOGIN_ENABLED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Guest access is disabled")
    u = db.scalar(select(User).where(User.role == "guest", User.is_active.is_(True)).order_by(User.id))
    if u is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No guest account configured")
    return _token(u)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(any_role)):
    return user_out(user)
