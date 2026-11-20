"""Application settings, read from environment variables (12-factor style).

Every setting has a safe POC default so the app runs with zero configuration on
a developer laptop. In production, set them in the systemd unit / docker-compose
`.env` file instead of editing this file.
"""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # .../backend


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _dev_secret() -> str:
    """POC convenience: generate a random key once and keep it in backend/.jwt_secret
    so `uvicorn --reload` restarts don't log everyone out. Production sets JWT_SECRET."""
    f = BASE_DIR / ".jwt_secret"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(48))
    return f.read_text().strip()


class Settings:
    # SQLite for the POC. For production use e.g.
    #   postgresql+psycopg://journey:secret@db:5432/journey
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'journey.db'}")

    # JWT signing key. MUST be set to a long random value in production,
    # otherwise every restart invalidates all sessions.
    JWT_SECRET: str = os.getenv("JWT_SECRET") or _dev_secret()
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "120"))

    # "Continue as guest" button on the login page.
    GUEST_LOGIN_ENABLED: bool = _bool("GUEST_LOGIN_ENABLED", True)

    # Open question from the Gemini chats: the last iteration made the Appeal
    # button visible only when the learner is on the Council. The earlier, clearer
    # rule is "only the person whose bucks were taken can appeal". Default = the
    # clear rule; set to true to also require Council membership.
    APPEALS_REQUIRE_COUNCIL: bool = _bool("APPEALS_REQUIRE_COUNCIL", False)

    # Load demo data (Alex, Maya, Liam...) on first start when the DB is empty.
    SEED_DEMO_DATA: bool = _bool("SEED_DEMO_DATA", True)

    # Comma-separated list of origins allowed to call the API (Vite dev server).
    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
    ]

    # If the React app has been built (npm run build), FastAPI serves it too, so
    # the whole POC runs as one process on http://localhost:8000.
    FRONTEND_DIST: Path = Path(os.getenv("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist")))


settings = Settings()
