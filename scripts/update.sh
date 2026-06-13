#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(uname -s)" == "Darwin" ]]; then
  DATA_FILE="$HOME/Library/Application Support/TC Cue System/shows.json"
  BACKUP_DIR="$HOME/Library/Application Support/TC Cue System/backups"
else
  DATA_FILE="$HOME/.tc-cue-system/shows.json"
  BACKUP_DIR="$HOME/.tc-cue-system/backups"
fi

HEALTH_URL="http://127.0.0.1:3000/api/health"
WAS_RUNNING=false

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Das Update wurde nicht gestartet, weil lokale Code-Änderungen vorhanden sind."
  echo "Bitte Änderungen zuerst committen oder sichern."
  exit 1
fi

if [[ -f "$DATA_FILE" ]]; then
  mkdir -p "$BACKUP_DIR"
  cp "$DATA_FILE" "$BACKUP_DIR/shows-before-update-$(date +%Y%m%d-%H%M%S).json"
fi

if curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1; then
  WAS_RUNNING=true
  "$ROOT_DIR/scripts/stop-webapp.sh"
fi

echo "Lade Aktualisierungen von GitHub..."
git pull --ff-only
"$ROOT_DIR/scripts/install.sh"

if [[ "$WAS_RUNNING" == true ]]; then
  "$ROOT_DIR/scripts/start-webapp.sh"
fi

echo
echo "Update abgeschlossen. Lokale Shows bleiben erhalten."
