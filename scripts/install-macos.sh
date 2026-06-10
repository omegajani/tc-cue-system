#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Diese Installation ist für macOS vorgesehen." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt."
  echo "Installiere zuerst Node.js 18 oder neuer von https://nodejs.org/"
  echo "Alternativ mit Homebrew: brew install node"
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 18 )); then
  echo "Node.js 18 oder neuer wird benötigt. Installiert ist: $(node --version)" >&2
  exit 1
fi

echo "Installiere TC Cue System..."
cd "$ROOT_DIR/server"
npm ci

mkdir -p "$HOME/Library/Application Support/TC Cue System"

echo
echo "Installation abgeschlossen."
echo "Starte die Web-App mit Start.command."
