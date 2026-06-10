#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_LOG="$ROOT_DIR/.build/server.log"
SERVER_PID="$ROOT_DIR/.build/server.pid"

mkdir -p "$ROOT_DIR/.build"

if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "Server already running on http://localhost:3000"
else
  cd "$ROOT_DIR/server"
  nohup node --import tsx src/index.ts >"$SERVER_LOG" 2>&1 &
  echo $! >"$SERVER_PID"

  for _ in {1..50}; do
    if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  if ! curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "Server did not start. See: $SERVER_LOG" >&2
    exit 1
  fi
  echo "Server started on http://localhost:3000"
fi

curl --silent --request POST \
  --header "Content-Type: application/json" \
  --data '{}' \
  http://127.0.0.1:3000/api/simulator/start >/dev/null
echo "Timecode running"

cd "$ROOT_DIR"
./scripts/build-catalyst.sh
