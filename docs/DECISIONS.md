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
  well-known constraint for a JS/TS project.
