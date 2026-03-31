#!/bin/bash
# Copy the latest webapp build to the iOS app bundle
set -euo pipefail

WEBAPP_DIST="$(cd "$(dirname "$0")" && pwd)/dist"
IOS_WEBAPP_DIR="$(cd "$(dirname "$0")" && cd ../../meander-ios/MeanderIOS/Resources/WebApp && pwd)"

if [ ! -d "$WEBAPP_DIST" ]; then
  echo "Webapp build output not found: $WEBAPP_DIST"
  echo "Run: npm run build"
  exit 1
fi

rm -rf "$IOS_WEBAPP_DIR"/*
cp -R "$WEBAPP_DIST"/* "$IOS_WEBAPP_DIR"/
echo "Copied webapp build to iOS bundle: $IOS_WEBAPP_DIR"