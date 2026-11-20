"""Guide/admin console: accounts, roles, Council membership, hearing time slots."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas, services
from ..database import get_db
from ..deps import admin_only
from ..models import Appeal, Studio, TimeSlot, User
from ..security import hash_password
from .auth import user_out

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.role, User.display_name))]


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(data: schemas.UserCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    username = data.username.lower()
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(400, "Username already taken")
    u = User(username=username, password_hash=hash_password(data.password), display_name=data.display_name,
             avatar=data.avatar, role=data.role, is_council=data.is_council and data.role == "user",
             balance=data.balance if data.role == "user" else 0, top_skill=data.top_skill,
             studio_id=admin.studio_id or db.scalar(select(Studio.id)))
    db.add(u)
    db.commit()
    return user_out(u)


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db),
                admin: User = Depends(admin_only)):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(404, "User not found")
    changes = data.model_dump(exclude_unset=True)
    if u.id == admin.id and (changes.get("role", "admin") != "admin" or changes.get("is_active") is False):
        raise HTTPException(400, "You can't demote or disable your own account")
    if "password" in changes:
        u.password_hash = hash_password(changes.pop("password"))
    for k, v in changes.items():
        setattr(u, k, v)
    if u.role != "user":
        u.is_council = False  # Council is a learner position
    db.commit()
    return user_out(u)


@router.get("/time-slots", response_model=list[schemas.TimeSlotOut])
def all_slots(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    booked = set(db.scalars(select(Appeal.time_slot_id).where(Appeal.status == "pending")))
    return [schemas.TimeSlotOut(id=s.id, label=s.label, is_active=s.is_active, is_booked=s.id in booked)
            for s in db.scalars(select(TimeSlot).order_by(TimeSlot.id))]


@router.post("/time-slots", response_model=schemas.TimeSlotOut, status_code=201)
def add_slot(data: schemas.TimeSlotCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    s = db.scalar(select(TimeSlot).where(TimeSlot.label == data.label.strip()))
    if s:
        s.is_active = True
    else:
        s = TimeSlot(label=data.label.strip())
        db.add(s)
    db.commit()
    return schemas.TimeSlotOut.model_validate(s)


@router.delete("/time-slots/{slot_id}", status_code=204)
def retire_slot(slot_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    s = db.get(TimeSlot, slot_id)
    if s is None:
        raise HTTPException(404, "Slot not found")
    if s.id not in {x.id for x in services.available_slots(db)} and s.is_active:
        raise HTTPException(400, "Slot is booked by a pending appeal")
    s.is_active = False  # soft delete: old appeals still reference it
    db.commit()
