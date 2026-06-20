#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt."
  echo "Installiere zuerst Node.js 18 oder neuer von https://nodejs.org/"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "Alternativ mit Homebrew: brew install node"
  else
    echo "Unter Ubuntu z. B. via NodeSource: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
  fi
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

if [[ "$(uname -s)" == "Darwin" ]]; then
  mkdir -p "$HOME/Library/Application Support/TC Cue System"
else
  mkdir -p "$HOME/.tc-cue-system"
fi

# Git-Hook aktivieren: Show-Datei wird beim Commit automatisch mitversioniert
# (neuestes gewinnt), egal von welchem Rechner gepusht wird.
if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse >/dev/null 2>&1; then
  git -C "$ROOT_DIR" config core.hooksPath .githooks
  echo "Git-Hook aktiviert: Show-Datei wird mitversioniert."
fi

echo
echo "Installation abgeschlossen."
if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "Starte die Web-App mit Start.command."
else
  echo "Starte die Web-App mit ./Start.sh"
fi
