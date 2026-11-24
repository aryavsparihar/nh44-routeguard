#!/usr/bin/env bash
# Fails if code outside src/server/db/ builds SQL from strings.
#
# Drizzle's query builders and its sql`...` template send every value as a
# bound parameter, so user input can't change the query. sql.raw() and
# sql.unsafe() / postgres' unsafe() paste text straight into the SQL; nothing
# else may use them (docs/security.md, "SQL injection").
set -euo pipefail

if grep -rnE "sql\.raw\(|\.unsafe\(" app src lib --include='*.ts' --include='*.tsx' | grep -v "^src/server/db/"; then
  echo "Raw SQL is only allowed in src/server/db/. Use Drizzle's builders or the sql\`\` template."
  exit 1
fi
echo "No raw SQL outside src/server/db/."
