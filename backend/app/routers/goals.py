"""Weekly Tracking: a learner's own goals and milestones. Only the owner sees/edits them."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import learner
from ..models import Goal, Milestone, User

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _own_goal(db: Session, goal_id: int, user: User) -> Goal:
    g = db.get(Goal, goal_id)
    if g is None or g.owner_id != user.id:
        raise HTTPException(404, "Goal not found")
    return g


@router.get("", response_model=list[schemas.GoalOut])
def my_goals(db: Session = Depends(get_db), user: User = Depends(learner)):
    return list(db.scalars(select(Goal).where(Goal.owner_id == user.id).order_by(Goal.created_at.desc())))


@router.post("", response_model=schemas.GoalOut, status_code=201)
def create_goal(data: schemas.GoalCreate, db: Session = Depends(get_db), user: User = Depends(learner)):
    g = Goal(owner_id=user.id, **data.model_dump(exclude={"milestones"}))
    g.milestones = [Milestone(title=t.strip()) for t in data.milestones if t.strip()]
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.patch("/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, data: schemas.GoalUpdate, db: Session = Depends(get_db),
                user: User = Depends(learner)):
    g = _own_goal(db, goal_id, user)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    db.commit()
    return g


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db), user: User = Depends(learner)):
    db.delete(_own_goal(db, goal_id, user))
    db.commit()


@router.post("/{goal_id}/milestones", response_model=schemas.GoalOut, status_code=201)
def add_milestone(goal_id: int, data: schemas.MilestoneCreate, db: Session = Depends(get_db),
                  user: User = Depends(learner)):
    g = _own_goal(db, goal_id, user)
    g.milestones.append(Milestone(title=data.title.strip()))
    db.commit()
    db.refresh(g)
    return g


@router.post("/{goal_id}/milestones/{milestone_id}/toggle", response_model=schemas.GoalOut)
def toggle_milestone(goal_id: int, milestone_id: int, db: Session = Depends(get_db),
                     user: User = Depends(learner)):
    g = _own_goal(db, goal_id, user)
    m = next((m for m in g.milestones if m.id == milestone_id), None)
    if m is None:
        raise HTTPException(404, "Milestone not found")
    was_done = g.progress == 100
    m.completed = not m.completed
    db.flush()
    if not was_done and g.progress == 100:
        user.xp += 50  # celebrate the milestone: completing a goal grants XP
    elif was_done and g.progress < 100:
        user.xp = max(0, user.xp - 50)
    db.commit()
    db.refresh(g)
    return g
