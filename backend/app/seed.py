"""Demo data based on the Gemini prototype (Alex, Maya, Liam, Sophia, Jackson,
Guide Sarah). Runs once, only when the users table is empty.

Demo accounts (change or disable before any real use!):
    admin    / admin123    - school admin (Guide role)
    sarah    / guide123    - Guide Sarah (admin role)
    alex     / revel123    - learner, Council member
    maya     / revel123    - learner
    liam     / revel123    - learner, Council member
    sophia   / revel123    - learner
    jackson  / revel123    - learner
    guest    / (button)    - read-only visitor
"""
import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import schemas, services
from .models import Badge, BadgeSubmission, Goal, Milestone, Studio, TimeSlot, Transaction, User, utcnow
from .security import hash_password

SLOTS = [
    "Morning Launch (8:30 AM - 9:00 AM)",
    "Socratic Discussion (10:30 AM - 11:00 AM)",
    "Studio Council (1:00 PM - 1:30 PM)",
    "Afternoon Check-out (3:30 PM - 4:00 PM)",
]

BADGES = [
    ("Python Mastery & Algorithms", "Core Skills", "💻", 500,
     "Demonstrate proficiency in building custom Python applications and solving algorithmic challenges.",
     ["Python", "Data Structures", "Debugging", "Logic"],
     ["Complete 15 Python exercises.", "Build a functional CLI app or web scraper.",
      "Conduct a code review session with a peer or Guide."]),
    ("Socratic Dialogue Leader", "Life Skills", "🏛️", 400,
     "Lead respectful, deep studio debates, ask probing questions, and synthesize peer points without bias.",
     ["Active Listening", "Critical Thinking", "Socratic Questioning"],
     ["Facilitate 3 morning Socratic launches.", "Formulate 5 open-ended questions challenging assumptions.",
      "Write a synthesis capturing opposing peer perspectives."]),
    ("UI/UX Design Quest", "Quest Badges", "🎨", 450,
     "Apply human-centered design to solve real studio needs through interactive prototypes.",
     ["Figma", "User Research", "Prototyping", "Usability Testing"],
     ["Create interactive wireframes in Figma.", "Interview 4 studio peers about usability.",
      "Iterate on the design based on feedback."]),
    ("Deep Books Explorer", "Deep Books", "📚", 300,
     "Read a classic deeply and connect its big ideas to your own Hero's Journey.",
     ["Reading", "Analysis", "Writing"],
     ["Read one book from the Deep Books list.", "Keep a reading journal with 10 entries.",
      "Present the book's big idea to the studio."]),
    ("Ancient Civilizations", "Civilization", "🏺", 350,
     "Explore how an ancient civilization rose and fell and what we can learn from it today.",
     ["History", "Research", "Cause & Effect"],
     ["Build a timeline of 10 key events.", "Compare two civilizations in a short essay.",
      "Lead a 10-minute studio discussion."]),
    ("Public Speaking", "Life Skills", "🎤", 250,
     "Speak clearly and confidently in front of the studio and guests.",
     ["Communication", "Confidence", "Storytelling"],
     ["Give 3 presentations of at least 3 minutes.", "Collect peer feedback after each one.",
      "Record and self-review one talk."]),
]


