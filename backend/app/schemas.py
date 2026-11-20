"""Pydantic request/response models = the JSON contract between frontend and backend.
FastAPI publishes them as OpenAPI at /api/docs."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["admin", "user", "guest"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / users ----------
class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


class UserBrief(ORM):
    id: int
    display_name: str
    avatar: str
    role: Role
    is_council: bool


class UserOut(UserBrief):
    username: str
    is_active: bool
    studio: str | None = None
    balance: int
    xp: int
    level: int
    streak: int
    top_skill: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MemberBalance(UserBrief):
    balance: int
    top_skill: str | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=200)
    display_name: str = Field(min_length=1, max_length=80)
    avatar: str = Field(default="🙂", max_length=16)
    role: Role = "user"
    is_council: bool = False
    balance: int = Field(default=0, ge=0)
    top_skill: str | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    avatar: str | None = Field(default=None, max_length=16)
    role: Role | None = None
    is_council: bool | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    top_skill: str | None = None


# ---------- Revel Bucks ----------
class TransactionCreate(BaseModel):
    target_id: int
    type: Literal["give", "take"]
    amount: int = Field(gt=0, le=500)
    reason: str = Field(min_length=3, max_length=1000)


class AppealBrief(ORM):
    id: int
    status: str
    reason: str
    time_slot: str
    submitted_at: datetime
    resolved_at: datetime | None = None
    resolved_by: str | None = None


class TransactionOut(BaseModel):
    id: int
    type: str
    amount: int
    reason: str
    created_at: datetime
    is_reversed: bool
    actor: UserBrief
    target: UserBrief
    appeal: AppealBrief | None = None
    can_appeal: bool = False  # computed for the current viewer


class TimeSlotOut(ORM):
    id: int
    label: str
    is_active: bool = True
    is_booked: bool = False


class TimeSlotCreate(BaseModel):
    label: str = Field(min_length=3, max_length=80)


class AppealCreate(BaseModel):
    transaction_id: int
    reason: str = Field(min_length=5, max_length=2000)
    time_slot_id: int


class AppealResolve(BaseModel):
    decision: Literal["approve", "deny"]


class AppealOut(BaseModel):
    id: int
    status: str
    reason: str
    time_slot: str
    submitted_at: datetime
    resolved_at: datetime | None
    appellant: UserBrief
    initiator: UserBrief
    transaction: TransactionOut
    can_resolve: bool = False


# ---------- Goals ----------
class MilestoneOut(ORM):
    id: int
    title: str
    completed: bool


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category: str = "Core Skills"
    period: Literal["daily", "weekly", "session"] = "weekly"
    target_date: str | None = None
    milestones: list[str] = []


class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    period: Literal["daily", "weekly", "session"] | None = None
    target_date: str | None = None


class GoalOut(ORM):
    id: int
    title: str
    description: str | None
    category: str
    period: str
    target_date: str | None
    progress: int
    milestones: list[MilestoneOut]
    created_at: datetime


# ---------- Badges ----------
class BadgeIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    category: str
    icon: str = "🏅"
    xp: int = Field(default=100, ge=0, le=5000)
    description: str
    skills: list[str] = []
    criteria: list[str] = []


class BadgeOut(BaseModel):
    id: int
    title: str
    category: str
    icon: str
    xp: int
    description: str
    skills: list[str]
    criteria: list[str]
    my_status: str | None = None  # None | in_review | earned | rejected
    my_feedback: str | None = None
    earned_count: int = 0


class SubmissionCreate(BaseModel):
    evidence_url: str | None = Field(default=None, max_length=500)
    reflection: str = Field(min_length=3, max_length=3000)


class SubmissionReview(BaseModel):
    decision: Literal["approve", "reject"]
    feedback: str | None = None


class SubmissionOut(BaseModel):
    id: int
    status: str
    evidence_url: str | None
    reflection: str | None
    feedback: str | None
    submitted_at: datetime
    reviewed_at: datetime | None
    badge: BadgeOut
    user: UserBrief


# ---------- Dashboard / portfolio ----------
class PortfolioOut(BaseModel):
    user: MemberBalance
    xp: int
    level: int
    earned: list[SubmissionOut]


class DashboardOut(BaseModel):
    user: UserOut
    goals_active: int
    goals_done: int
    badges_earned: int
    badges_in_review: int
    pending_appeals: int
    recent_transactions: list[TransactionOut]
