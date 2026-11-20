"""SQLAlchemy ORM models = the database schema.

Roles
-----
admin  -> Guides / school staff. Manage users, Council, badges, time slots,
          review badge evidence, resolve appeals. Not listed in Studio Balances.
user   -> Learners ("Heroes"). Goals, badges, Revel Bucks, appeals.
          `is_council` is a flag on a learner, granted by an admin.
guest  -> Read-only visitors (parents, judges). Badge catalog, showcase, balances.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


ROLES = ("admin", "user", "guest")


class Studio(Base):
    __tablename__ = "studios"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(80))
    avatar: Mapped[str] = mapped_column(String(16), default="🙂")
    role: Mapped[str] = mapped_column(String(10), default="user")
    is_council: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    studio_id: Mapped[int | None] = mapped_column(ForeignKey("studios.id"))
    balance: Mapped[int] = mapped_column(Integer, default=0)       # Revel Bucks
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    top_skill: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    studio: Mapped[Studio | None] = relationship()

    @property
    def level(self) -> int:
        return self.xp // 1000 + 1


class Transaction(Base):
    """One Revel Bucks ledger entry. Rows are never deleted or edited except
    for the `is_reversed` flag set by an approved appeal."""
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)   # who made it
    target_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)  # who it was given to / taken from
    type: Mapped[str] = mapped_column(String(4))  # 'give' | 'take'
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    # Exact balance changes applied, so a reversal is the precise inverse even
    # when Guides mint/burn bucks instead of moving them.
    actor_delta: Mapped[int] = mapped_column(Integer, default=0)
    target_delta: Mapped[int] = mapped_column(Integer, default=0)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    actor: Mapped[User] = relationship(foreign_keys=[actor_id])
    target: Mapped[User] = relationship(foreign_keys=[target_id])
    appeal: Mapped["Appeal | None"] = relationship(back_populates="transaction", uselist=False)


class TimeSlot(Base):
    """Appeal hearing slot. A slot is 'available' when no *pending* appeal uses
    it, so it disappears when booked and comes back automatically on resolve."""
    __tablename__ = "time_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(80), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Appeal(Base):
    __tablename__ = "appeals"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), unique=True)  # one appeal per tx
    appellant_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    time_slot_id: Mapped[int] = mapped_column(ForeignKey("time_slots.id"))
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)  # pending|approved|denied
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    transaction: Mapped[Transaction] = relationship(back_populates="appeal")
    appellant: Mapped[User] = relationship(foreign_keys=[appellant_id])
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])
    time_slot: Mapped[TimeSlot] = relationship()


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), default="Core Skills")
    period: Mapped[str] = mapped_column(String(10), default="weekly")  # daily|weekly|session
    target_date: Mapped[str | None] = mapped_column(String(10))  # ISO date
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan", order_by="Milestone.id"
    )

    @property
    def progress(self) -> int:
        if not self.milestones:
            return 0
        return round(100 * sum(m.completed for m in self.milestones) / len(self.milestones))


class Milestone(Base):
    __tablename__ = "milestones"
    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    goal: Mapped[Goal] = relationship(back_populates="milestones")


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120), unique=True)
    category: Mapped[str] = mapped_column(String(40))  # Quest Badges, Core Skills, Deep Books, Civilization, Life Skills
    icon: Mapped[str] = mapped_column(String(16), default="🏅")
    xp: Mapped[int] = mapped_column(Integer, default=100)
    description: Mapped[str] = mapped_column(Text)
    skills: Mapped[str] = mapped_column(Text, default="[]")    # JSON list[str]
    criteria: Mapped[str] = mapped_column(Text, default="[]")  # JSON list[str]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BadgeSubmission(Base):
    """A learner's evidence for a badge. status: in_review -> earned | rejected."""
    __tablename__ = "badge_submissions"
    __table_args__ = (UniqueConstraint("badge_id", "user_id", name="uq_badge_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    reflection: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="in_review")
    feedback: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    badge: Mapped[Badge] = relationship()
    user: Mapped[User] = relationship(foreign_keys=[user_id])
