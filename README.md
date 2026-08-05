# LockedIn

A study roadmap that nags you until you finish it. You set up a plan once — a
list of LeetCode problems, a date range, and a send time — and it emails you
every day with what to do, adjusting the daily load if you fall behind.

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what the MVP is and is not
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it is built, with diagrams
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — every significant technical decision and why
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — the commit message convention, and how to opt into the template

## Getting started

Requires Node 20+, Docker, and pnpm 10 (`corepack prepare pnpm@10.15.1 --activate`;
pnpm 11 needs Node 22).

```bash
pnpm install
cp .env.example .env          # then fill in the two secrets, see below
pnpm db:up                    # Postgres 16 on port 5433, plus a test database
pnpm db:migrate
pnpm dev                      # http://localhost:3000

git config commit.template .gitmessage   # optional, see CONTRIBUTING.md
```

Generate the two secrets `.env.example` leaves blank:

```bash
openssl rand -base64 32       # BETTER_AUTH_SECRET
openssl rand -base64 32       # CRON_SECRET
```

`RESEND_API_KEY` can stay as the placeholder for everything except actually
delivering mail — the test suite never sends.

## Reading the docs

Append `/docs` to wherever this app is running — locally that's
**http://localhost:3000/docs**, deployed it's your production URL (e.g.
`https://lockedin.vercel.app/docs`) — to get the Fumadocs site: a product
section (what LockedIn does, how the daily email and pacing work) and an
engineering section mirroring `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
and `docs/ROADMAP.md` for anyone who'd rather read it in a browser than on
GitHub.

Reading it in a browser buys you three things the markdown files don't:
full-text search (`⌘K` / `Ctrl-K`, indexed in-process — no external service),
the Mermaid diagrams in ARCHITECTURE rendered as actual diagrams, and a theme
switch that shares the one `lk-theme` setting with the rest of the app.

The docs are styled by Fumadocs, deliberately not by the blueprint design
system the product uses. That is why `src/styles/base.css` is imported from the
route-group layouts rather than the root layout — see the comment at the top of
`app/globals.css` before moving it.

## Browsing the API

Every endpoint, its request and response shapes, and its error cases are at
**http://localhost:3000/api-docs** — Swagger UI, with a working "Try it out" for
each one. Sign in through `POST /api/auth/sign-in/email` on that page first and
the session cookie carries into everything after it.

The document behind it is at `/api/openapi.json`, which is what to point a client
generator or a Postman import at. It is generated from the code rather than
maintained beside it: request bodies come from the same Zod schemas that validate
them, response bodies are type-checked against the domain types the handlers
return, and `pnpm test:unit` fails if a route exists with no entry in the
document. `src/http/openapi.ts` has the details.

The docs page loads Swagger UI from a pinned CDN build, so it needs network
access; `/api/openapi.json` itself is served locally and works offline.

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

All of the above runs on every push and pull request — `.github/workflows/ci.yml`,
which also builds the app. The integration job brings up its own throwaway
Postgres, so it needs no secrets and works on a fork's PR. Nothing in CI reads
your `.env`: the suite takes `TEST_DATABASE_URL` from the environment, and the
workflow supplies placeholders for the rest.

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

## AI-generated quote (optional)

The daily email's quote is a static, deterministic table by default (same
quote for everyone on a given date — `quoteForDate` in `src/domain/digest.ts`).
Three variables in `.env` switch it to a freshly generated one instead —
generic across providers, so switching means changing all three together,
not adding a new provider-specific variable:

```bash
AI_PROVIDER="sarvam"
AI_MODEL="sarvam-105b"      # already the default in .env.example
AI_API_KEY="..."            # https://dashboard.sarvam.ai
```

Or the Vercel AI Gateway instead (any model string it supports, not just
Anthropic's):

```bash
AI_PROVIDER="gateway"
AI_MODEL="anthropic/claude-sonnet-5"
AI_API_KEY="..."            # the AI Gateway tab of your Vercel dashboard
```

Leaving `AI_PROVIDER` unset — the default — keeps the static table; that also
covers a provider outage or a bad key, since `resolveDailyQuote` falls back to
it on any failure rather than let that block a send. See ADR-015/016/017/018.

## If the frontend breaks with `Cannot find module './705.js'`

`pnpm dev` and `pnpm build` both write to `.next`, so running a build while the
dev server is up replaces the chunks underneath it and every page 500s with a
missing-module error. Nothing is actually wrong with the code:

```bash
lsof -ti:3000 | xargs -r kill     # stop the dev server
rm -rf .next                      # drop the mixed output
pnpm dev
```

If the port still answers afterwards, an orphaned server is holding it — Next
silently falls back to 3001 and you keep hitting the broken one. Check with
`ps -eo pid,args | grep next-server` and kill the tree.

Don't run `pnpm build` and `pnpm dev` at the same time.

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

Vercel per ADR-007, with the sweep driven from GitHub Actions per ADR-014.

**1. Database.** Create a Postgres database on Neon and copy its pooled
connection string. Apply the schema from your machine — deliberately not from the
build, so a preview deploy can never migrate production:

```bash
DATABASE_URL="<neon-connection-string>" pnpm db:deploy
```

**2. Vercel project.**

```bash
npm i -g vercel
vercel login
vercel link
```

**3. Environment variables** — set these for Production in the Vercel dashboard,
or with `vercel env add <NAME> production`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — a **new** one, not your local value |
| `BETTER_AUTH_URL` | your production URL, e.g. `https://lockedin.vercel.app` |
| `RESEND_API_KEY` | from Resend |
| `EMAIL_FROM` | see the note below |
| `CRON_SECRET` | `openssl rand -base64 32` — a new one |

`BETTER_AUTH_URL` must match the deployed origin exactly or sign-in silently
fails to set a cookie.

Optionally, add `AI_PROVIDER` and its matching keys (see "AI-generated quote"
above) to switch the quote from the static table to a generated one in
production too. Skip it and nothing changes.

**4. Deploy.**

```bash
vercel --prod
```

**5. Point the scheduler at it.** In the GitHub repo, add two secrets under
*Settings → Secrets and variables → Actions*:

| Secret | Value |
|---|---|
| `APP_URL` | your production URL, no trailing slash |
| `CRON_SECRET` | the **same** value you set in Vercel |

Then run the workflow once by hand from the Actions tab to check it. It prints the
sweep result and fails the job on any `>= 400`, which is also your outage alert.

### About `EMAIL_FROM`

`onboarding@resend.dev` needs no domain but **only delivers to the address your own
Resend account is registered under.** That is fine while you are the only user; it
means nobody else can receive anything.

To email real users, verify a domain in Resend and set
`EMAIL_FROM="LockedIn <nag@yourdomain.com>"`.

### Scheduling notes

`.github/workflows/send-daily.yml` runs every 15 minutes and is the real driver.
`vercel.json` also registers a **daily** cron on the same endpoint as a backstop —
safe to have both, because the endpoint sends at most one email per roadmap per
local day no matter how many callers it has.

Vercel's Hobby plan rejects any cron more frequent than daily, which is why the
15-minute cadence lives in Actions. On Pro, set `vercel.json` to `*/15 * * * *`
and delete the workflow; nothing in the app changes. See ARCHITECTURE.md §10.
