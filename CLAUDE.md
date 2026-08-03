# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LockedIn is a study-roadmap nagging tool: a user uploads a list of LeetCode
problems with a date range and send time, and a daily email keeps them on
pace, adjusting the load if they fall behind. Single Next.js app, deployed on
Vercel; no separate backend service.

Full detail lives in three docs — read them before making non-trivial changes,
they are kept current and are more authoritative than this file:

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — MVP scope, what is deliberately out of scope
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, data model, the pacing rule, the send flow, API conventions, enforced rules
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADR log, append-only, with the "why" behind every stack/design choice

## Commands

Requires Node 20+, Docker, pnpm 10 (`corepack prepare pnpm@10.15.1 --activate`).

```bash
pnpm install
pnpm db:up                    # Postgres 16 on port 5433 (dev + test db)
pnpm db:migrate               # prisma migrate dev
pnpm dev                      # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | `prisma generate && next build` |
| `pnpm test` | everything (unit + integration) |
| `pnpm test:unit` | `src/domain/` only — no database, no network, no clock |
| `pnpm test:integration` | repositories, API routes, cron — needs `pnpm db:up` |
| `pnpm test:watch` | vitest watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the layer-boundary rules below |
| `pnpm lint:tokens` | fails on a hex colour literal outside `src/styles/tokens.css`/`palette.ts` |
| `pnpm db:studio` | browse the database |

Run a single test file: `pnpm vitest run tests/unit/domain/quota.test.ts` (add
`--project unit` or `--project integration` if the path is ambiguous). Vitest
`globals: true`, so no per-file `describe`/`it` import needed.

API reference while the dev server is up: Swagger UI at
`http://localhost:3000/api-docs`, generated from `src/http/openapi.ts` — request
schemas come from the same Zod schemas that validate requests, and
`tests/unit/http/openapi.test.ts` fails if a route has no entry.

Trigger the daily send locally without waiting for cron:

```bash
curl "http://localhost:3000/api/cron/send-daily" \
  -H "authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d'"' -f2)"
```

It's idempotent (one `SendLog` row per roadmap per local day) — delete the row
to force a resend while testing:
`docker exec lockedin-db psql -U lockedin -d lockedin -c "DELETE FROM send_log;"`.

If the dev server 500s with `Cannot find module './705.js'`: don't run
`pnpm build` and `pnpm dev` against the same `.next` at once. Kill the dev
server, `rm -rf .next`, restart.

## Architecture

### Layers point inward, and it's enforced by lint, not convention

```
app/ (routes, RSC, Server Actions)
  -> src/usecases/ (orchestration: clock + DB live only here)
    -> src/domain/ (PURE: no I/O, no clock, no framework, no vendor SDK)
    -> src/data/ (Prisma repositories, map rows -> src/domain/types.ts)
```

**`src/domain/**` is the load-bearing rule in this codebase.** No `import` of
Prisma (including `import type` — a type-only import adds no runtime I/O so no
test would ever catch it, hence the lint rule), no framework, no vendor SDK,
and no `new Date()`/`Date.now()` — the current instant is always a parameter.
This is what makes the entire pacing engine testable in milliseconds with no
fixtures or clock mocking. If code needs the real clock or the real database,
it belongs in `src/usecases/`, not `src/domain/`.

`app/**` cannot import `src/data/**` directly — route handlers and pages go
through `src/usecases`, which owns ownership checks and orchestration.

Both rules are `no-restricted-imports`/`no-restricted-syntax` in
`eslint.config.mjs` and run in CI (`.github/workflows/ci.yml`) on every push,
alongside `lint:tokens` and the OpenAPI-coverage test — see
ARCHITECTURE.md §8 for the full enforced-rules table.

### Three seams (interfaces at the outer edge of the domain)

- **`NotificationChannel`** (`src/notifications/channel.ts`) — decouples
  *what/when* to send (domain + usecases) from *how* (`EmailChannel` over
  Resend; `FakeChannel` for tests, which every test asserts against instead of
  touching Resend).
- **`RoadmapSource`** (`src/sources/source.ts`) — decouples "populate a
  roadmap's items" from "how they were produced." Only `CsvUploadSource`
  exists now; deliberately `async` so a future AI-generation source doesn't
  change the interface.
- **`AiProvider`** (`src/ai/provider.ts`) — one method, `generateText`.
  `createGatewayProvider` (Vercel AI Gateway) and `createSarvamProvider`
  (Sarvam) share one `{ apiKey, model }` shape; `aiProviderFromEnv()` picks
  between them via `AI_PROVIDER`/`AI_MODEL`/`AI_API_KEY` and returns `null`
  when unset (not configured is a normal state — every caller must fall back,
  never propagate the failure). Only consumer today: the daily quote
  (`src/usecases/quote.ts`), which falls back to the static `quoteForDate`
  table in `src/domain/digest.ts` on `null`, empty output, or any thrown error.

### Nothing about the schedule is precomputed

No item is ever assigned to a date. `computeDailyQuota`
(`src/domain/quota.ts`) recomputes `ceil(remaining / daysLeft)`, capped at 5,
from current state on every send — so editing a roadmap's dates or item list
takes effect on the very next email with no invalidation step. `endDate` is a
goal, not a wall: a roadmap keeps nagging past it (`daysLeft` floors at 1)
until archived or completed.

### Duplicate emails are prevented by the database, not an `if`

The cron polls every 15 minutes; a roadmap stays "due" for the rest of its
local day. `SendLog` has `UNIQUE(roadmapId, localDate)`, claimed *before* the
send (not after — see ADR-013 for why) and released if the send throws, with
every send carrying an idempotency key so a release-then-retry can't double
deliver even after an ambiguous provider-side failure. Read ARCHITECTURE.md §5
in full before touching `src/usecases/send-daily-digests.ts`.

### API conventions worth knowing before adding a route

Not-found and not-owned both return `404`, never `403` (a `403` confirms the
id exists to an attacker). Ownership is re-checked at every nesting level, not
just the top. Errors are one envelope, `{ error: { code, message, details? } }`,
with a fixed `code` set (`UNAUTHENTICATED`, `NOT_FOUND`, `MALFORMED_JSON`,
`VALIDATION_FAILED`). Full table in ARCHITECTURE.md §7.

## Testing

Two Vitest projects (`vitest.config.ts`), not one suite with tags:

- **`unit`** (`tests/unit/`) — domain only. If a unit test needs a database,
  network, or clock, the code under test is in the wrong layer.
- **`integration`** (`tests/integration/`) — repositories, route handlers, the
  cron orchestrator, against a real Postgres. Runs single-fork/serialized —
  these tests share one database and truncate between files, so don't
  parallelize them. Uses `FakeChannel`, never real Resend.

There are no frontend tests; the current frontend is an API-driving harness
and will be replaced.
