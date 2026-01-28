@echo off
echo [RESTART] Killing existing Python and Node processes...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

echo [RESTART] Starting Backend (FastAPI)...
start /B cmd /c "cd backend && venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [RESTART] Starting Frontend (Next.js)...
start /B cmd /c "npm run dev"

echo [SUCCESS] Both servers are restarting. Please wait 10 seconds and refresh your browser.
