#!/usr/bin/env bash
# Fails if a server-only key ended up in the browser bundle.
# Run after `npm run build`. Everything in .next/static is sent to browsers.
set -euo pipefail

BUNDLE_DIR=".next/static"
PATTERN='sk_live_|sk_test_|sb_secret_|service_role'

if [ ! -d "$BUNDLE_DIR" ]; then
  echo "No $BUNDLE_DIR folder. Run npm run build first."
  exit 1
fi

# -l prints only file names, so a real key is never printed into the CI log.
if grep -rlE "$PATTERN" "$BUNDLE_DIR"; then
  echo "A secret key pattern was found in the files above. Remove it from client code."
  exit 1
fi

echo "No secret key patterns in $BUNDLE_DIR."
