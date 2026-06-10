#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED_DATA="$ROOT_DIR/.build/catalyst"
APP="$DERIVED_DATA/Build/Products/Release-maccatalyst/TCCueCatalyst.app"

cd "$ROOT_DIR"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required. Install it with: brew install xcodegen" >&2
  exit 1
fi

xcodegen generate --spec ios/project.yml --project ios

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/TCCue.xcodeproj \
  -scheme TCCueCatalyst \
  -configuration Release \
  -destination "platform=macOS,variant=Mac Catalyst" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  ENABLE_DEBUG_DYLIB=NO \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  build

codesign --force --deep --sign - "$APP"
echo "Catalyst app built at: $APP"

if [[ "${1:-}" != "--no-open" ]]; then
  if ! open "$APP"; then
    echo "macOS blocked the automatic launch. Open the app manually:"
    echo "$APP"
  fi
fi
