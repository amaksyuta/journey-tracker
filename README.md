# Revel Journey Tracker — POC

Goal setting, badges, Hero portfolios and the Revel Bucks economy for Revel Academy learners.
Replacement for Acton Academy's Journey Tracker, built from the learner's Gemini design chats.

- **Requirements & architecture:** [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md)
- **Stack:** FastAPI (Python) · SQLite (POC) / PostgreSQL (prod) · React 19 + Vite + Tailwind · JWT auth with roles `admin` / `user` / `guest`
- **Target server:** Linux (Ubuntu 24.04) with Docker Compose + Nginx

## Run it on Windows

Prerequisites: Python 3.10+ and Node.js 20+ on PATH.

```powershell
cd C:\Projects\journey-tracker
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1   # once: venv, pip, npm, build
powershell -ExecutionPolicy Bypass -File scripts\run.ps1     # opens http://localhost:8000
```

Hot-reload mode for development (API on :8000, UI on :5173):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run.ps1 -Dev
```

Manual equivalent:

```powershell
cd backend;  python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
# second terminal
cd frontend; npm install; npm run dev
```

API docs (Swagger): http://localhost:8000/api/docs

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `alex` | `revel123` | Learner, Council member |
| `liam` | `revel123` | Learner, Council member |
| `maya`, `sophia`, `jackson` | `revel123` | Learner |
| `sarah` | `guide123` | Guide (admin) |
| `admin` | `admin123` | Admin |
| "Continue as guest" | — | Guest (read-only) |

Try this: sign in as **alex** → Revel Bucks → open "Liam Chen took from Alex Rivera" → **Appeal**, pick a hearing time.
Sign in as **liam**: no Appeal button on that transaction, and he can't decide it (he's a party).
Sign in as **sarah** → Appeals → **Approve** → the transaction fades, balances reverse, the time slot returns.

Reset the demo data: stop the server and delete `backend\journey.db*`.

## Tests

```powershell
cd backend; .venv\Scripts\python -m pytest -q
```

## Deploy on Linux

```bash
cp .env.example .env   # set JWT_SECRET; SEED_DEMO_DATA=false for real use
docker compose up -d --build
```

See section 10 of the requirements doc for TLS, backups and monitoring.

## Layout

```
backend/app/        FastAPI app: routers/ (HTTP), services.py (business rules), models.py (DB), deps.py (RBAC)
backend/tests/      pytest business-rule tests
frontend/src/       React SPA: pages/, components/ui.jsx, api.js, auth.jsx
deploy/nginx/       Reverse proxy config
docs/               Technical requirements & architecture
scripts/            Windows setup/run scripts
```
