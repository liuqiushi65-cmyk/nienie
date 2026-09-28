#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${NIENIE_INSTALL_DIR:-$HOME/Applications}"
APP="$DEST/捏一会儿.app"
if [ -e "$APP" ]; then
  ID=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Contents/Info.plist" 2>/dev/null || true)
  if [ "$ID" != "local.lexie.nienie" ]; then printf '目标已存在其他应用，停止安装：%s\n' "$APP"; exit 1; fi
fi
if [ ! -f "build/捏一会儿.zip" ]; then bash scripts/build.sh; fi
mkdir -p "$DEST"
# 整包替换，避免旧版资源残留使代码签名失效；失败时恢复旧包。
STAGE=$(mktemp -d "$DEST/.nienie-install.XXXXXX")
cleanup() {
  if [ -d "$STAGE/previous.app" ] && [ ! -e "$APP" ]; then mv "$STAGE/previous.app" "$APP"; fi
  rm -rf "$STAGE"
}
trap cleanup EXIT
ditto -x -k --norsrc --noextattr "build/捏一会儿.zip" "$STAGE"
codesign --verify --strict "$STAGE/捏一会儿.app"
if [ -e "$APP" ]; then mv "$APP" "$STAGE/previous.app"; fi
mv "$STAGE/捏一会儿.app" "$APP"
codesign --verify --strict "$APP"
printf '已安装：%s\n' "$APP"
