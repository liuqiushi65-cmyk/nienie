#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="${NIENIE_INSTALL_DIR:-$HOME/Applications}/捏一会儿.app"
if [ ! -x "$APP/Contents/MacOS/Nienie" ]; then bash scripts/install.sh; fi
open "$APP" --args "$@"
