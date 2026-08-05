# Architecture Decision Records

This log records the significant technical decisions made for LockedIn, and
why, so the reasoning survives past the person who made the call. Entries are
append-only: superseding a decision means adding a new ADR that says so, not
editing the old one.

Format per entry: Status, Context, Decision, Why (for this product
specifically), Alternatives considered, Consequences.

---

## ADR-001: Frontend framework & language — Next.js 15, React 19, TypeScript

- **Status:** Accepted (locked for MVP)
- **Context:** MVP needs auth, a few CRUD screens (roadmap creation, question
  upload, progress view), and server-side logic to compose and trigger daily
  emails. It's a small full-stack app, not a complex client app or a
  content-heavy marketing site.
- **Decision:** Next.js 15 (App Router) with React 19 and TypeScript
  end-to-end.
- **Why:** A single full-stack framework means no separate backend service
  to stand up for what's fundamentally CRUD plus scheduled email — API
  routes/Server Actions cover it. Server Components keep client JS small for
  screens that are mostly data display and forms. TypeScript end-to-end
  (schema → server → UI) matters because the roadmap/problem/progress data
  model is expected to evolve as future-vision features land, and type
  errors at the boundary are cheaper to catch at compile time than at 2am
  when an email job silently fails. React 19 is simply what Next 15 ships
  with; there's no reason to pin an older React.
- **Alternatives considered:** Separate SPA (React/Vite) + separate API
  service — rejected as unnecessary infrastructure for this scope. Remix —
  comparable fit, but Next.js's deployment story on Vercel (see ADR-007) is
  more direct.
- **Consequences:** Coupled to Vercel's Next.js-first deployment model
  (acceptable, see ADR-007). App Router's server/client component split adds
  a small amount of conceptual overhead for contributors unfamiliar with it.

---

## ADR-002: Styling & UI components — Tailwind CSS, shadcn/ui

- **Status:** Accepted (locked for MVP)
- **Context:** MVP UI is a handful of forms and data views. No dedicated
  designer; needs to look reasonable without hand-rolling a component
  library or CSS architecture from scratch.
- **Decision:** Tailwind CSS for styling, shadcn/ui for base components.
- **Why:** Tailwind lets UI ship fast without maintaining separate CSS
  files or a naming convention for classes. shadcn/ui components are
  copy-in, not an installed dependency — they land in the repo as owned
  code, so they can be freely modified as the product's design changes post-
  MVP without fighting a component library's API or waiting on upstream
  releases. Both are the default, well-documented pairing with Next.js,
  minimizing setup friction.
- **Alternatives considered:** A full component library (MUI, Chakra) —
  rejected because it fights customization once the product has its own
  identity, and pulls in more than an MVP needs. Plain CSS/CSS Modules —
  rejected as slower to iterate with for a small team.
- **Consequences:** shadcn components live in-repo, so upgrading them is a
  manual re-copy rather than a version bump — an acceptable tradeoff for the
  control it buys.

---

## ADR-003: Data layer — Prisma + Neon Postgres

- **Status:** Accepted (locked for MVP)
- **Context:** Core data is relational: users, roadmaps, problems, and
  progress records with clear foreign-key relationships between them.
  Deployment target is Vercel's serverless functions.
- **Decision:** Prisma as the ORM, Neon (serverless Postgres) as the
  database.
- **Why:** The data is relational by nature (a roadmap has many problems,
  progress rows reference both a user and a problem) — Postgres is a better
  fit than a document store here. Prisma's generated types match the
  TypeScript-everywhere approach from ADR-001, so schema changes surface as
  compile errors in the app code that consumes them. Neon's serverless
  driver is built for exactly the connection-churn pattern of serverless
  functions (no connection-pool exhaustion the way a plain long-lived
  Postgres driver would hit on Vercel), and Neon's branching model lets each
  preview deployment get its own throwaway DB branch. Scale-to-zero pricing
  fits a pre-revenue MVP.
- **Alternatives considered:** Supabase — comparable Postgres offering, but
  Neon's branch-per-preview-deploy model integrates more directly with
  Vercel's PR preview workflow. A raw `pg` driver without an ORM — rejected;
  loses the type-safety benefit that matters as the schema grows toward the
  future-vision features.
- **Consequences:** Schema changes go through Prisma migrations, which is
  an extra step but keeps the DB and the type system from drifting apart.

---

## ADR-004: Authentication — Better Auth

- **Status:** Accepted (locked for MVP)
- **Context:** MVP needs sign-in. Future versions will likely want to join
  user identity with roadmap/progress data for analytics, and may add OAuth
  providers later.
- **Decision:** Better Auth, backed by the same Postgres database via
  Prisma.
- **Why:** Better Auth is TypeScript-native and integrates with Prisma
  directly, so user records live in the same database as roadmap/progress
  data instead of a third-party auth silo — this matters once analytics
  (future vision) needs to join across those tables. It's self-hosted with
  no per-monthly-active-user pricing, which suits a pre-revenue product.
  It's also not locked to a single framework, avoiding lock-in if the
  frontend framework choice ever needs to change.
- **Alternatives considered:** Clerk/Auth0 — rejected primarily because
  user data would live outside the product's own database, complicating
  future cross-table analytics and adding per-MAU cost as the user base
  grows. NextAuth/Auth.js — viable, but Better Auth's Prisma-first adapter
  and more explicit session/data model were a better fit for this data
  layer.
- **Consequences:** Fewer built-in provider integrations out of the box
  than Clerk/Auth0; acceptable since MVP only needs basic sign-in.

---

## ADR-005: Transactional email — Resend

- **Status:** Accepted (locked for MVP)
- **Context:** The MVP's core deliverable *is* a daily email. It has to
  actually land in the inbox, and the templates need to be maintainable.
