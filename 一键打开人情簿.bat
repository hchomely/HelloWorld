@echo off
setlocal
title Gift Ledger Launcher

cd /d "%~dp0"

echo [1/4] Checking dependencies...
if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo [2/4] Checking build output...
if not exist "dist\index.html" (
  echo Building project...
  call npm run build
  if errorlevel 1 (
    echo ERROR: build failed.
    pause
    exit /b 1
  )
)

echo [3/4] Starting local services...
start "Gift Ledger Service" cmd /k "cd /d ""%~dp0"" && npm run app:start"
if errorlevel 1 (
  echo ERROR: failed to start service window.
  pause
  exit /b 1
)

echo [4/4] Opening browser...
timeout /t 3 >nul
start "" "http://localhost:4173"

echo Done. You can close this launcher window.
pause
exit /b 0
