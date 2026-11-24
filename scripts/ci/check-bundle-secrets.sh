#!/usr/bin/env bash
# Fails if a server-only key, or the name of a server-only variable, ended up
# in something we send to browsers. Run after `npm run build`.
#
#   bash scripts/ci/check-bundle-secrets.sh          # this checkout's .next
#   bash scripts/ci/check-bundle-secrets.sh <dir>    # a folder holding .next,
#                                                    # e.g. files copied out of the Docker image
#
# Browsers get:
#   .next/static                  JavaScript, CSS and other assets
#   .next/server/app/**/*.html    prerendered pages
#   .next/server/app/**/*.rsc     prerendered React Server Component payloads
#   .next/server/app/**/*.body    prerendered route bodies
set -euo pipefail
cd "${1:-.}"

# Key prefixes (Clerk secret keys, Supabase secret keys, the old service_role
# JWT name, Postgres connection strings) and the names of variables that only
# the server may read.
PATTERN='sk_live_|sk_test_|sb_secret_|service_role|postgres(ql)?://|CLERK_SECRET_KEY|SUPABASE_SECRET_KEY|DATABASE_URL|JOBS_SECRET'

if [ ! -d .next/static ] || [ ! -d .next/server/app ]; then
  echo "No build output. Run npm run build first."
  exit 1
fi

# -l prints only file names, so a real key is never printed into the CI log.
found=0
if grep -rlE "$PATTERN" .next/static; then found=1; fi
if grep -rlE "$PATTERN" .next/server/app --include='*.html' --include='*.rsc' --include='*.body'; then found=1; fi

if [ "$found" -ne 0 ]; then
  echo "A secret key or a server-only variable name was found in the files above. Remove it from client code."
  exit 1
fi

echo "No secret key patterns in the browser bundle or prerendered pages."
