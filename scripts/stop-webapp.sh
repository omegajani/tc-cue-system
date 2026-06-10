#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_PID="$ROOT_DIR/.build/server.pid"

if [[ -f "$SERVER_PID" ]]; then
  PID="$(cat "$SERVER_PID")"
  if kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID"
    echo "TC Cue System wurde gestoppt."
  else
    echo "TC Cue System läuft nicht."
  fi
  rm -f "$SERVER_PID"
else
  echo "Kein über Start.command gestarteter Server gefunden."
fi
