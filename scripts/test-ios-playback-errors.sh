#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -f "$TEST_DIR/test"; rmdir "$TEST_DIR"' EXIT

xcrun swiftc -module-name BunnyStreamPlayer \
  "$ROOT/ios/PlaybackErrorClassifier.swift" \
  "$ROOT/scripts/playback-error-classifier.test.swift" \
  -o "$TEST_DIR/test"
"$TEST_DIR/test"
