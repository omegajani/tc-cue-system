#!/bin/zsh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$ROOT_DIR/scripts/install-macos.sh"
echo
read -k 1 "?Zum Schließen eine Taste drücken..."
