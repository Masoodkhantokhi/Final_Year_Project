#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org/ and rerun this launcher."
  exit 1
fi
exec node start.js
