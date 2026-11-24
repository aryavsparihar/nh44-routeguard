#!/usr/bin/env bash
# Gives the web app's database login (routeguard_app) a new random password
# and writes DATABASE_URL into .env.local. The password is never printed.
#
#   npm run db:set-app-password
#
# Run it yourself in your own terminal. It needs the Supabase CLI to be logged
# in and linked (like npm run db:push). Run it again any time to change the
# password; then update the Azure secret too (docs/runbook.md).
set -euo pipefail
umask 077

cd "$(dirname "$0")/../.."
POOLER_HOST=aws-1-ap-south-1.pooler.supabase.com # Supabase → Connect → Transaction pooler
PROJECT_REF=mzublcdqgntejkvvoozh

pw=$(openssl rand -hex 32)
sql_file=$(mktemp)
env_tmp=$(mktemp)
trap 'rm -f "$sql_file" "$env_tmp"; unset pw' EXIT

printf "alter role routeguard_app with password '%s';\n" "$pw" > "$sql_file"
if ! npx --no-install supabase db query --remote --yes -f "$sql_file" > /dev/null 2>&1; then
  echo "Could not set the password on the database. Check that 'npx supabase migration list --remote' works, then try again." >&2
  exit 1
fi

# Keep every other line of .env.local, replace DATABASE_URL.
if [ -f .env.local ]; then grep -v '^DATABASE_URL=' .env.local > "$env_tmp" || true; fi
printf 'DATABASE_URL="postgresql://routeguard_app.%s:%s@%s:6543/postgres"\n' "$PROJECT_REF" "$pw" "$POOLER_HOST" >> "$env_tmp"
mv "$env_tmp" .env.local
chmod 600 .env.local

echo "Done: routeguard_app has a new password, and DATABASE_URL is in .env.local (not shown)."
echo "Next: npm run db:orm-check"
