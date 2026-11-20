# Revel Journey Tracker — POC

Goal setting, badges, Hero portfolios and the Revel Bucks economy for Revel Academy learners.
Replacement for Acton Academy's Journey Tracker, built from the learner's Gemini design chats.

- **Requirements & architecture:** [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md)
- **Stack:** FastAPI (Python) · SQLite (POC) / PostgreSQL (prod) · React 19 + Vite + Tailwind · JWT auth with roles `admin` / `user` / `guest`
- **Target server:** Linux (Ubuntu 24.04) with Docker Compose + Nginx
- **Repository:** https://github.com/amaksyuta/journey-tracker

---

## 1. Prerequisites

| Tool | Windows | macOS |
|---|---|---|
| Git | [Git for Windows](https://git-scm.com/download/win) (includes Git Bash + Git Credential Manager) | `xcode-select --install` or `brew install git` |
| Python 3.10+ | [python.org](https://www.python.org/downloads/) or `winget install Python.Python.3.12` | `brew install python@3.12` |
| Node.js 20+ | `winget install OpenJS.NodeJS.LTS` | `brew install node` |

Node.js is only needed to **build or edit the UI**. `frontend/dist` (the built UI) is not stored in Git, so on a
fresh clone you need Node.js once to run `setup`. After that, the app runs on Python alone.

macOS without Homebrew: install it from https://brew.sh first.

---

## 2. Get the code and set up Git access

Git identity and credentials below are set **per repository** (`git config` without `--global`), so they don't
affect your other projects.

### 2.1 Clone

```bash
# Windows (Git Bash)
cd /c/Projects
# macOS (Terminal)
mkdir -p ~/Projects && cd ~/Projects

git clone https://github.com/amaksyuta/journey-tracker.git
cd journey-tracker
```

The repo is public, so cloning needs no login. **Pushing** does, see 2.3.

### 2.2 Commit identity (use the GitHub "noreply" email)

GitHub blocks pushes that would publish a private email (`GH007: Your push would publish a private email address`).
Use your noreply address from https://github.com/settings/emails → *Keep my email addresses private*
(format `<id>+<username>@users.noreply.github.com`):

```bash
git config user.name  "Your Name"
git config user.email "12345678+amaksyuta@users.noreply.github.com"   # copy yours from the settings page
```

### 2.3 Credentials

**Recommended on both systems: Git Credential Manager (GCM).** It signs in through the browser (OAuth, no token
to copy) and keeps the login in the OS secure store (Windows Credential Manager / macOS Keychain).

| | Windows (Git Bash) | macOS |
|---|---|---|
| Install GCM | Included with Git for Windows | `brew install --cask git-credential-manager` |
| Check | `git credential-manager --version` | `git credential-manager --version` |

Then, inside the repo:

```bash
git config credential.helper manager
git config credential.https://github.com.username amaksyuta
```

On the first `git push`, a GitHub sign-in window opens. Choose **Sign in with your browser**, approve it, and
you're done. Later pushes don't ask again.

**macOS alternative without GCM: Keychain + personal access token**

1. GitHub → Settings → Developer settings → *Personal access tokens* → *Fine-grained tokens* → **Generate new token**.
   Repository access: *Only select repositories* → `journey-tracker`. Permissions: **Contents: Read and write**. Set an expiry.
2. In the repo:
   ```bash
   git config credential.helper osxkeychain
   git config credential.https://github.com.username amaksyuta
   ```
3. On the first `git push`, enter the **token** when asked for the password. Keychain stores it.

### 2.4 Check the setup

```bash
git config --local --list | grep -E "^user\.|credential"
git remote -v                     # origin  https://github.com/amaksyuta/journey-tracker.git
```

### 2.5 Everyday workflow

```bash
git pull                          # get the latest changes
git checkout -b feature/my-change # optional: work on a branch
git add .
git status                        # make sure .venv, journey.db*, .jwt_secret are NOT listed
git commit -m "Describe the change"
git push -u origin HEAD
```

### 2.6 Troubleshooting

| Problem | Fix |
|---|---|
| `GH007 ... private email address` | Set the noreply email (2.2), then `git commit --amend --no-edit --reset-author` and push again. For older commits ask before rewriting history. |
| Wrong account remembered (Windows) | Control Panel → Credential Manager → Windows Credentials → remove `git:https://github.com`, push again. |
| Wrong account remembered (macOS) | Keychain Access → search `github.com` → delete the entry, push again. |
| `credential-manager is not a git command` | Update Git for Windows, or on macOS `brew install --cask git-credential-manager`. |
| `\r: command not found` running a `.sh` script | The file has Windows line endings. `.gitattributes` prevents this. Fix existing copies with `git rm --cached -r . && git reset --hard`. |

---

## 3. Run the app

### Windows (PowerShell)

```powershell
cd C:\Projects\journey-tracker
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1   # once: venv, pip, npm build
powershell -ExecutionPolicy Bypass -File scripts\run.ps1     # opens http://localhost:8000
powershell -ExecutionPolicy Bypass -File scripts\run.ps1 -Dev  # hot reload: API :8000 + UI :5173
```

### macOS (Terminal)

```bash
cd ~/Projects/journey-tracker
bash scripts/setup.sh            # once: venv, pip, npm build
bash scripts/run.sh              # opens http://localhost:8000 (Ctrl+C to stop)
bash scripts/run.sh --dev        # hot reload: API :8000 + UI :5173 (Ctrl+C stops both)
```

The same `.sh` scripts also work on Linux.

### Manual equivalent (any OS)

```bash
cd backend
python3 -m venv .venv                          # Windows: python -m venv .venv
.venv/bin/pip install -r requirements.txt      # Windows: .venv\Scripts\pip ...
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
# second terminal
cd frontend && npm install && npm run dev      # http://localhost:5173
```

API docs (Swagger): http://localhost:8000/api/docs

### Demo accounts

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

Reset the demo data: stop the server and delete `backend/journey.db*`.

---

## 4. Tests

```bash
cd backend
.venv/bin/python -m pytest -q          # Windows: .venv\Scripts\python -m pytest -q
```

## 5. Deploy on Linux

```bash
cp .env.example .env   # set JWT_SECRET; SEED_DEMO_DATA=false for real use
docker compose up -d --build
```

See section 10 of the requirements doc for TLS, backups and monitoring.

## 6. Layout

```
backend/app/        FastAPI app: routers/ (HTTP), services.py (business rules), models.py (DB), deps.py (RBAC)
backend/tests/      pytest business-rule tests
frontend/src/       React SPA: pages/, components/ui.jsx, api.js, auth.jsx
deploy/nginx/       Reverse proxy config
docs/               Technical requirements & architecture
scripts/            setup/run scripts: *.ps1 (Windows), *.sh (macOS/Linux)
```
