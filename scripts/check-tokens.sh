#!/usr/bin/env bash
#
# Guards the rule from docs/ARCHITECTURE.md §6: colour literals live in exactly
# one place, so retheming the product means editing four values in one file.
#
# Two files are allowed to contain hex:
#   src/styles/tokens.css  — the web token layer
#   src/styles/palette.ts  — the same four values for the email template, which
#                            cannot use var()/color-mix() because email clients
#                            do not support them. A unit test pins them together.
#
set -euo pipefail

cd "$(dirname "$0")/.."

ALLOWED_RE='^\./src/styles/(tokens\.css|palette\.ts):'

# 3-, 4-, 6- or 8-digit hex, i.e. #fff #ffff #ffffff #ffffffff
HEX_RE='#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b'

hits=$(
  grep -rInE "$HEX_RE" . \
    --include='*.css' \
    --include='*.ts' \
    --include='*.tsx' \
    --include='*.js' \
    --include='*.mjs' \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=coverage \
    --exclude-dir=generated \
    2>/dev/null | grep -Ev "$ALLOWED_RE" || true
)

if [ -n "$hits" ]; then
  echo "FAIL: hex colour literal outside src/styles/tokens.css"
  echo
  echo "$hits"
  echo
  echo "Use a semantic token from src/styles/tokens.css instead, e.g."
  echo "  color: var(--ink);   background: var(--bg-surface);"
  echo "If you genuinely need a new colour, derive it in tokens.css with"
  echo "color-mix() from the four palette values."
  exit 1
fi

echo "OK: no hex colour literals outside src/styles/tokens.css"
