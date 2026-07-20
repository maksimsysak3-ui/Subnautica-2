#!/bin/bash
# APEX GP launcher — starts a local web server and opens the game.
cd "$(dirname "$0")"
PORT=8000
# pick an available port
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Starting APEX GP on http://localhost:$PORT …"
python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
sleep 1
HTML=$(ls index.html 2>/dev/null | head -1); [ -z "$HTML" ] && HTML=$(ls *.html 2>/dev/null | head -1)
open "http://localhost:$PORT/$HTML"
echo ""
echo "  APEX GP is running.  Leave this window open while you play."
echo "  Close it (or press Ctrl+C) to stop the server."
wait $SRV
