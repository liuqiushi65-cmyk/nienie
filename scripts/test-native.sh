#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
TEST_BINARY=$(mktemp /private/tmp/nienie-native-test.XXXXXX)
trap 'rm -f "$TEST_BINARY"' EXIT
clang -fobjc-arc -fno-modules -Wno-incompatible-pointer-types tests/hotkey.test.m -o "$TEST_BINARY" -framework Cocoa -framework WebKit -framework Carbon
"$TEST_BINARY"
