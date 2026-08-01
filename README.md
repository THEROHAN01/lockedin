# LockedIn

A study roadmap that nags you until you finish it. You set up a plan once — a
list of LeetCode problems, a date range, and a send time — and it emails you
every day with what to do, adjusting the daily load if you fall behind.

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what the MVP is and is not
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it is built, with diagrams
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — every significant technical decision and why

## Getting started

Requires Node 20+, Docker, and pnpm 10 (`corepack prepare pnpm@10.15.1 --activate`;
pnpm 11 needs Node 22).

```bash
pnpm install
cp .env.example .env          # then fill in the two secrets, see below
pnpm db:up                    # Postgres 16 on port 5433, plus a test database
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

Generate the two secrets `.env.example` leaves blank:

```bash
openssl rand -base64 32       # BETTER_AUTH_SECRET
openssl rand -base64 32       # CRON_SECRET
```

`RESEND_API_KEY` can stay as the placeholder for everything except actually
delivering mail — the test suite never sends.

## Commands

| | |
|---|---|
| `pnpm dev` | development server |
| `pnpm test` | everything |
| `pnpm test:unit` | domain only — no database, no network, no clock |
| `pnpm test:integration` | repositories, API, cron — needs `pnpm db:up` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the layer-boundary rules |
| `pnpm lint:tokens` | fails on a hex colour outside the token files |
| `pnpm db:studio` | browse the database |

`pnpm lint` is not only style. It enforces two architectural rules that no test
would catch: `src/domain/**` cannot import Prisma (**including `import type`**),
an outer layer, a framework, or a vendor SDK, and cannot call `new Date()` or
`Date.now()`; and `app/**` cannot reach past `src/usecases` into `src/data`.

## Seeing a real email

The daily send is normally triggered by Vercel Cron every 15 minutes. Locally,
run the same sweep on demand by calling that endpoint yourself:

```bash
curl "http://localhost:3000/api/cron/send-daily" \
  -H "authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d'"' -f2)"
```

Or press **Run sweep** at the bottom of any roadmap page, which is session-
authenticated and absent in production. Both need a real `RESEND_API_KEY` and an
`EMAIL_FROM` verified on your Resend domain.

There is deliberately no separate unauthenticated dev endpoint. One existed
briefly, guarded only by `NODE_ENV`; once it carried the same secret as the cron
route it was the cron route, so it was deleted rather than duplicated.

The sweep is idempotent: it writes a `SendLog` row per roadmap per local day, so
a second run does nothing until tomorrow. If you want to re-send while testing,
delete the row:

```bash
docker exec lockedin-db psql -U lockedin -d lockedin -c "DELETE FROM send_log;"
```

## Three things worth knowing before changing code

**The domain layer is pure.** `src/domain/` has no database, no network and no
clock — the current instant is always a parameter. That is what makes the entire
pacing engine testable in milliseconds with no fixtures, and it is enforced by
lint rather than convention. If something there needs the clock or the database,
it belongs in `src/usecases/`.

**Nothing about the schedule is precomputed.** No item is ever assigned to a
date. The daily quota is recomputed from current state on every send, which is
why you can change a roadmap's dates or add problems at any time and the next
email just reflects it.

**Duplicate emails are prevented by the database, not by an `if`.** The cron polls
every 15 minutes and a roadmap stays "past its send time" for the rest of its
local day, so `UNIQUE(roadmapId, localDate)` on `SendLog` is what stops a user
being mailed 96 times. The claim is taken *before* the send so two overlapping
invocations cannot both deliver, and released if the send fails so a transient
error costs one retry rather than the whole day.

## Deploying

Vercel, per ADR-007. `vercel.json` registers the cron. Set `DATABASE_URL` to a
Neon connection string and the rest of `.env.example` in the project's
environment variables. Migrations run with `pnpm exec prisma migrate deploy`.
