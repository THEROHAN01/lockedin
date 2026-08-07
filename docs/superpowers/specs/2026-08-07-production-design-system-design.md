# Production design system rebuild

Status: approved
Date: 2026-08-07

## Problem

The current UI (`src/styles/tokens.css` + `src/styles/base.css`, the
"Blueprint" system: VT323 headings, serif body, sharp corners, hard-offset
shadows) is explicitly documented in its own source as a stopgap — "a test
harness, not the product UI." Every product page (sign-in, sign-up, roadmap
list, roadmap detail) is bare forms and lists with no real component layer,
no confirm step on the one destructive action, no optimistic feedback on the
most-clicked action (mark solved), and no landing page for signed-out
visitors.

Goal: a production-grade UI in the register of Vercel / Dub / Cal.com —
neutral grays, one confident accent, soft shadows, real corner radius, sans
typography, an installed component primitive layer, and the interaction
details (debouncing, optimistic updates, loading/empty/error states) those
products are known for.

## Decisions

- **Full replacement, not a layer on top.** Blueprint's tokens, base.css, and
  `.lk-*` classes are deleted from product routes. `/docs` (Fumadocs) is
  unaffected — its CSS already lives in an isolated boundary
  (`src/styles/docs.css`, imported only under `app/docs/`), untouched by this
  work.
- **Styling: Tailwind v4**, already a dependency and already wired via
  `@theme inline` in `app/globals.css`. No new build tooling.
- **Components: shadcn/ui** (Radix primitives + Tailwind), New York style.
  Installed fresh (`components.json` does not yet exist).
- **Accent stays brand green** (`--lk-green` / `--lk-olive`), re-derived
  against a true neutral gray scale rather than color-mixed from pure
  black/paper.
- **Landing page added** at `/` for signed-out visitors (today it's a bare
  redirect). Signed-in visitors still redirect straight to `/roadmaps`.
- **Scope: 6 pages total** — landing, sign-in, sign-up, roadmap list, roadmap
  detail, plus the shared app shell (top nav) used by the authenticated pages.

## Tokens

Replace the four-value Blueprint palette with:

- **Neutral scale**: gray-50 through gray-950, real values (not
  `color-mix()` from `#000`/`#eee`), used for backgrounds, surfaces, borders,
  and text at every elevation.
- **Accent**: keep `--lk-green` (`#08cb00`) and `--lk-olive` (`#253900`) as
  the two accent source values, re-derived against the new neutral scale for
  AA/AAA contrast in both themes (same discipline as today: vivid green
  never used as text on light backgrounds).
- **Radius**: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px).
  Replaces the current `border-radius: 0` reset.
- **Shadows**: soft, layered, low-opacity black (`shadow-sm/md/lg`) — no hard
  offsets.
- **Typography**: Geist (or Inter as fallback) for headings and UI text,
  replacing VT323 + Source Serif 4. Monospace (JetBrains Mono, kept) is
  reserved for genuinely technical strings — timestamps, IDs — not labels or
  body copy.
- **Motion**: one shared scale, 150–250ms, ease-out, reused by every
  transition/animation rather than ad hoc per-component values.
- **Layout**: introduce a proper app shell — slim top nav (wordmark, theme
  toggle, sign out) — instead of the per-page ad hoc header markup that
  exists today on the roadmap list page only.

`src/styles/palette.ts` (the email-template mirror) and its pinning test are
updated to match the new source values; `scripts/check-tokens.sh` continues
to enforce that hex literals live only in `tokens.css`/`palette.ts`.

## Components (shadcn/ui)

Installed based on actual usage across the 6 pages, no speculative
additions:

