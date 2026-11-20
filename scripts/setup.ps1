# One-time setup on Windows (PowerShell). Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Requires: Python 3.10+. Node.js 20+ is only needed to rebuild/edit the UI;
# a prebuilt UI in frontend\dist is enough to run the POC.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "== Backend: creating .venv and installing Python packages ==" -ForegroundColor Cyan
Push-Location "$root\backend"
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Pop-Location

Write-Host "== Frontend ==" -ForegroundColor Cyan
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location "$root\frontend"
    npm install
    npm run build
    Pop-Location
} elseif (Test-Path "$root\frontend\dist\index.html") {
    Write-Host "npm not found - using the prebuilt UI in frontend\dist (fine for running the POC)." -ForegroundColor Yellow
    Write-Host "To edit the UI later, install Node.js LTS:  winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
} else {
    Write-Host "npm not found and no prebuilt UI. Install Node.js LTS, open a NEW terminal, re-run this script:" -ForegroundColor Red
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
    exit 1
}

Write-Host "`nDone. Start everything with:  scripts\run.ps1" -ForegroundColor Green