def seed(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is not None:
        return

    studio = Studio(name="Launchpad")
    db.add(studio)
    db.add_all(TimeSlot(label=s) for s in SLOTS)
    db.flush()

    def mk(username, pw, name, avatar, role="user", council=False, balance=0, xp=0, streak=0, skill=None):
        u = User(username=username, password_hash=hash_password(pw), display_name=name, avatar=avatar,
                 role=role, is_council=council, balance=balance, xp=xp, streak=streak, top_skill=skill,
                 studio_id=studio.id)
        db.add(u)
        return u

    mk("admin", "admin123", "School Admin", "🛡️", role="admin", skill="Platform Admin")
    sarah = mk("sarah", "guide123", "Guide Sarah", "👩‍🏫", role="admin", skill="Studio Lead")
    alex = mk("alex", "revel123", "Alex Rivera", "🦁", council=True, balance=340, xp=3200, streak=12, skill="Design & Code")
    maya = mk("maya", "revel123", "Maya Lin", "🌸", balance=420, xp=2100, streak=15, skill="Figma & UI")
    liam = mk("liam", "revel123", "Liam Chen", "⚡", council=True, balance=310, xp=2600, streak=9, skill="Python Coder")
    sophia = mk("sophia", "revel123", "Sophia Patel", "🎨", balance=580, xp=4100, streak=21, skill="Socratic Leader")
    jackson = mk("jackson", "revel123", "Jackson Reed", "🛠️", balance=240, xp=1500, streak=6, skill="Robotics")
    mk("guest", "guest-not-for-login-" + studio.name, "Guest Visitor", "👀", role="guest")
    db.commit()

    # --- Revel Bucks history (applied through the real business rules) ---
    now = utcnow()
    history = [
        (maya, alex, "give", 25, "Fantastic peer review feedback during the Figma UI/UX workshop!", 16),
        (sarah, alex, "take", 15, "Late arrival to Morning Launch without studio contract notice.", 15),
        (alex, liam, "give", 30, "Pair programming help on the Python recursion algorithm.", 14),
        (sophia, jackson, "take", 20, "Unreturned studio soldering tools after the 3D printing session.", 13),
        (sarah, sophia, "give", 50, "Outstanding leadership in guiding the Socratic Civilization debate.", 12),
        (sophia, maya, "give", 15, "Helped me fix the layout bug in my portfolio page.", 3),
        (liam, alex, "take", 10, "Left the 3D printer running unattended during lunch.", 1),
    ]
    txs = []
    for actor, target, kind, amount, reason, days_ago in history:
        tx = services.create_transaction(
            db, actor, schemas.TransactionCreate(target_id=target.id, type=kind, amount=amount, reason=reason))
        tx.created_at = now - timedelta(days=days_ago, hours=2)
        txs.append(tx)
    db.commit()

    slots = {s.label: s.id for s in db.scalars(select(TimeSlot))}
    # Alex's pending appeal against Guide Sarah's deduction (books "Morning Launch").
    a1 = services.file_appeal(db, alex, schemas.AppealCreate(
        transaction_id=txs[1].id, time_slot_id=slots[SLOTS[0]],
        reason="My bus was delayed by road construction on Main St. I notified the studio chat at 8:15 AM."))
    a1.submitted_at = txs[1].created_at + timedelta(minutes=30)
    # Jackson's appeal, already approved by Guide Sarah -> transaction reversed (faded).
    a2 = services.file_appeal(db, jackson, schemas.AppealCreate(
        transaction_id=txs[3].id, time_slot_id=slots[SLOTS[2]],
        reason="The tools were put back in cabinet B with Guide approval before 4 PM."))
    a2.submitted_at = txs[3].created_at + timedelta(minutes=30)
    db.commit()
    services.resolve_appeal(db, sarah, a2.id, "approve")

    # --- Badges ---
    badges = []
    for title, cat, icon, xp, desc, skills, criteria in BADGES:
        b = Badge(title=title, category=cat, icon=icon, xp=xp, description=desc,
                  skills=json.dumps(skills), criteria=json.dumps(criteria))
        db.add(b)
        badges.append(b)
    db.flush()
    db.add_all([
        BadgeSubmission(badge_id=badges[0].id, user_id=alex.id, status="earned",
                        evidence_url="https://github.com/revel-student/python-milestone",
                        reflection="Debugging recursive functions tested my grit, but finishing my CLI game "
                                   "felt like a true Hero milestone!",
                        submitted_at=now - timedelta(days=40), reviewed_at=now - timedelta(days=38),
                        reviewed_by_id=sarah.id, feedback="Great persistence!"),
        BadgeSubmission(badge_id=badges[1].id, user_id=alex.id, status="earned",
                        evidence_url="https://revel.academy/socratic/alex-r",
                        reflection="Learning to ask questions instead of defending my opinion changed how I "
                                   "approach discussions.",
                        submitted_at=now - timedelta(days=25), reviewed_at=now - timedelta(days=24),
                        reviewed_by_id=sarah.id),
        BadgeSubmission(badge_id=badges[2].id, user_id=alex.id, status="in_review",
                        evidence_url="https://figma.com/@alex-revel-design",
                        reflection="Submitted Figma prototypes and interview synthesis notes.",
                        submitted_at=now - timedelta(days=2)),
        BadgeSubmission(badge_id=badges[1].id, user_id=sophia.id, status="earned",
                        reflection="Led three launches on the Civilization debate.",
                        submitted_at=now - timedelta(days=20), reviewed_at=now - timedelta(days=19),
                        reviewed_by_id=sarah.id),
        BadgeSubmission(badge_id=badges[3].id, user_id=maya.id, status="earned",
                        reflection="Read 'The Hobbit' and mapped Bilbo's journey to my own.",
                        submitted_at=now - timedelta(days=10), reviewed_at=now - timedelta(days=9),
                        reviewed_by_id=sarah.id),
    ])

    # --- Goals ---
    g1 = Goal(owner_id=alex.id, title="Complete UI/UX Design Quest submissions", category="Quest Badges",
              period="session", target_date=(now + timedelta(days=10)).date().isoformat(),
              description="Finalize user testing synthesis and submit proof for the Design Quest badge.")
    g1.milestones = [Milestone(title="Complete Figma UI wireframes", completed=True),
                     Milestone(title="Conduct peer usability interviews", completed=True),
                     Milestone(title="Synthesize feedback notes", completed=True),
                     Milestone(title="Submit proof to Guide Sarah for review")]
    g2 = Goal(owner_id=alex.id, title="Read 40 pages of my Deep Book", category="Deep Books", period="weekly",
              target_date=(now + timedelta(days=4)).date().isoformat())
    g2.milestones = [Milestone(title="Monday - 10 pages", completed=True), Milestone(title="Tuesday - 10 pages"),
                     Milestone(title="Thursday - 10 pages"), Milestone(title="Friday - 10 pages + journal entry")]
    db.add_all([g1, g2])
    db.commit()
