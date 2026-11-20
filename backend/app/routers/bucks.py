"""Revel Bucks: balances, ledger, transactions, appeals, hearing time slots."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import schemas, services
from ..database import get_db
from ..deps import any_role, member
from ..models import Appeal, Transaction, User

router = APIRouter(prefix="/api/bucks", tags=["revel-bucks"])


@router.get("/balances", response_model=list[schemas.MemberBalance])
def studio_balances(db: Session = Depends(get_db), _: User = Depends(any_role)):
    """Studio Balances tab: every active learner (guides excluded), richest first."""
    rows = db.scalars(select(User).where(User.role == "user", User.is_active.is_(True))
                      .order_by(User.balance.desc(), User.display_name))
    return [schemas.MemberBalance.model_validate(u) for u in rows]


@router.get("/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(
    scope: Literal["mine", "studio", "user"] = "mine",
    user_id: int | None = Query(default=None, description="required when scope=user"),
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(get_db),
    viewer: User = Depends(member),
):
    """mine = My Revel Bucks; studio = Studio Transactions; user = read-only ledger of one learner."""
    q = select(Transaction).order_by(Transaction.created_at.desc(), Transaction.id.desc()).limit(limit)
    if scope == "mine":
        q = q.where(or_(Transaction.actor_id == viewer.id, Transaction.target_id == viewer.id))
    elif scope == "user":
        if user_id is None:
            services.bad("user_id is required for scope=user")
        q = q.where(or_(Transaction.actor_id == user_id, Transaction.target_id == user_id))
    return [services.tx_out(t, viewer) for t in db.scalars(q)]


@router.post("/transactions", response_model=schemas.TransactionOut, status_code=201)
def make_transaction(data: schemas.TransactionCreate, db: Session = Depends(get_db),
                     actor: User = Depends(member)):
    return services.tx_out(services.create_transaction(db, actor, data), actor)


@router.get("/time-slots", response_model=list[schemas.TimeSlotOut])
def free_time_slots(db: Session = Depends(get_db), _: User = Depends(member)):
    """Hearing slots that are not booked by a pending appeal."""
    return [schemas.TimeSlotOut.model_validate(s) for s in services.available_slots(db)]


@router.get("/appeals", response_model=list[schemas.AppealOut])
def list_appeals(status: Literal["pending", "approved", "denied", "all"] = "pending",
                 db: Session = Depends(get_db), viewer: User = Depends(member)):
    q = select(Appeal).order_by(Appeal.submitted_at)
    if status != "all":
        q = q.where(Appeal.status == status)
    return [services.appeal_out(a, viewer) for a in db.scalars(q)]


@router.post("/appeals", response_model=schemas.AppealOut, status_code=201)
def file_appeal(data: schemas.AppealCreate, db: Session = Depends(get_db), user: User = Depends(member)):
    return services.appeal_out(services.file_appeal(db, user, data), user)


@router.post("/appeals/{appeal_id}/resolve", response_model=schemas.AppealOut)
def resolve_appeal(appeal_id: int, data: schemas.AppealResolve, db: Session = Depends(get_db),
                   user: User = Depends(member)):
    return services.appeal_out(services.resolve_appeal(db, user, appeal_id, data.decision), user)