- **Decision:** Resend as the email delivery API.
- **Why:** The daily email is the product, so deliverability and API
  simplicity are not negotiable. Resend's first-class support for React
  Email means email templates are written as JSX components, consistent
  with the rest of the React/Next.js stack, instead of hand-written HTML
  strings. Its free tier is generous enough for a pre-revenue MVP's volume.
- **Alternatives considered:** SendGrid/Postmark — comparable
  deliverability, but neither has Resend's native React Email integration,
  which matters given how central the email template is to this product.
- **Consequences:** Vendor dependency for the product's single most
  important feature; mitigated by Resend's API being a thin, swappable
  layer if it ever needs replacing.

---

## ADR-006: Background jobs / scheduling — Inngest (deferred)

- **Status:** Accepted, deferred adoption
- **Context:** Each roadmap has a user-configured daily send-time, so
  "send an email" isn't a single global cron — it's a per-user, per-roadmap
  scheduled trigger, and future channels (WhatsApp, push) will need similar
  scheduling plus retry/backoff logic.
- **Decision:** Inngest is the intended tool for durable, per-user scheduled
  sends, but is **not** required for MVP launch. The MVP can ship with a
  simpler mechanism — e.g. a single Vercel Cron running on a short interval
  that queries "which roadmaps need an email in this window" — and adopt
  Inngest when scheduling/retry needs outgrow that.
- **Why:** Inngest is purpose-built for "durable function triggered on a
  schedule or event, with retries and step functions," which is exactly the
  shape of per-user email scheduling plus the eventual multi-channel,
  multi-step notification flows in the future vision. It deploys alongside
  Vercel functions without standing up separate infrastructure (no queue or
  worker fleet to run). Recording the decision now — even though adoption
  is deferred — so the rationale isn't lost when the simple cron approach
  starts to strain.
- **Alternatives considered:** A hand-rolled queue (e.g. Postgres-backed job
  table polled by cron) — this is effectively what the MVP does initially;
  Inngest is the upgrade path once retry/backoff/step-orchestration
  complexity justifies it. Generic job queues (BullMQ + Redis) — rejected
  because they require running and operating a separate worker process,
  which conflicts with staying on Vercel's serverless model.
- **Consequences:** MVP scheduling is intentionally simple and coarse
  (interval-polling cron); this ADR exists so that migrating to Inngest
  later is a planned upgrade, not a scramble.

---

## ADR-007: Hosting & deployment — Vercel

- **Status:** Accepted (locked for MVP)
- **Context:** Small team, needs low-overhead deployment, preview
  environments for review, and cron support for the daily email trigger.
- **Decision:** Vercel as the hosting/deployment platform.
- **Why:** Same platform as Next.js's origin, so deploys are effectively
  zero-config. Per-PR preview deployments pair naturally with Neon's
  per-branch database previews (ADR-003). Built-in Vercel Cron covers the
  MVP's interval-polling email trigger (ADR-006) without extra
  infrastructure. Least amount of infra to operate for a small team.
- **Alternatives considered:** Self-hosted (Docker on a VPS) — rejected;
  adds operational burden (deploys, TLS, scaling) with no benefit at this
  stage. Netlify/Railway — viable, but neither matches Vercel's tightness
  with Next.js and Neon specifically.
- **Consequences:** Coupled to Vercel's serverless execution model
  (function duration/memory limits), which already shaped the scheduling
  approach in ADR-006.

---

## ADR-008: Package manager — pnpm

- **Status:** Accepted (locked for MVP)
- **Context:** Standard JS/TS tooling choice, made once for the whole repo.
- **Decision:** pnpm.
- **Why:** Faster installs and a disk-efficient content-addressable store
  compared to npm/yarn. Its strict dependency resolution surfaces phantom
  dependencies (code silently relying on a transitive package) at install
  time rather than as a surprise later — worth the hygiene as the project
  grows toward the future-vision feature set.
- **Alternatives considered:** npm — the safe default, but no real
  advantage over pnpm here. Yarn (Berry/PnP) — comparable but adds PnP
  compatibility friction with some tooling.
- **Consequences:** Contributors need pnpm installed locally; a minor,
  well-known constraint for a JS/TS project. Note that pnpm 11 requires Node
  22.13+, so the repo pins pnpm 10 via `packageManager` to stay usable on Node 20.

---

## ADR-009: n8n rejected as the scheduling and notification layer

- **Status:** Accepted (rejected alternative)
- **Context:** ADR-006 chose a Vercel Cron polling loop now and Inngest later,
  but never recorded why a workflow-automation tool was not used instead. n8n is
  the most obvious such tool and the question came up, so the reasoning is
  written down here rather than re-litigated later.
- **Decision:** n8n is **not** used for scheduling or for composing/sending the
  daily email. It remains a reasonable option as an *integration layer the app
  calls* for future third-party channels, and as a throwaway tool for validating
  the nag loop before building anything.
- **Why (for this product specifically):**
  - **It only covers one of the MVP's features.** n8n can do "cron → query →
    compose → send". It cannot do sign-in, create roadmap, upload questions,
    configure, view progress, or mark complete. So it is not an alternative to
    the Next.js app — it is a second system alongside it, which inverts ADR-007's
    reason for choosing Vercel ("least infra to operate").
  - **It breaks the type chain ADR-001 and ADR-003 were chosen for.** Problem
    selection, progress maths and quota logic are domain rules. In n8n they live
    in visual nodes and inline JS, outside TypeScript and outside Prisma's
    generated types. Rename a column and the app fails to compile while the n8n
    workflow keeps running and sends a broken email at 07:00 — the exact failure
    mode ADR-001 names.
  - **It defeats ADR-005's rationale.** Resend was chosen so the template is JSX
    in the repo. n8n sending the mail means either hand-maintained HTML in a node
    or calling back into the app to render — at which point the app is doing the
    work anyway.
  - **No preview environment.** ADR-003 and ADR-007 pair Neon branches with
    per-PR previews. n8n workflows are JSON in n8n's own database; there is no
    per-PR preview and diffing a workflow in review is materially worse than
    diffing a function.
