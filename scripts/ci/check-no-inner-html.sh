#!/usr/bin/env bash
# Fails if any code uses dangerouslySetInnerHTML. React escapes text by
# default; this prop turns that off, which is how XSS gets in. Our CSP allows
# inline scripts (docs/decisions.md, A5), so this rule matters even more.
set -euo pipefail

if grep -rn "dangerouslySetInnerHTML" app src lib --include='*.ts' --include='*.tsx'; then
  echo "dangerouslySetInnerHTML is not allowed (CLAUDE.md). Render text as text."
  exit 1
fi
echo "No dangerouslySetInnerHTML."