| Component | Used for |
|---|---|
| `Button` | All actions. Variants: default, outline, ghost, destructive. |
| `Input` / `Label` | Auth forms, roadmap name/dates/time, timezone field. |
| `Textarea` | CSV paste box. |
| `Card` | Roadmap list items, page sections on roadmap detail. |
| `Progress` | Roadmap completion percentage. |
| `Badge` | Difficulty tag, roadmap status (active/archived), "done" marker. |
| `Separator` | Section dividers (replacing bare `<hr>`). |
| `Alert` | Inline error banners, sweep-result banner. |
| `AlertDialog` | Confirm step before archiving a roadmap (new — today it's a single click with no confirmation, which is wrong for a state change that stops all nagging). |
| `DropdownMenu` | Per-roadmap overflow actions on the list page. |
| `Sonner` (toast) | Transient success feedback (e.g. "Problems appended", "Roadmap saved") — replacing the current `?sweep=` query-string banner for non-error, non-persistent feedback. Validation and persistent errors stay inline on the field/form, not in a toast. |

`SubmitButton` (`app/submit-button.tsx`) is rebuilt on top of shadcn's
`Button` but keeps its exact existing contract — `useFormStatus`,
`pendingLabel` prop, disabled-while-pending, `aria-busy`. That mechanism is
correct today (ARCHITECTURE.md's reasoning for why it's a small client
island still holds); only its visual skin changes.

## Interaction / performance details

- **Optimistic mark-solved.** The single most-clicked action gets
  `useOptimistic` so the checkbox/row updates instantly instead of waiting on
  the Server Action round trip, with rollback on failure. This is the one
  new client-side interaction pattern in the app.
- **Debounced/deferred filtering.** The roadmap list gains client-side status
  filtering (active/archived); the filter input uses `useDeferredValue` so
  typing/toggling doesn't force a full re-render of the list on every
  keystroke. This is the only place in the app where a high-frequency input
  event exists today, so it's the only place debouncing is warranted — no
  speculative debouncing added elsewhere.
- **No unnecessary client components.** Pages stay React Server Components.
  The client-island set stays small and explicit: `ThemeToggle`,
  `SubmitButton`, `TimezoneField`, the new mark-solved control, and the new
  roadmap list filter. No page-wide `'use client'` conversions.
- **Radix primitives** (via shadcn) bring correct focus management, keyboard
  nav, and ARIA out of the box for `Dialog`/`DropdownMenu`/`Toast` — not
  hand-rolled.

## Pages

1. **Landing (`/`)** — new. Hero, one-line product pitch, CTA to sign in.
   Only rendered for signed-out visitors; signed-in still redirects straight
   to `/roadmaps` (existing behavior preserved for that case).
2. **Sign in / Sign up** — same fields and Server Actions as today
   (`signInAction`, `signUpAction`), rebuilt with shadcn form components, a
   centered card layout, inline field errors.
3. **Roadmap list** — app shell nav replaces the current inline header;
   roadmap cards use `Card` + `Badge` + `DropdownMenu`; new client-side
   status filter (see above); create-roadmap form unchanged in fields and
   action, restyled.
4. **Roadmap detail** — same sections and Server Actions as today (progress,
   problem list, CSV upload, reschedule, dev-only send-now), restyled with
   `Card`/`Progress`/`Badge`/`Separator`; mark-solved becomes optimistic;
   archive becomes an `AlertDialog`-confirmed action reached from the list
   page's overflow menu (not duplicated on the detail page).

No data model, Server Action, or route changes — this is a presentation-layer
rebuild only. Every existing usecase/action signature is reused as-is.

## Testing

No new unit/integration test obligations beyond what already exists — this
is a visual/presentation change with the same Server Actions underneath.
`tests/unit/palette.test.ts` (tokens.css ↔ palette.ts pinning) is updated for
the new source values, not removed. `pnpm lint:tokens` must continue to pass
unmodified — no new hex literals introduced outside `tokens.css`/`palette.ts`.
Manual verification: exercise sign-up → sign-in → create roadmap → upload
CSV → mark solved → archive/unarchive → theme toggle, in both light and dark,
at 375px and desktop widths, via the `run` skill against the dev server.
