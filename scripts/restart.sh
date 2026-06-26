#!/usr/bin/env bash
# Spawned by the server after an update. Waits for the old process to stop,
# then starts a fresh server instance.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEALTH_URL="http://127.0.0.1:3000/api/health"

# Wait until the old server stops responding (max 15 s)
for _ in {1..75}; do
  if ! curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# Short extra pause to let the port be released
sleep 0.5

# Start new server without opening the browser
TC_CUE_NO_OPEN=1 "$ROOT_DIR/scripts/start-webapp.sh"
