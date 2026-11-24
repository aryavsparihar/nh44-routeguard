#!/usr/bin/env bash
# Runs supabase/tests/rls.test.sql on the linked Supabase project without
# Docker. ("supabase test db --remote" needs Docker for pg_prove.)
#
# It sends the test file through "supabase db query", saving each TAP line
# into a temporary table and printing them at the end. The file still ends in
# ROLLBACK, so nothing it inserts stays in the database.
#
# Usage: npm run db:test        (asks before running on the hosted project)
set -euo pipefail

cd "$(dirname "$0")/../.."
test_file=supabase/tests/rls.test.sql
run_file=$(mktemp -t rls-run.XXXXXX)
trap 'rm -f "$run_file"' EXIT

sed -E \
  -e 's/^begin;$/begin;\ncreate temp table tap (n serial, line text);\ngrant all on tap to public;\ngrant all on sequence tap_n_seq to public;/' \
  -e 's/^select (plan|is|isnt|throws_ok|lives_ok|hasnt_column|is_empty)\(/insert into tap(line) select \1(/' \
  -e 's/^select \* from finish\(\);/insert into tap(line) select * from finish();/' \
  -e "s/^rollback;\$/set local role postgres;\nselect string_agg(line, E'\\\\n' order by n) as tap from tap;\nrollback;/" \
  "$test_file" > "$run_file"

output=$(npx supabase db query --remote -f "$run_file" --output-format json "$@")
tap=$(printf '%s' "$output" | node -e '
  let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    const json = JSON.parse(s.slice(s.indexOf("{")));
    process.stdout.write((json.rows?.[0]?.tap ?? "") + "\n");
  });')
printf '%s\n' "$tap"

planned=$(printf '%s\n' "$tap" | sed -nE 's/^1\.\.([0-9]+)$/\1/p')
passed=$(printf '%s\n' "$tap" | grep -c '^ok ' || true)
failed=$(printf '%s\n' "$tap" | grep -c '^not ok ' || true)
echo "planned ${planned:-?}, passed $passed, failed $failed"
[ -n "$planned" ] && [ "$failed" -eq 0 ] && [ "$passed" -eq "$planned" ]
