# Start the POC on Windows.
#   scripts\run.ps1          -> single process: API + built UI on http://localhost:8000
#   scripts\run.ps1 -Dev     -> two windows: API with auto-reload (:8000) + Vite hot-reload UI (:5173)
param([switch]$Dev)
$root = Split-Path -Parent $PSScriptRoot
$py = "$root\backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { Write-Error "Run scripts\setup.ps1 first."; exit 1 }

if ($Dev -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "-Dev needs Node.js (winget install OpenJS.NodeJS.LTS). Without it, run scripts\run.ps1 (no -Dev)."; exit 1
}

if ($Dev) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$py' -m uvicorn app.main:app --reload --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
    Start-Sleep 4
    Start-Process "http://localhost:5173"
} else {
    if (-not (Test-Path "$root\frontend\dist\index.html")) {
        Write-Error "No built UI in frontend\dist - install Node.js and run scripts\setup.ps1."; exit 1
    }
    Start-Process "http://localhost:8000"
    Set-Location "$root\backend"
    & $py -m uvicorn app.main:app --port 8000
}
