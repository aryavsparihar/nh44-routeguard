#!/usr/bin/env bash
# Fails if a server secret ended up in something we send to browsers, or if
# a module that reads one could be bundled for the browser. Run after
# `npm run build`.
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
#
# Three checks:
#   1. Key-shaped values: a Clerk or Supabase secret key prefix followed by
#      key characters, a service_role JWT claim, or a Postgres URL with a
#      password. (Bare prefixes and variable names alone are not enough:
#      Clerk's and Supabase's browser code contain strings like "sb_secret_"
#      and "CLERK_SECRET_KEY" to recognise keys, never a key itself.)
#   2. The real values: every server secret that is set in this shell's
#      environment (the deploy build has them) is searched for literally.
#   3. Our own source: every module that reads a server secret starts with
#      import "server-only", so the build fails if a browser bundle imports it.
# Only file names are printed, never a matched value.
set -euo pipefail
root=$(pwd)
cd "${1:-.}"

SECRET_NAMES=(CLERK_SECRET_KEY SUPABASE_SECRET_KEY DATABASE_URL JOBS_SECRET)
VALUE_PATTERN='sk_(live|test)_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{16,}|"role" *: *"service_role"|postgres(ql)?://[^:/@"'"'"' ]+:[^@"'"'"' ]+@'

if [ ! -d .next/static ] || [ ! -d .next/server/app ]; then
  echo "No build output. Run npm run build first."
  exit 1
fi

found=0
scan() { # scan <-E|-F> <pattern>: lists files under the browser-facing folders
  grep -rl "$1" -e "$2" .next/static || true
  grep -rl "$1" --include='*.html' --include='*.rsc' --include='*.body' -e "$2" .next/server/app || true
}

hits=$(scan -E "$VALUE_PATTERN")
if [ -n "$hits" ]; then
  printf '%s\n' "$hits"
  echo "Something shaped like a secret key is in the files above."
  found=1
fi

for name in "${SECRET_NAMES[@]}"; do
  value="${!name:-}"
  [ ${#value} -ge 8 ] || continue
  hits=$(scan -F "$value")
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    echo "The value of $name is in the files above."
    found=1
  fi
done

cd "$root"
names=$(IFS='|'; echo "${SECRET_NAMES[*]}")
while IFS= read -r file; do
  if ! grep -q '^import "server-only";' "$file"; then
    echo "$file"
    echo "This file reads a server secret but doesn't start with import \"server-only\"."
    found=1
  fi
done < <(grep -rlE "process\.env\.($names)\b" app src lib --include='*.ts' --include='*.tsx' \
           | grep -vE '\.test\.tsx?$|/proxy\.ts$' || true)

if [ "$found" -ne 0 ]; then
  echo "Remove the secret from client code."
  exit 1
fi
echo "No secret keys in the browser bundle or prerendered pages; secret readers are server-only."
