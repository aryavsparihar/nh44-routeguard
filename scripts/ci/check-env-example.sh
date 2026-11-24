#!/usr/bin/env bash
# Fails if the app reads an environment variable that .env.example doesn't
# list. .env.example is how teammates (and the deploy) know what to set
# (BUILD_PROMPT section 16).
set -euo pipefail

# process.env.NAME, and env.NAME where the env object is passed in (e.g.
# securityHeaders(process.env)). NODE_ENV is set by Next itself.
used=$(grep -rhoE '(process\.)?env\.[A-Z][A-Z0-9_]+' app lib src proxy.ts next.config.ts \
         --include='*.ts' --include='*.tsx' --exclude='*.test.ts' \
       | sed -E 's/^(process\.)?env\.//' | grep -vx 'NODE_ENV' | sort -u)

missing=0
for name in $used; do
  if ! grep -qE "^#? ?${name}=" .env.example; then
    echo "Missing from .env.example: $name"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Add each name above to .env.example with a comment saying where it's used and whether it's secret."
  exit 1
fi
echo "Every environment variable the app reads is in .env.example ($(echo "$used" | wc -l | tr -d ' ') names)."
