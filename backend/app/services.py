"""Business rules for Revel Bucks and appeals, kept out of the HTTP layer so
they can be unit-tested and reused.

Rules (from the Gemini chats, see docs/TECHNICAL_REQUIREMENTS.md section 4):
 R1  Anyone signed in (learner or guide) can give or take bucks; guests cannot.
 R2  You cannot transact with yourself or with a guide/guest account.
 R3  Learner GIVE moves bucks from the giver to the target (giver needs balance).
     Learner TAKE moves bucks from the target to the taker.
     Guides mint (give) or remove (take) bucks - their own balance never changes.
 R4  A target can never go below 0 bucks through a TAKE.
 R5  GIVE transactions can never be appealed.
 R6  A TAKE can be appealed ONLY by the person it was taken from (the target),
     once, while not reversed. (Optional: also require Council membership.)
 R7  Filing an appeal books a hearing time slot; booked slots disappear from
     the list; the slot returns when the appeal is approved or denied.
 R8  Council members and guides resolve appeals. A Council member can't resolve
     an appeal they are a party to (appellant or initiator).
 R9  Approve -> the transaction is reversed (exact inverse of its deltas) and
     shown faded/struck-through. Deny -> the transaction stands.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import schemas
from .config import settings
from .deps import can_resolve_appeals
from .models import Appeal, TimeSlot, Transaction, User, utcnow


def bad(msg: str, code: int = 400):
    raise HTTPException(code, msg)


# ---------- helpers: serialization ----------
def brief(u: User) -> schemas.UserBrief:
    return schemas.UserBrief.model_validate(u)


def appeal_brief(a: Appeal | None) -> schemas.AppealBrief | None:
    if a is None:
        return None
    return schemas.AppealBrief(
        id=a.id, status=a.status, reason=a.reason, time_slot=a.time_slot.label,
        submitted_at=a.submitted_at, resolved_at=a.resolved_at,
        resolved_by=a.resolved_by.display_name if a.resolved_by else None,
    )


def can_appeal(tx: Transaction, viewer: User) -> bool:
    if viewer.role != "user":
        return False
    if settings.APPEALS_REQUIRE_COUNCIL and not viewer.is_council:
        return False
    return (
        tx.type == "take"
        and tx.target_id == viewer.id
        and tx.actor_id != viewer.id
        and not tx.is_reversed
        and tx.appeal is None
    )


def tx_out(tx: Transaction, viewer: User) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=tx.id, type=tx.type, amount=tx.amount, reason=tx.reason,
        created_at=tx.created_at, is_reversed=tx.is_reversed,
        actor=brief(tx.actor), target=brief(tx.target),
        appeal=appeal_brief(tx.appeal), can_appeal=can_appeal(tx, viewer),
    )


def can_resolve(appeal: Appeal, viewer: User) -> bool:
    if appeal.status != "pending" or not can_resolve_appeals(viewer):
        return False
    if viewer.role == "admin":
        return True
    return viewer.id not in (appeal.appellant_id, appeal.transaction.actor_id)


def appeal_out(a: Appeal, viewer: User) -> schemas.AppealOut:
    return schemas.AppealOut(
        id=a.id, status=a.status, reason=a.reason, time_slot=a.time_slot.label,
        submitted_at=a.submitted_at, resolved_at=a.resolved_at,
        appellant=brief(a.appellant), initiator=brief(a.transaction.actor),
        transaction=tx_out(a.transaction, viewer), can_resolve=can_resolve(a, viewer),
    )


# ---------- commands ----------
def create_transaction(db: Session, actor: User, data: schemas.TransactionCreate) -> Transaction:
    target = db.get(User, data.target_id)
    if target is None or not target.is_active:
        bad("Person not found", 404)
    if target.id == actor.id:
        bad("You can't give or take Revel Bucks from yourself")
    if target.role != "user":
        bad("Revel Bucks can only be given to or taken from learners")

    is_guide = actor.role == "admin"
    if data.type == "give":
        if not is_guide and actor.balance < data.amount:
            bad(f"Not enough Revel Bucks - you have {actor.balance}")
        actor_delta, target_delta = (0 if is_guide else -data.amount), data.amount
    else:  # take
        if target.balance < data.amount:
            bad(f"{target.display_name} only has {target.balance} Revel Bucks")
        actor_delta, target_delta = (0 if is_guide else data.amount), -data.amount

    actor.balance += actor_delta
    target.balance += target_delta
    tx = Transaction(
        actor_id=actor.id, target_id=target.id, type=data.type, amount=data.amount,
        reason=data.reason.strip(), actor_delta=actor_delta, target_delta=target_delta,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def available_slots(db: Session) -> list[TimeSlot]:
    booked = select(Appeal.time_slot_id).where(Appeal.status == "pending")
    return list(db.scalars(
        select(TimeSlot).where(TimeSlot.is_active.is_(True), TimeSlot.id.not_in(booked)).order_by(TimeSlot.id)
    ))


def file_appeal(db: Session, user: User, data: schemas.AppealCreate) -> Appeal:
    tx = db.get(Transaction, data.transaction_id)
    if tx is None:
        bad("Transaction not found", 404)
    if tx.type != "take":
        bad("Only transactions where Revel Bucks were TAKEN can be appealed")
    if tx.target_id != user.id:
        bad(f"Only {tx.target.display_name} (whose bucks were taken) can appeal this", 403)
    if settings.APPEALS_REQUIRE_COUNCIL and not user.is_council:
        bad("Appeals are restricted to Council members", 403)
    if tx.appeal is not None:
        bad("This transaction has already been appealed")
    if tx.is_reversed:
        bad("This transaction was already reversed")
    if data.time_slot_id not in {s.id for s in available_slots(db)}:
        bad("That hearing time slot is no longer available - please pick another")

    appeal = Appeal(transaction_id=tx.id, appellant_id=user.id, reason=data.reason.strip(),
                    time_slot_id=data.time_slot_id)
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return appeal


def resolve_appeal(db: Session, user: User, appeal_id: int, decision: str) -> Appeal:
    appeal = db.get(Appeal, appeal_id)
    if appeal is None:
        bad("Appeal not found", 404)
    if appeal.status != "pending":
        bad(f"This appeal was already {appeal.status}")
    if not can_resolve_appeals(user):
        bad("Only Council members and Guides can resolve appeals", 403)
    if not can_resolve(appeal, user):
        bad("You are part of this appeal, so another Council member or a Guide must decide it", 403)

    if decision == "approve":
        tx = appeal.transaction
        tx.actor.balance -= tx.actor_delta     # may go negative if the taker already spent it
        tx.target.balance -= tx.target_delta
        tx.is_reversed = True
        appeal.status = "approved"
    else:
        appeal.status = "denied"
    appeal.resolved_at = utcnow()
    appeal.resolved_by_id = user.id
    db.commit()  # slot becomes available again automatically (status != pending)
    db.refresh(appeal)
    return appeal