- **Alternatives considered:** n8n owning only the schedule, with the app
  rendering and sending — still needs n8n hosted and still splits "when" from
  "what". Rejected. n8n as an integration layer behind `NotificationChannel` for
  WhatsApp/Twitter later — **not rejected**; its prebuilt connectors are a genuine
  saving, and that placement respects the seam.
- **Consequences:** Scheduling stays in the app, which is where the type safety
  and the tests are. If a future channel needs awkward third-party glue, n8n can
  sit behind the notification seam without revisiting this decision. Note n8n is
  under the Sustainable Use License, not an OSI-approved licence — fine for the
  internal uses above, worth knowing before it becomes load-bearing.

---

## ADR-010: Design system — Blueprint aesthetic, with a specified palette

- **Status:** Accepted (locked for MVP)
- **Context:** ADR-002 chose Tailwind and shadcn/ui without settling on a visual
  language. A technical/academic aesthetic was chosen, and a four-colour palette
  was specified externally: `#08CB00`, `#253900`, `#000000`, `#EEEEEE`. The
  requirement was explicit: do not hardcode colours, keep them configurable.
- **Decision:** The Blueprint aesthetic — radius 0, hard offset shadows never
  blurred, VT323 headings, Source Serif 4 body, JetBrains Mono for technical text
  — with the specified palette as the only colour source. `src/styles/tokens.css`
  holds those four values and derives everything else with `color-mix()`;
  `scripts/check-tokens.sh` fails the build on a hex literal anywhere else.
  **shadcn/ui adoption is deferred**, following the same "accepted, deferred"
  pattern as ADR-006.
- **Why:** Retheming has to mean editing four values in one file, which only
  holds if the rule is enforced rather than remembered — hence the grep guard,
  which is verified in both directions. shadcn is deferred because the MVP's
  frontend is a throwaway harness for driving the API; a component library is
  worth adopting when the real UI is built, and ADR-002's reasoning for choosing
  it still stands then.
- **Two deliberate deviations from stock Blueprint**, both because the palette
  was specified: the accent is green rather than blueprint blue, and the dark
  background is pure black rather than `#0a0d1a`.
- **One accessibility constraint the palette forces.** `#08CB00` on `#EEEEEE`
  measures **1.88:1**, far below the 4.5:1 text minimum. The accent is therefore
  split by role: `--accent` is text-safe per theme (olive on light, green on
  dark) and `--accent-vivid` is the brand green restricted to fills, borders and
  status dots. `tests/unit/palette.test.ts` reads `tokens.css` rather than
  restating values and asserts the split holds; it caught a real contrast bug on
  its first run.
- **Alternatives considered:** Using the green uniformly — rejected, it is
  unreadable as text on the light background. Adding a fifth muted grey —
  rejected, secondary text uses the olive instead so the palette stays at four.
  Adopting shadcn now — rejected as premature for a harness.
- **Consequences:** A second file, `src/styles/palette.ts`, is also permitted hex,
  because email clients support neither `var()` nor `color-mix()`. A test pins the
  two representations together so they cannot drift.

---

## ADR-011: Pacing — rate-based, recomputed at send time, nothing persisted

- **Status:** Accepted (locked for MVP)
- **Context:** ROADMAP feature 5 says a daily email arrives per roadmap, but not
  what it contains when the user falls behind. Three shapes were considered:
  a fixed calendar schedule assigned at creation, a "next unsolved" queue, and a
  rate-based quota.
- **Decision:** Rate-based: `ceil(remaining / daysLeft)` with `daysLeft`
  inclusive of today, floored at 1 once the end date passes and capped at 5.
  **Computed on every send; nothing is persisted.** No schedule table, no item is
  ever assigned to a date. `endDate` is a goal rather than a wall — nagging
  continues past it until every item is done.
- **Why:** Because nothing is precomputed, `startDate`, `endDate` and the item
  list stay freely editable and the next email simply reflects current state.
  Persisting a schedule would mean invalidating and rebuilding it on every edit.
  The `remaining / daysLeft` form spreads a deficit over the whole remaining
  period, so ignoring the email for four days raises the daily load from 1 to 2
  rather than presenting a punishing catch-up bill.
- **Alternatives considered:** A cumulative pace line
  (`ceil(total × elapsed / totalDays) − completed`) — mathematically tidier and
  never lets debt accumulate silently, but a four-day lapse produces a six-problem
  email, which reads as punishment. Rejected. A fixed schedule — rejected because
  editing dates would require rebuilding it. A next-unsolved queue — rejected as
  too forgiving; it makes falling behind invisible.
- **Consequences:** The daily email carries a **list**, not one problem, which
  changed ROADMAP feature 5. The cap of 5 exists because a twenty-problem email is
  noise rather than a nudge, and it means `SendLog.itemCount` is the only
  historical record of what the engine decided on a given day. `computeDailyQuota`
  takes no `cap` parameter: nothing in the schema configures it, so an overridable
  argument would be a knob with no caller.

---

## ADR-012: Email templates as JSX, without a component library

- **Status:** Accepted (amends the mechanism of ADR-005, not its choice)
- **Context:** ADR-005 chose Resend specifically for "first-class support for
  React Email … templates written as JSX components". When the template came to
  be built, `@react-email/components` was marked deprecated on npm with no
  successor named.
