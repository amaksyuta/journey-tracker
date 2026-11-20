"""Badge catalog, evidence submission (learner) and review (guide)."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import admin_only, any_role, learner
from ..models import Badge, BadgeSubmission, User, utcnow
from ..services import brief

router = APIRouter(prefix="/api/badges", tags=["badges"])


def badge_out(b: Badge, sub: BadgeSubmission | None = None, earned_count: int = 0) -> schemas.BadgeOut:
    return schemas.BadgeOut(
        id=b.id, title=b.title, category=b.category, icon=b.icon, xp=b.xp, description=b.description,
        skills=json.loads(b.skills or "[]"), criteria=json.loads(b.criteria or "[]"),
        my_status=sub.status if sub else None, my_feedback=sub.feedback if sub else None,
        earned_count=earned_count,
    )


def submission_out(s: BadgeSubmission) -> schemas.SubmissionOut:
    return schemas.SubmissionOut(
        id=s.id, status=s.status, evidence_url=s.evidence_url, reflection=s.reflection,
        feedback=s.feedback, submitted_at=s.submitted_at, reviewed_at=s.reviewed_at,
        badge=badge_out(s.badge), user=brief(s.user),
    )


@router.get("", response_model=list[schemas.BadgeOut])
def catalog(db: Session = Depends(get_db), viewer: User = Depends(any_role)):
    counts = dict(db.execute(select(BadgeSubmission.badge_id, func.count())
                             .where(BadgeSubmission.status == "earned").group_by(BadgeSubmission.badge_id)).all())
    mine = {s.badge_id: s for s in db.scalars(select(BadgeSubmission).where(BadgeSubmission.user_id == viewer.id))}
    badges = db.scalars(select(Badge).where(Badge.is_active.is_(True)).order_by(Badge.category, Badge.title))
    return [badge_out(b, mine.get(b.id), counts.get(b.id, 0)) for b in badges]


@router.post("", response_model=schemas.BadgeOut, status_code=201)
def create_badge(data: schemas.BadgeIn, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    b = Badge(**data.model_dump(exclude={"skills", "criteria"}),
              skills=json.dumps(data.skills), criteria=json.dumps(data.criteria))
    db.add(b)
    db.commit()
    return badge_out(b)


@router.post("/{badge_id}/submissions", response_model=schemas.SubmissionOut, status_code=201)
def submit_evidence(badge_id: int, data: schemas.SubmissionCreate, db: Session = Depends(get_db),
                    user: User = Depends(learner)):
    b = db.get(Badge, badge_id)
    if b is None or not b.is_active:
        raise HTTPException(404, "Badge not found")
    sub = db.scalar(select(BadgeSubmission).where(BadgeSubmission.badge_id == badge_id,
                                                  BadgeSubmission.user_id == user.id))
    if sub and sub.status in ("in_review", "earned"):
        raise HTTPException(400, f"You already {'earned' if sub.status == 'earned' else 'submitted'} this badge")
    if sub is None:
        sub = BadgeSubmission(badge_id=badge_id, user_id=user.id)
        db.add(sub)
    sub.evidence_url, sub.reflection = data.evidence_url, data.reflection
    sub.status, sub.feedback, sub.submitted_at, sub.reviewed_at = "in_review", None, utcnow(), None
    db.commit()
    db.refresh(sub)
    return submission_out(sub)


@router.get("/submissions", response_model=list[schemas.SubmissionOut])
def review_queue(status: Literal["in_review", "earned", "rejected", "all"] = "in_review",
                 db: Session = Depends(get_db), _: User = Depends(admin_only)):
    q = select(BadgeSubmission).order_by(BadgeSubmission.submitted_at)
    if status != "all":
        q = q.where(BadgeSubmission.status == status)
    return [submission_out(s) for s in db.scalars(q)]


@router.post("/submissions/{sub_id}/review", response_model=schemas.SubmissionOut)
def review(sub_id: int, data: schemas.SubmissionReview, db: Session = Depends(get_db),
           guide: User = Depends(admin_only)):
    s = db.get(BadgeSubmission, sub_id)
    if s is None:
        raise HTTPException(404, "Submission not found")
    if s.status != "in_review":
        raise HTTPException(400, "Submission was already reviewed")
    s.status = "earned" if data.decision == "approve" else "rejected"
    s.feedback, s.reviewed_at, s.reviewed_by_id = data.feedback, utcnow(), guide.id
    if s.status == "earned":
        s.user.xp += s.badge.xp
    db.commit()
    return submission_out(s)
