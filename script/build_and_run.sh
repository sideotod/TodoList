#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_ARGUMENTS=()
if [[ "$MODE" == "--design-preview" ]]; then
  MODE="run"
  APP_ARGUMENTS=(--design-preview)
fi
APP_NAME="TodoList"
BUNDLE_ID="com.sideotod.TodoList"
MIN_SYSTEM_VERSION="14.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/macos/TodoListApp"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"

read_public_setting() {
  local setting_name="$1"
  local setting_value="${!setting_name:-}"
  if [[ -n "$setting_value" ]]; then
    printf '%s' "$setting_value"
    return
  fi
  if [[ -f "$ROOT_DIR/.env.local" ]]; then
    /usr/bin/awk -v key="$setting_name" '
      index($0, key "=") == 1 {
        value = substr($0, length(key) + 2)
        gsub(/^[ \t]+|[ \t]+$/, "", value)
        if (substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") value = substr(value, 2, length(value) - 2)
        if (substr(value, 1, 1) == "\047" && substr(value, length(value), 1) == "\047") value = substr(value, 2, length(value) - 2)
        print value
        exit
      }
    ' "$ROOT_DIR/.env.local"
  fi
}

SUPABASE_BUILD_URL="$(read_public_setting SUPABASE_URL)"
SUPABASE_BUILD_PUBLISHABLE_KEY="$(read_public_setting SUPABASE_PUBLISHABLE_KEY)"
if [[ -z "$SUPABASE_BUILD_URL" ]]; then
  SUPABASE_BUILD_URL="$(read_public_setting NEXT_PUBLIC_SUPABASE_URL)"
fi
if [[ -z "$SUPABASE_BUILD_PUBLISHABLE_KEY" ]]; then
  SUPABASE_BUILD_PUBLISHABLE_KEY="$(read_public_setting NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
fi

if /usr/bin/pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  /usr/bin/osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in {1..30}; do
    /usr/bin/pgrep -x "$APP_NAME" >/dev/null 2>&1 || break
    sleep 0.1
  done
fi

swift build --package-path "$PACKAGE_DIR"
BUILD_BIN_DIR="$(swift build --package-path "$PACKAGE_DIR" --show-bin-path)"
BUILD_BINARY="$BUILD_BIN_DIR/$APP_NAME"
if [[ ! -x "$BUILD_BINARY" ]]; then
  echo "SwiftPM executable not found: $BUILD_BINARY" >&2
  exit 1
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS"
cp "$BUILD_BINARY" "$APP_BINARY"
chmod +x "$APP_BINARY"

cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>TodoList</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>4.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>com.sideotod.TodoList.auth</string>
      <key>CFBundleURLSchemes</key>
      <array><string>todolist</string></array>
    </dict>
  </array>
</dict>
</plist>
PLIST

if [[ -n "$SUPABASE_BUILD_URL" || -n "$SUPABASE_BUILD_PUBLISHABLE_KEY" ]]; then
  /usr/bin/python3 - "$INFO_PLIST" "$SUPABASE_BUILD_URL" "$SUPABASE_BUILD_PUBLISHABLE_KEY" <<'PY'
import plistlib
import sys

path, url, publishable_key = sys.argv[1:]
with open(path, "rb") as source:
    info = plistlib.load(source)
if url:
    info["SupabaseURL"] = url
if publishable_key:
    info["SupabasePublishableKey"] = publishable_key
with open(path, "wb") as destination:
    plistlib.dump(info, destination, sort_keys=False)
PY
fi

open_app() {
  if (( ${#APP_ARGUMENTS[@]} > 0 )); then
    /usr/bin/open -n "$APP_BUNDLE" --args "${APP_ARGUMENTS[@]}"
  else
    /usr/bin/open -n "$APP_BUNDLE"
  fi
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    for _ in {1..30}; do
      /usr/bin/pgrep -x "$APP_NAME" >/dev/null 2>&1 && exit 0
      sleep 0.1
    done
    echo "TodoList did not start within 3 seconds." >&2
    exit 1
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
