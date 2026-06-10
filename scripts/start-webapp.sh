#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build"
SERVER_LOG="$BUILD_DIR/server.log"
SERVER_PID="$BUILD_DIR/server.pid"
HEALTH_URL="http://127.0.0.1:3000/api/health"

mkdir -p "$BUILD_DIR"

if [[ ! -d "$ROOT_DIR/server/node_modules" ]]; then
  "$ROOT_DIR/scripts/install-macos.sh"
fi

if curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1; then
  echo "TC Cue System läuft bereits."
else
  cd "$ROOT_DIR/server"
  nohup node --import tsx src/index.ts >"$SERVER_LOG" 2>&1 &
  echo $! >"$SERVER_PID"

  for _ in {1..50}; do
    if curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done

  if ! curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Der Server konnte nicht gestartet werden." >&2
    echo "Details: $SERVER_LOG" >&2
    exit 1
  fi
  echo "TC Cue System wurde gestartet."
fi

echo "Web-App: http://localhost:3000"
if [[ "${TC_CUE_NO_OPEN:-}" != "1" ]]; then
  open "http://localhost:3000"
fi
