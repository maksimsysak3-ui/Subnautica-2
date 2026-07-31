@echo off
setlocal enabledelayedexpansion
REM APEX GP launcher - starts a local web server and opens the game.
cd /d "%~dp0"

REM Find a Python. "python" on a stock Windows box is the Microsoft Store stub,
REM which opens the Store instead of running anything, so try the py launcher first.
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python3 >nul 2>&1 && set "PY=python3"
if not defined PY where python  >nul 2>&1 && set "PY=python"
if not defined PY (
  echo.
  echo   Python was not found on this machine.
  echo   Install it from https://www.python.org/downloads/ ^(tick "Add to PATH"^),
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

REM Pick a free port. 8000 is a popular one, and the server dies silently when it
REM is already taken - which used to leave the browser staring at nothing.
set "PORT="
for /l %%p in (8000,1,8020) do (
  if not defined PORT (
    netstat -an | findstr /c:":%%p " | findstr /i "LISTENING" >nul 2>&1
    if errorlevel 1 set "PORT=%%p"
  )
)
if not defined PORT set "PORT=8000"

echo Starting APEX GP on http://localhost:%PORT% ...

REM Start the server FIRST and give it a moment to bind. Opening the browser
REM before the server is listening reliably showed a connection error on the
REM first load and you had to refresh by hand.
start "APEX GP server" /min cmd /c "%PY% -m http.server %PORT%"
timeout /t 2 /nobreak >nul
start "" http://localhost:%PORT%/index.html

echo.
echo   APEX GP is running. Leave the server window open while you play.
echo   Close it to stop the server.
echo.
pause
