#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# 在临时目录签名，避免同步目录给 .app 附加 Finder 元数据而导致签名失败。
STAGE=$(mktemp -d /private/tmp/nienie-build.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT
APP="$STAGE/捏一会儿.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" .runtime build
node scripts/bundle.mjs "$APP/Contents/Resources/web"
python3 - "$APP" <<'PY'
from __future__ import annotations
import json, plistlib, sys
from pathlib import Path
app = Path(sys.argv[1])
plist = {'CFBundleName':'捏一会儿','CFBundleDisplayName':'捏一会儿','CFBundleExecutable':'Nienie','CFBundleIdentifier':'local.lexie.nienie','CFBundleVersion':'1','CFBundleShortVersionString':'0.1.0','LSUIElement':True,'NSHighResolutionCapable':True,'LSMinimumSystemVersion':'13.0'}
(app/'Contents/Info.plist').write_bytes(plistlib.dumps(plist))
(app/'Contents/Resources/config.json').write_text(json.dumps({'project':str(Path.cwd())}), encoding='utf-8')
PY
clang -fobjc-arc -fno-modules -Wno-incompatible-pointer-types app/native/main.m -o "$APP/Contents/MacOS/Nienie" -framework Cocoa -framework WebKit -framework Carbon
codesign --force --sign - "$APP"
codesign --verify --strict "$APP"
ditto -c -k --norsrc --noextattr --keepParent "$APP" "build/捏一会儿.zip"
printf '已构建并验证本地签名：%s/build/捏一会儿.zip\n' "$PWD"