- **Decision:** Keep Resend and keep the template as JSX in the repo. Drop
  `@react-email/components`. Render with `renderToStaticMarkup` from
  `react-dom/server.edge` into an email-safe nested table with inline styles.
- **Why:** ADR-005's stated rationale is that templates are JSX in the repo,
  consistent with the rest of the stack — that is preserved. Only the library is
  gone. The layout is one centred column and a list, which a nested table covers
  in every client, so the library's main value (working around client quirks in
  complex layouts) does not apply. Dropping it removes a deprecated dependency and
  roughly thirty transitive packages. `renderToStaticMarkup` escapes text
  content, so a problem title containing markup cannot inject into the email —
  there is a test for that.
- **Alternatives considered:** Keeping the deprecated package — rejected; a
  dependency with no support and no named successor is a liability in the one
  feature that *is* the product. Hand-writing HTML template strings — rejected;
  it loses JSX and requires hand-rolled escaping, which is exactly where an
  injection bug would hide. Migrating to another email component library —
  rejected as disproportionate for this layout.
- **Consequences:** The import is `react-dom/server.edge` rather than
  `react-dom/server`, because Next's App Router build refuses the bare specifier
  on the reasonable assumption that it signals a mis-rendered component. A comment
  at the import records why. If the email ever grows into a complex layout, this
  decision is worth revisiting.

---

## ADR-013: Send protocol — claim before send, release on failure, idempotency key

- **Status:** Accepted (locked for MVP)
- **Context:** The cron polls every 15 minutes and due-ness deliberately stays
  true for the rest of the roadmap's local day, so the sweep will consider the
  same roadmap up to 96 times. `SendLog` with `UNIQUE(roadmapId, localDate)`
  prevents repeats, but *when* the row is written turns out to matter more than
  that it exists. ARCHITECTURE.md names duplicate emails as this product's most
  likely public embarrassment.
- **Decision:** Three parts, and all three are load-bearing:
  1. **Claim before sending.** `recordSend` runs first; losing the insert means
     another invocation owns the day and this one skips.
  2. **Release on failure.** If `channel.send` rejects, the claim is deleted so a
     later tick that day retries.
  3. **Every send carries `sentKey(roadmapId, localDate)` as an idempotency key**,
     which the provider uses to deduplicate.
- **Why:** Each part exists because the previous one opened a hole.
  - Claiming *after* a successful send looks natural and is wrong: two overlapping
    invocations both pass a read-then-write check and both deliver. Claiming first
    makes the unique insert itself the mutual exclusion.
  - Claiming first means a transient provider outage would burn the whole day, so
    the claim has to be released on failure.
  - Releasing on failure reopens duplicate sends by a different route: a rejection
    does **not** prove nothing was delivered. A timeout or connection reset after
    Resend accepted the message throws locally while the email is already on its
    way; the retry then sends a genuine second copy. The idempotency key closes
    that, and it is keyed per roadmap-day so a same-day retry collapses while
    tomorrow's send is untouched.
- **Alternatives considered:** *Classify failures* as clean-versus-ambiguous in
  application code and only release the clean ones — rejected, that is guesswork
  about a network boundary, and getting it wrong is silent either way. *Never
  release*, accepting a lost day per transient failure — simpler and safe against
  duplicates, but it throws away the retry that 96 daily ticks make nearly free.
  *Advisory locks or `SERIALIZABLE`* — rejected as heavier than a unique index for
  a guarantee the index already provides.
- **Consequences:** One residual hole remains and is documented in
  ARCHITECTURE.md §5: if the process dies between the claim and the send
  completing, that user loses that day. It is bounded to one day, and the fix if
  ever needed is a reapable `sentAt`-null claim row rather than a change of
  ordering. `NotificationChannel.send` therefore takes a third `SendContext`
  argument — a delivery identity is channel-agnostic, and any provider worth using
  supports some form of it.

---

## ADR-014: Scheduling — GitHub Actions drives the sweep, Vercel Cron backs it up

- **Status:** Accepted (revisit on Pro, or on the Inngest migration)
- **Context:** ADR-006 chose "a single Vercel Cron running on a short interval"
  and deferred Inngest. On deployment that ran into a hard platform limit:
  Vercel's Hobby plan permits cron jobs **once per day**, and a more frequent
  expression does not degrade — it *fails the deployment outright*.
  A daily-only sweep is not merely coarser, it is broken: due-ness asks "has this
  roadmap's local send time passed?", so a user whose send time falls later in the
  day than the single daily tick is skipped, and is skipped again every subsequent
  day at the same wrong hour. They would never receive an email at all.
- **Decision:** A GitHub Actions scheduled workflow calls the existing
  `/api/cron/send-daily` endpoint every 15 minutes. `vercel.json` keeps a **daily**
  cron pointed at the same endpoint as a backstop. No application code changes.
- **Why:**
  - It preserves the behaviour that is already built and tested. The 15-minute
    cadence is what makes per-roadmap send times meaningful and what makes a
    failed send retry the same day.
  - It is free, and the repository is already on GitHub.
  - Running both schedulers at once is safe *by construction*, not by luck:
    `UNIQUE(roadmapId, localDate)` on `SendLog` means the endpoint sends at most
    one email per roadmap per local day no matter how many callers it has
    (ADR-013). So the backstop costs nothing and cannot double-send.
  - The workflow failing on a `>= 400` response doubles as free monitoring — the
    app answers `503` when every send failed, so GitHub emails on a systemic
    outage.
- **Alternatives considered:** *Vercel Pro* ($20/month) — works with no extra
  moving parts and stays on one platform; rejected only as premature for a
  single-user project, and it remains a one-line change. *Hobby with a daily cron*
  — rejected, it silently breaks send times as described above. *Adopting Inngest
  now* — rejected as disproportionate to ship; still the planned upgrade per
  ADR-006.
