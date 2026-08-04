#!/usr/bin/env bash
#
# Applies committed migrations during a Vercel *production* build, and nowhere
# else. Wired into `build` so that shipping code and reshaping the database are
# one step instead of two, only one of which anyone remembers (ADR-020).
#
# Why guarded rather than unconditional: Preview deployments run the build too,
# and this project's Preview environment points at the production database. An
# unguarded `prisma migrate deploy` here would apply a half-finished feature
# branch's migration to production data the moment someone opened a pull
# request. The guard is what makes putting this in `build` safe at all.
#
# Skipping is therefore the default, and it is what keeps `pnpm build`
# unchanged everywhere it already runs: neither a local build nor CI sets
# VERCEL_ENV, so both take the early exit and never touch a database.
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "migrate: skipped — VERCEL_ENV=${VERCEL_ENV:-unset}, only production applies migrations"
  exit 0
fi

# Migrations take session-level locks that PgBouncer does not support, so they
# must not go through Neon's pooled endpoint. Prisma reads `directUrl` for
# migration commands, which is why DIRECT_URL exists separately from
# DATABASE_URL. Failing here with a reason beats letting Prisma either hang
# against the pooler or report a missing-env error with no context.
#
# Both sources are checked because the two readers differ: Vercel injects real
# environment variables and ships no .env, while Prisma also loads .env locally.
# Testing this path on a laptop would otherwise fail on a variable that is in
# fact configured, just not in a place the shell can see. Only the presence of
# the key is checked here — leave reading its value to Prisma, rather than
# reimplementing .env quoting rules in bash.
if [ -z "${DIRECT_URL:-}" ] && ! grep -qE '^[[:space:]]*DIRECT_URL=' .env 2>/dev/null; then
  echo "FAIL: DIRECT_URL is not set, so migrations have no direct connection to use."
  echo
  echo "Set it in the Vercel project's environment variables to Neon's"
  echo "*direct* connection string — the one WITHOUT '-pooler' in the host."
  echo "DATABASE_URL stays the pooled string, which is what the app itself uses."
  exit 1
fi

echo "migrate: applying committed migrations to production"
pnpm exec prisma migrate deploy
