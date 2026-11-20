"""Revel Journey Tracker - FastAPI application entry point.

Run (dev):   uvicorn app.main:app --reload --port 8000     (from the backend/ folder)
API docs:    http://localhost:8000/api/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import admin, auth, badges, bucks, goals, people
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    # POC: create tables directly. Production: Alembic migrations (see docs).
    Base.metadata.create_all(engine)
    if settings.SEED_DEMO_DATA:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(
    title="Revel Journey Tracker API",
    version="0.1.0-poc",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth.router, bucks.router, goals.router, badges.router, people.router, admin.router):
    app.include_router(r)


@app.get("/api/health", tags=["ops"])
def health():
    return {"status": "ok"}


# Serve the built React app (frontend/dist) when present, with SPA fallback.
dist = settings.FRONTEND_DIST
if (dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = dist / path
        if path and f.is_file() and dist in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html")