- **Consequences:** GitHub's scheduler is best-effort and can run several minutes
  late under load, which is harmless here because due-ness is state-based rather
  than moment-based. The scheduler now lives outside Vercel, so a scheduling
  failure will not appear in Vercel's logs — the Actions run history is the place
  to look. On a private repository these runs consume Actions minutes; roughly
  2,900 short runs a month fits the free allowance, and halving the cadence to 30
  minutes is the dial if it ever does not.
- **Not to be undone:** the endpoint takes no parameters and the caller makes no
  decisions. That is the whole reason this swap was configuration and not a
  rewrite (ARCHITECTURE.md §10). Keep the deciding inside the app.

---

## ADR-015: AI provider seam

- **Status:** Accepted (seam only — nothing calls it yet)
- **Context:** AI/LLM use is coming to this product beyond the MVP — the first
  concrete target is generating the daily email's motivational quote instead of
  picking from the static table in `src/domain/digest.ts`, and `ROADMAP.md`'s
  Future Vision already names AI-generated roadmaps as a real direction. Rather
  than write ad-hoc AI-calling code at the first feature that needs it, this ADR
  builds the seam first, on the same principle `RoadmapSource` already
  demonstrated: `ROADMAP.md`'s constraint that "AI generates the list instead"
  must not require a schema rewrite is exactly the reasoning that should also
  cover "AI generates the quote instead."
- **Decision:** A new outer-layer module, `src/ai/`, mirroring the shape of
  `src/notifications/` and `src/sources/`:
  - `provider.ts` — `AiProvider`, one method: `generateText(prompt: string):
    Promise<string>`.
  - `gateway-provider.ts` — real implementation over the Vercel AI SDK's
    Gateway (`generateText` from the `ai` package). Models are addressed as
    plain strings (`"anthropic/claude-sonnet-5"`), not provider-specific
    imports.
  - `fake-provider.ts` — `FakeAiProvider`, records every prompt, can be told to
    reject.
  - `from-env.ts` — `aiProviderFromEnv()`, returns `AiProvider | null`.
  - `eslint.config.mjs`'s domain-purity rule extends to `@/ai/**` and the `ai`
    package itself, the same way it already covers `resend` and
    `better-auth`.

  This pass adds only these files. `send-daily-digests.ts` still builds its
  digest with `quoteForDate`, unchanged.
- **Why:**
  - **Vercel AI SDK + Gateway over a direct vendor SDK** — same reasoning as
    Resend sitting behind `NotificationChannel`: the interface doesn't know or
    care which model answers it, so a provider or model swap is a config
    change. The Gateway specifically means that swap doesn't even need a new
    SDK import.
  - **`from-env` returns `null` instead of throwing** — `emailChannelFromEnv`
    fails loudly because a missing mail config breaks the product's actual job.
    AI configuration protects nothing yet; there is no call site for it to
    break. Throwing here would make every future caller wrap this in a
    try/catch for no reason — `null` makes "not configured" the same kind of
    ordinary state as "not enabled."
  - **The interface stays one method** — `NotificationChannel` grew a
    `SendContext` parameter only when ADR-013 found a real correctness gap
    that demanded it. Adding tool-calling, message history, or structured
    output to `AiProvider` now, before any caller needs them, would be
    guessing at a shape instead of building one an actual requirement shaped.
- **Alternatives considered:** *Wire the quote generation directly into
  `send-daily-digests.ts`* when that feature is actually built, with no
  separate seam — rejected, because it repeats exactly the mistake
  `RoadmapSource` was written to avoid: building the call site and the AI
  integration as one change means the next AI-backed feature (roadmap
  generation, or whatever agentic work comes after) either duplicates the
  wiring or forces a refactor to extract it. *A direct provider SDK
  (`@ai-sdk/anthropic`)* instead of the Gateway — rejected for now; nothing
  here depends on Anthropic specifically, and the Gateway costs nothing extra
  for the same call.
- **Consequences:** This ADR deliberately leaves one question open rather than
  deciding it by default: when the quote (or any future digest content) is
  actually generated by `AiProvider`, is it generated **once per calendar day
  and shared** across every roadmap sent that day (matching `quoteForDate`'s
  current behaviour, but requiring a small persisted cache so the value
  survives across sweep ticks and cold starts), or **once per roadmap-send**
  (no cache needed, but adds one network call to the per-roadmap cost that
  ARCHITECTURE.md §6 already budgets at ~300ms–1.5s, pulling forward the
  documented ~25-due-and-unsent concurrency trigger). Whoever wires this up
  next should decide and record it here rather than pick implicitly by
  whichever is easiest to write first.

---

## ADR-016: Second AI provider — Sarvam, selected by `AI_PROVIDER`

