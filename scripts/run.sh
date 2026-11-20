#!/usr/bin/env bash
# Start the POC on macOS (also works on Linux).
#   bash scripts/run.sh         -> single process: API + built UI on http://localhost:8000
#   bash scripts/run.sh --dev   -> API with auto-reload (:8000) + Vite hot-reload UI (:5173); Ctrl+C stops both
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"
[ -x "$PY" ] || { echo "Run 'bash scripts/setup.sh' first." >&2; exit 1; }

open_url() {  # open the browser a few seconds after start (macOS: open, Linux: xdg-open)
  ( sleep 4; { command -v open >/dev/null && open "$1"; } || { command -v xdg-open >/dev/null && xdg-open "$1"; } || true ) >/dev/null 2>&1 &
}

if [ "${1:-}" = "--dev" ]; then
  command -v npm >/dev/null 2>&1 || { echo "--dev needs Node.js (brew install node). Without it, run: bash scripts/run.sh" >&2; exit 1; }
  cd "$ROOT/backend"
  "$PY" -m uvicorn app.main:app --reload --port 8000 &
  API_PID=$!
  trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM
  open_url "http://localhost:5173"
  cd "$ROOT/frontend"
  npm run dev
else
  [ -f "$ROOT/frontend/dist/index.html" ] || { echo "No built UI in frontend/dist - install Node.js and run scripts/setup.sh." >&2; exit 1; }
  open_url "http://localhost:8000"
  cd "$ROOT/backend"
  exec "$PY" -m uvicorn app.main:app --port 8000
fi
