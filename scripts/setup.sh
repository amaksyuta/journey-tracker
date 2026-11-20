#!/usr/bin/env bash
# One-time setup on macOS (also works on Linux). Run from the repo root:
#   bash scripts/setup.sh
# Requires: Python 3.10+ (python3). Node.js 20+ is needed to build the UI
# unless a prebuilt frontend/dist already exists.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "python3 not found. Install it with:  brew install python@3.12" >&2
  exit 1
fi
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || {
  echo "Python 3.10+ required (found $("$PY" --version)). Install with:  brew install python@3.12" >&2
  exit 1
}

echo "== Backend: creating .venv and installing Python packages =="
cd "$ROOT/backend"
"$PY" -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

echo "== Frontend =="
cd "$ROOT/frontend"
if command -v npm >/dev/null 2>&1; then
  npm install
  npm run build
elif [ -f dist/index.html ]; then
  echo "npm not found - using the prebuilt UI in frontend/dist (fine for running the POC)."
  echo "To edit the UI later, install Node.js:  brew install node"
else
  echo "npm not found and no prebuilt UI. Install Node.js and re-run this script:" >&2
  echo "    brew install node" >&2
  exit 1
fi

echo
echo "Done. Start everything with:  bash scripts/run.sh"
