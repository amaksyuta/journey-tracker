"""Dashboard (Mission Control), Hero Portfolio, Fellow Travelers directory."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import schemas, services
from ..database import get_db
from ..deps import any_role
from ..models import Appeal, BadgeSubmission, Goal, Transaction, User
from .auth import user_out
from .badges import submission_out

router = APIRouter(prefix="/api", tags=["people"])


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(any_role)):
    goals = list(db.scalars(select(Goal).where(Goal.owner_id == user.id)))
    subs = list(db.scalars(select(BadgeSubmission).where(BadgeSubmission.user_id == user.id)))
    pending = db.scalar(select(func.count()).select_from(Appeal).where(Appeal.status == "pending")) or 0
    recent = []
    if user.role != "guest":
        recent = [services.tx_out(t, user) for t in db.scalars(
            select(Transaction).where(or_(Transaction.actor_id == user.id, Transaction.target_id == user.id))
            .order_by(Transaction.created_at.desc()).limit(5))]
    return schemas.DashboardOut(
        user=user_out(user),
        goals_active=sum(g.progress < 100 for g in goals),
        goals_done=sum(g.progress == 100 for g in goals),
        badges_earned=sum(s.status == "earned" for s in subs),
        badges_in_review=sum(s.status == "in_review" for s in subs),
        pending_appeals=pending if user.role != "guest" else 0,
        recent_transactions=recent,
    )


@router.get("/people", response_model=list[schemas.MemberBalance])
def fellow_travelers(db: Session = Depends(get_db), _: User = Depends(any_role)):
    """Learners and guides of the studio (no guests)."""
    rows = db.scalars(select(User).where(User.role.in_(("user", "admin")), User.is_active.is_(True))
                      .order_by(User.role.desc(), User.display_name))
    return [schemas.MemberBalance.model_validate(u) for u in rows]


@router.get("/portfolio/{user_id}", response_model=schemas.PortfolioOut)
def portfolio(user_id: int, db: Session = Depends(get_db), _: User = Depends(any_role)):
    """Hero Portfolio: a learner's earned badges and reflections. Public within the school."""
    u = db.get(User, user_id)
    if u is None or u.role != "user":
        raise HTTPException(404, "Learner not found")
    earned = db.scalars(select(BadgeSubmission).where(BadgeSubmission.user_id == user_id,
                                                      BadgeSubmission.status == "earned")
                        .order_by(BadgeSubmission.reviewed_at.desc()))
    return schemas.PortfolioOut(user=schemas.MemberBalance.model_validate(u), xp=u.xp, level=u.level,
                                earned=[submission_out(s) for s in earned])
