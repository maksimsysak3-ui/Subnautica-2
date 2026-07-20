@echo off
REM APEX GP launcher - starts a local web server and opens the game.
cd /d "%~dp0"
start "" http://localhost:8000/index.html
python -m http.server 8000