- **Status:** Accepted
- **Context:** A second `AiProvider` implementation is needed, over Sarvam's
  chat completion API (`sarvamai`'s `SarvamAIClient`, `client.chat.completions`).
  ADR-015 built the seam with exactly one implementation, so this is the first
  real test of whether the interface holds up with two — and of how a caller
  picks between them.
- **Decision:** `src/ai/sarvam-provider.ts` adds `createSarvamProvider(deps: {
  apiKey, model }): AiProvider`, the same factory shape as
  `createGatewayProvider`. `from-env.ts` gains an `AI_PROVIDER` environment
  variable (`"gateway"` | `"sarvam"`) that decides which implementation
  `aiProviderFromEnv()` builds, rather than inferring it from which key
  happens to be set. `eslint.config.mjs`'s domain-purity vendor-SDK group
  extends to `sarvamai`.
- **Why:**
  - **An explicit selector, not an implicit fallback chain.** "Use whichever
    key is present" would mean the provider in use silently changes the
    moment a second key gets added — e.g. a Sarvam key left over from testing
    while Gateway is the intended production provider. `AI_PROVIDER` makes
    the choice a single, greppable value, matching `emailChannelFromEnv`'s
    "one place reads it" model even where `aiProviderFromEnv` otherwise
    departs from that file's fail-loudly shape (ADR-015).
  - **Unset `AI_PROVIDER` is `null`; an unrecognised one throws.** Not
    configured at all stays the ordinary, expected state ADR-015 established.
    A value that doesn't match either implementation is a typo or a stale
    config, not an absence of one, so it fails the way `emailChannelFromEnv`
    fails on a missing secret — immediately and identically, rather than
    silently falling back to the static quote and hiding the mistake.
  - **`model` stays a plain string, cast once at the call site.** The SDK's
    own request type narrows `model` to a three-member literal union
    (`sarvam-105b` | `sarvam-30b` | `sarvam-m`); casting inside
    `sarvam-provider.ts` keeps that SDK-specific type from leaking into
    `from-env.ts` or the `AiProvider` interface, the same reasoning as the
    Gateway provider's model string.
- **Alternatives considered:** *Try each provider in a fixed order, using
  whichever has its key set* — rejected above. *A provider-agnostic
  abstraction library instead of two hand-written implementations* — rejected
  as more machinery than two five-line factories justify.
- **Consequences:** Adding a third provider later repeats this shape: a new
  `create*Provider` factory, one more `if (selected === '...')` branch in
  `from-env.ts`, one more literal added to the vendor-SDK eslint group. If
  that ever grows past two or three branches, revisit the `if` chain — a
  lookup table keyed by provider name would read better at that point, but
  isn't worth it for two.

---

## ADR-017: The daily quote calls `AiProvider`, once per roadmap-send

- **Status:** Accepted (revisit if `S` approaches the §6 concurrency trigger)
- **Context:** ADR-015 built the `AiProvider` seam but deliberately left it
  unconsumed, recording one open question: when the digest's quote is
  generated by a model instead of read from the static table, is that once
  per calendar day (shared across every roadmap, matching the static table's
  current behaviour) or once per roadmap-send. This ADR makes that call and
  wires it up.
- **Decision:** `src/usecases/quote.ts` adds `resolveDailyQuote(provider,
  today)`, called once inside `sendDigestForRoadmap` — i.e. **once per
  roadmap-send**, not once per calendar day. It calls
  `provider.generateText` with a fixed motivational prompt and falls back to
  the existing `quoteForDate` table on a `null` provider, an empty/whitespace
  response, or a thrown error. `buildDigest` (`src/domain/digest.ts`) no
  longer computes the quote itself — it takes `quote: string` directly,
  same as `roadmapName`, `items`, and `progress` — so the domain stays
  unaware of where the quote came from. `sendDailyDigests` and
  `sendDigestForRoadmap` take a new `aiProvider: AiProvider | null = null`
  parameter, defaulted so every existing caller and test keeps compiling
  unchanged; the two production call sites
  (`app/api/cron/send-daily/route.ts`, the harness's `sendNowAction`) pass
  `aiProviderFromEnv()`.
- **Why:**
  - **Per-roadmap-send over a shared per-day cache.** The cached version
    needs a new persisted store (a table, or a column) plus claim logic to
    avoid two concurrent ticks generating two different "quotes of the day" —
    a smaller version of the exact race `SendLog`'s claim-before-send exists
    to prevent (ADR-013). That is real schema and migration work to protect a
    concurrency margin this project is nowhere near spending: §6's own
    trigger for *any* concurrency work is ~25 due-and-unsent roadmaps in a
    15-minute window, a scale this product has not reached. Building the
    cache now would be exactly the kind of pre-emptive work §6 explicitly
    warns against elsewhere in this document.
  - **The static table stays the fallback, not a second code path someone
    forgot about.** `resolveDailyQuote` funnels every non-happy-path
    (unconfigured, empty, throws) through the same `quoteForDate` call
    `buildDigest` used to make internally, so "AI off" and "AI failed" behave
    identically to today, and a Sarvam or Gateway outage degrades to exactly
    what shipped before this ADR rather than to no email at all.
  - **A fixed prompt, not one built per-roadmap.** Nothing about the prompt
    depends on the roadmap's name, progress, or items — it only asks for a
    short, original, varied motivational sentence for someone working
    through LeetCode problems. A roadmap-aware prompt is a real future
    direction (a quote that references *this* roadmap's actual progress) but
    is a separate, unrequested feature, not a requirement of wiring the seam
    up at all.
- **Alternatives considered:** *Once per calendar day, shared* — the
  original default implied by matching `quoteForDate`'s behaviour; rejected
  for now per the concurrency-margin reasoning above, and left as the
  documented next step if `S` grows. *Skip the static-table fallback
  entirely, always call the provider* — rejected: ADR-013 exists precisely
  because an optional dependency failing must never be what blocks the
  product's actual job of sending the email.
- **Consequences:** This measurably changes the per-roadmap cost §6 tracks —
  see the note added there. If the sweep's due-and-unsent count ever
  approaches the documented ~25 trigger while `AI_PROVIDER` is set, the fix is
  the once-per-day cache this ADR declined to build now, not bounded
  concurrency alone — concurrency parallelises the calls, it doesn't reduce
  their count.

---

## ADR-018: One generic `AI_MODEL` / `AI_API_KEY`, not one pair per provider

- **Status:** Accepted
- **Context:** ADR-016 gave each provider its own variable names —
  `AI_GATEWAY_API_KEY`/`AI_MODEL` for Gateway, `SARVAM_API_KEY`/`SARVAM_MODEL`
  for Sarvam — selected by `AI_PROVIDER`. In review, that read as two
  simultaneous credential blocks sitting in one `.env`, and it wasn't obvious
  at a glance that only one is ever active; a first fix made each block's
  comment say explicitly which `AI_PROVIDER` value activates it, but the
  underlying shape — N providers means 2N provider-specific variables,
  n-1 of them always unused — was the actual source of the confusion, not
  the comments describing it.
- **Decision:** Collapse to exactly three variables, all generic:
  `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`. `createGatewayProvider` and
  `createSarvamProvider` already took the same `{ apiKey, model }` shape
  (ADR-016); `createGatewayProvider` is the one change — it now calls
  `createGateway({ apiKey })` from the `ai` package explicitly instead of
  relying on the SDK reading `AI_GATEWAY_API_KEY` from the environment
  itself, so its `apiKey` is injected the same way Sarvam's already was.
  Switching providers means changing all three variables together, in place
  — there is no second block to comment out.
- **Why:**
  - **The variable names were never provider-facing information worth
    keeping.** `AI_MODEL` and `AI_API_KEY` mean the same thing for every
    provider — "the model id" and "the credential" — so a provider prefix
    on the name encoded no information beyond what `AI_PROVIDER` already
    says. Keeping it just meant more names to keep in sync by hand.
  - **This is the more honest shape for "add a provider, make it
    configurable which one" (the actual requirement).** With N
    provider-specific pairs, adding a provider means a new pair of variable
    names *and* remembering the old pair is now dead weight to leave or
    remove. With three generic variables, adding a provider is one new
    `create*Provider` factory and one new `if` branch in `from-env.ts` —
    nothing in `.env` changes shape at all.
  - **Consistent with, not a reversal of, ADR-016's real point.** ADR-016's
    actual decision was the explicit `AI_PROVIDER` selector over an implicit
    "whichever key is present" fallback chain; that stands unchanged. Only
    the variable-naming choice underneath it was wrong.
- **Alternatives considered:** *Keep per-provider variables, just document
  harder* — tried first (clearer comments on which block is active); rejected
  as treating a shape problem as a documentation problem. *A JSON blob env
  var (`AI_CONFIG={"provider":"sarvam",...}`)* — rejected, it trades three
  greppable variables any `.env` tool understands for one that needs parsing,
  for no benefit at this size.
- **Consequences:** A provider whose SDK insists on reading its own
  environment variable internally (rather than accepting an explicit
  `apiKey`, as both current providers do) won't fit this shape without a
  small adapter — cross that bridge if a third provider actually needs it,
  rather than generalising for it now.

---

## ADR-019: Fumadocs pinned below latest, and below its own declared peer range

- **Status:** Accepted (revisit when the app moves to Next.js 16)
- **Context:** A documentation site (`/docs`, `app/docs/**`) was added using
  Fumadocs. Its packages — `fumadocs-ui`, `fumadocs-core`, `fumadocs-mdx` — are
  on a fast-moving major-version cadence, and their latest releases
  (`fumadocs-ui`/`fumadocs-core` 16.x) declare a peer dependency on
  `next: 16.x.x` only. This app is on Next.js 15.5.22 (ADR-001); a Next major
  upgrade is a separate concern from adding a docs page and was out of scope
  here.
- **Decision:** Pin to `fumadocs-ui@15.8.5`, `fumadocs-core@15.8.5`, and
  `fumadocs-mdx@12.0.3` — not `latest`, and not the newest release in
  `fumadocs-mdx`'s own major-version line that claims Next 15 support.
  `fumadocs-ui`/`fumadocs-core@15.8.5` is the last release in the 15.x line
  before it moved to requiring Next 16 (`16.0.0`, published two weeks later).
  `fumadocs-mdx@12.0.3` is the last release published *before*
  `fumadocs-core@16.0.0` and `fumadocs-mdx@13.0.0` shipped together as a
  coordinated cutover, on the same day.
- **Why:**
  - **`fumadocs-mdx`'s peer range is not a reliable compatibility signal.**
    Every `fumadocs-mdx` release from `13.0.0` through the current `15.2.2`
    declares `peerDependencies.fumadocs-core: '^16.7.0'` — correctly reflecting
    that it needs Next 16-era `fumadocs-core`. But `14.3.2` specifically was
    tried first, on the theory that its `next: '^15.3.0 || ^16.0.0'` peer range
    meant Next-15 support; installing it against `fumadocs-core@15.8.5` and
    running the generator crashed with `ERR_MODULE_NOT_FOUND` on
    `fumadocs-core/dist/content/md/frontmatter.js` — a module that was only
    ever added in `fumadocs-core@16.0.0`. The declared `next` peer range was
    real, but it did not imply the `fumadocs-core` internals actually being
    imported were 15.x-compatible. Release timestamps, not declared peer
    ranges, were what actually located a working combination:
    `fumadocs-core@15.8.5` (2025-10-08) and `fumadocs-mdx@12.0.3` (2025-10-06)
    are from before the coordinated `16.0.0`/`13.0.0` cutover
    (both 2025-10-22); everything after that date assumes the new core.
  - **This also means the newer "collections" import convention doesn't
    apply.** `fumadocs-mdx@14`+ generates multiple entry files under
    `.source/`, imported via a `collections/*` path alias (`import { docs }
    from 'collections/server'`) — this is what upstream's current manual-
    installation guide shows. `fumadocs-mdx@12.0.3` predates that change: it
    generates a single `.source/index.ts` barrel, imported directly
    (`app/docs/source.ts` does `import { docs } from '../../.source'`). A
    `@/.source`-style alias was not an option either way — `@/*` in this
    repo's `tsconfig.json` already means `./src/*` (ADR-001's TypeScript
    path convention), so the relative import avoids colliding with it rather
    than introducing a second meaning for `@/`.
  - **Package-manager warnings about newer versions being available are
    expected here and should not be "fixed"** by bumping `fumadocs-mdx` back
    up — that is precisely the direction that reintroduces the
    `fumadocs-core@16.x`-only import.
- **Alternatives considered:** *Upgrade the app to Next.js 16* so `latest` of
  everything could be used — rejected as out of scope for adding a docs page;
  it is a real upgrade with its own testing surface (see ADR-001, ADR-007) and
  deserves its own change. *Use `fumadocs-mdx@14.3.2` or `15.2.2`* against a
  pinned `fumadocs-core@15.8.5`, accepting the peer-range mismatch as a
  harmless warning — rejected once shown to be a runtime crash, not a warning.
- **Consequences:** Bumping any of the three Fumadocs packages independently
  risks reintroducing this break; they should be upgraded together, and only
  as part of (or after) a Next.js 16 upgrade. Until then, `pnpm outdated`
  correctly showing newer versions available for all three is expected and
  not a signal to update. The next person to touch this should re-derive the
  compatible triple from package registry release timestamps the same way,
  rather than trusting peer-range declarations alone.

---

## ADR-020: Migrations run in the production build, over a direct connection

- **Status:** Accepted (revisit if Preview gets its own Neon branch)
- **Context:** Changing the schema was two steps — commit the migration, then
  apply it to production — and only the first was automatic. `pnpm db:deploy`
  existed but nothing called it: `build` was `prisma generate && next build`, and
  `generate` only writes TypeScript types, it never touches a database.
  `vercel.json` had crons and no build hook, and no workflow ran it either. The
  README documented applying migrations by hand.

  That failure mode is unusually bad for this product. It surfaces at runtime as
  a 500 rather than at build time, so the deploy looks green; and the daily sweep
  fails the same way but **silently**, because no user is watching a page when
  cron runs. Nobody finds out until someone notices their email never arrived —
  in a product whose entire job is sending that email.

  Compounding it, `prisma/schema.prisma` declared a single `url`, so the app and
  migrations shared one connection string. Neon exposes two addresses for the
  same database: pooled (host contains `-pooler`) for the many short-lived
  connections serverless functions create, and direct for schema changes.
  Whichever single value was stored, one of the two jobs was using the wrong one
  — migrations hanging on locks PgBouncer cannot hold, or the app exhausting
  Neon's connection limit, which is the very failure ADR-003 cites as the reason
  for choosing Neon.
- **Decision:** Three parts, and all three are load-bearing:
  1. **Two connection strings.** The datasource declares `url = env("DATABASE_URL")`
     (pooled — the running app) and `directUrl = env("DIRECT_URL")` (direct —
     migrations). Prisma routes migration commands to `directUrl` automatically.
  2. **`build` applies migrations first**, via `scripts/migrate-on-deploy.sh`, so
     shipping code and reshaping the database are one step rather than two.
  3. **That script only migrates when `VERCEL_ENV=production`**, and fails
     loudly if `DIRECT_URL` is missing rather than falling back to the pooler.
- **Why:**
  - **The guard is what makes part 2 safe at all.** Preview deployments run the
    build too, and this project's Preview environment points at the *production*
    database. Unguarded, opening a pull request would apply that branch's
    half-finished migration to production data. Guarding on `VERCEL_ENV` is not
    a refinement of the build hook — without it the build hook is unshippable.
  - **The same guard is why CI keeps working.** Neither a local build nor CI
    sets `VERCEL_ENV`, so both take the early exit and never touch a database.
    This is what let the migrate step live in `build` itself. The alternative —
    a separate `vercel-build` script, which Vercel prefers over `build` — was
    considered first and rejected: it splits one pipeline into two code paths
    that can drift, and it leans on a platform naming convention where an
    explicit environment check reads plainly.
  - **`migrate deploy` is safe to run on every production deploy.** It applies
    only migrations already committed to git, never prompts, never generates, and
    never resets on drift — it fails the build instead. A deploy with nothing
    pending is a no-op.
  - **Failing on a missing `DIRECT_URL` beats defaulting to `DATABASE_URL`.**
    A silent fallback would run migrations through PgBouncer, which is the
    original bug wearing a disguise, and it would do so at the one moment nobody
    is watching closely.
- **Alternatives considered:** *A GitHub Actions job on push to `main`* running
  `pnpm db:deploy` — works, and keeps migrations out of the build entirely, but
  adds a second place for the direct connection string to live and a second
  system to keep in step with deploys. Rejected as more moving parts for the same
  guarantee. *Giving Preview its own Neon branch* and migrating on every
  environment — the better end state, and what ADR-003 already assumes, but it is
  infrastructure work that this decision should not block on; the guard makes the
  current shared-database setup safe today and stays correct afterwards.
  *Continuing to apply migrations by hand* — rejected; it is precisely the step
  that gets skipped, and the cost of skipping it is a silent outage.
- **Consequences:**
  - **A Preview deploy of a branch carrying a new migration will break**, because
    Preview shares the production database and does not migrate it. That is the
    intended trade: a loudly broken preview is strictly better than quietly
    reshaped production data. Giving Preview its own Neon branch is what removes
    the sharp edge, and is the documented follow-up.
  - **`DIRECT_URL` must now exist everywhere Prisma runs a migration command.**
    It is not optional: with `directUrl` declared, `prisma migrate deploy` fails
    schema validation outright when the variable is unset. `prisma generate` is
    unaffected — it resolves the datasource without needing the value.
  - **The test suite overrides both variables, not just `DATABASE_URL`.**
    `tests/helpers/global-setup.ts` sets `DIRECT_URL` to the test database as
    well, because migrations read `directUrl`; overriding only `DATABASE_URL`
    would have pointed them at whatever `DIRECT_URL` held — in a normal `.env`,
    the development database — and silently migrated the wrong one.
