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
