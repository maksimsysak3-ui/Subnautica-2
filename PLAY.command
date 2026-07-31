#!/bin/bash
# APEX GP launcher — starts a local web server and opens the game.
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "  Python 3 was not found. Install it from https://www.python.org/downloads/"
  echo "  and then double-click this file again."
  read -r -p "  Press return to close." _
  exit 1
fi

# Pick an available port. lsof is not guaranteed to be installed, so fall back to
# asking Python whether the port binds — which is the thing we actually care about.
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$1" >/dev/null 2>&1
  else
    ! python3 - "$1" <<'PY' >/dev/null 2>&1
import socket,sys
s=socket.socket()
try:
    s.bind(("127.0.0.1",int(sys.argv[1])))
finally:
    s.close()
PY
  fi
}

PORT=8000
while port_busy "$PORT"; do PORT=$((PORT+1)); done

echo "Starting APEX GP on http://localhost:$PORT …"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
# stop the server if this window is closed or interrupted, rather than orphaning it
trap 'kill "$SRV" 2>/dev/null' EXIT INT TERM

# wait for the server to actually be listening before opening the browser
for _ in $(seq 1 40); do
  port_busy "$PORT" && break
  sleep 0.1
done

open "http://localhost:$PORT/index.html"
echo ""
echo "  APEX GP is running.  Leave this window open while you play."
echo "  Close it (or press Ctrl+C) to stop the server."
wait $SRV
