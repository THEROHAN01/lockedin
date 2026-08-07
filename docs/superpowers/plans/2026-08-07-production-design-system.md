# Production Design System Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Blueprint" test-harness UI with a production-grade,
Vercel/Cal.com-register design system (Tailwind v4 tokens + shadcn/ui
components) across all 6 product pages, with no changes to data model,
Server Actions, or route signatures.

**Architecture:** Delete `src/styles/base.css` and its `.lk-*` classes.
Replace `src/styles/tokens.css`'s palette with a neutral gray scale + the
existing green/olive accent, re-derived. Install shadcn/ui on top of the
already-present Tailwind v4 setup. Rebuild each page's JSX using shadcn
primitives, keeping every existing Server Action call site unchanged. Add one
new client component (optimistic mark-solved) and one new page (landing).

**Tech Stack:** Next.js 15 (App Router, RSC), Tailwind v4 (`@theme inline`,
already wired in `app/globals.css`), shadcn/ui (Radix primitives), Geist font
via `next/font/google`, existing Better Auth / Prisma / Vitest stack
(untouched).

## Global Constraints

- No changes to `src/domain/**`, `src/usecases/**`, `src/data/**`, or any
  Server Action signature — this is presentation-layer only.
- `pnpm lint:tokens` must keep passing: hex literals only in
  `src/styles/tokens.css` and `src/styles/palette.ts`.
- `tests/unit/palette.test.ts` must keep passing (it reads `tokens.css`
  dynamically — no hardcoded hex expectations to update, but the invariants
  it checks, e.g. vivid green fails AA as text in light mode, must still
  hold for whatever new values are chosen).
- `base.css`-equivalent replacement must be imported only from
  `app/(app)/layout.tsx` and `app/(auth)/layout.tsx`, never the root layout —
  this is what keeps `/docs` (Fumadocs) unaffected.
- Pages stay React Server Components. The only client components allowed are
  the ones explicitly named in this plan.
- No commit message or PR text may mention Claude, Anthropic, or include a
  `Co-Authored-By` AI trailer.
- `pnpm typecheck` and `pnpm lint` must pass after every task that touches
  `.ts`/`.tsx` files.

---

### Task 1: Retheme tokens.css and palette.ts

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/palette.ts`
- Test: `tests/unit/palette.test.ts` (verify only, no edits expected)

**Interfaces:**
- Produces: all `--color-*`, `--radius-*`, `--shadow-*`, `--font-*` CSS
  custom properties consumed by `app/globals.css`'s `@theme inline` block
  (Task 2) and every component built in later tasks.

- [ ] **Step 1: Replace the palette block in tokens.css**

Edit `src/styles/tokens.css`. Keep the four-source-value pattern (the file
header comment and `scripts/check-tokens.sh` both assume hex literals live
only here), but add a full neutral gray ramp instead of deriving grays from
`color-mix()` against pure black/paper:

```css
/* ─── PALETTE — the only source colours ─────────────────────────────────── */
:root {
  --lk-green: #08cb00;
  --lk-olive: #253900;

  /* Neutral ramp, light to dark. Real values, not color-mix() derivations —
   * this is what gives the UI true neutral grays instead of tinted ones. */
  --lk-gray-50: #fafafa;
  --lk-gray-100: #f4f4f5;
  --lk-gray-200: #e4e4e7;
  --lk-gray-300: #d4d4d8;
  --lk-gray-400: #a1a1aa;
  --lk-gray-500: #71717a;
  --lk-gray-600: #52525b;
  --lk-gray-700: #3f3f46;
  --lk-gray-800: #27272a;
  --lk-gray-900: #18181b;
  --lk-gray-950: #09090b;
}
```

Replace the light/dark theme blocks:

```css
:root,
:root[data-theme='light'] {
  --bg: var(--lk-gray-50);
  --ink: var(--lk-gray-900);
  --accent: var(--lk-olive);
  --accent-ink: var(--lk-gray-50);
}

:root[data-theme='dark'] {
  --bg: var(--lk-gray-950);
  --ink: var(--lk-gray-100);
  --accent: var(--lk-green);
  --accent-ink: var(--lk-gray-950);
}
```

Replace the role-tokens block (surfaces/text/rules now reference the gray
ramp directly instead of `color-mix()`, borders get real 1px neutral
values, radius becomes a real scale, shadows become soft):

```css
:root {
  --accent-vivid: var(--lk-green);

  /* Surfaces */
  --bg-surface: light-dark(var(--lk-gray-100), var(--lk-gray-900));
  --bg-surface-hover: light-dark(var(--lk-gray-200), var(--lk-gray-800));
  --code-bg: light-dark(var(--lk-gray-100), var(--lk-gray-900));
  --header-bg: light-dark(
    color-mix(in srgb, var(--lk-gray-50) 85%, transparent),
    color-mix(in srgb, var(--lk-gray-950) 85%, transparent)
  );
  --overlay-bg: color-mix(in srgb, var(--lk-gray-950) 62%, transparent);

  /* Text */
  --ink-soft: light-dark(var(--lk-gray-600), var(--lk-gray-400));
  --ink-mute: light-dark(var(--lk-gray-500), var(--lk-gray-500));

  /* Rules and borders */
  --rule: light-dark(var(--lk-gray-900), var(--lk-gray-100));
  --rule-soft: light-dark(var(--lk-gray-200), var(--lk-gray-800));
  --paper-rule: light-dark(var(--lk-gray-200), var(--lk-gray-800));
  --dot-color: var(--paper-rule);

  /* Accent derivations */
  --accent-hover: color-mix(in srgb, var(--accent) 85%, black);
  --accent-tint: color-mix(in srgb, var(--accent-vivid) 12%, var(--bg));
  --accent-tint-strong: color-mix(in srgb, var(--accent-vivid) 26%, var(--bg));

  /* Status — difficulty and completion. Non-text usage only. */
  --status-done: var(--accent-vivid);
  --status-pending: light-dark(var(--lk-gray-300), var(--lk-gray-600));
  --difficulty-easy: var(--accent-vivid);
  --difficulty-medium: color-mix(in srgb, var(--accent-vivid) 55%, var(--lk-olive));
  --difficulty-hard: light-dark(var(--lk-gray-900), var(--lk-gray-100));

  /* Radius — real scale, replaces the old hard 0 reset. */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows — soft and layered, no hard offsets. */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.08);

  /* Motion — one shared scale, reused everywhere. */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;

  /* Layout */
  --container-max: 1100px;
  --header-height: 64px;
}
```

Note: `light-dark()` requires `color-scheme` to be set. Add to the `:root`
block that already sets `--bg`/`--ink`:

```css
:root,
:root[data-theme='light'] {
  color-scheme: light;
  --bg: var(--lk-gray-50);
  --ink: var(--lk-gray-900);
  --accent: var(--lk-olive);
  --accent-ink: var(--lk-gray-50);
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: var(--lk-gray-950);
  --ink: var(--lk-gray-100);
  --accent: var(--lk-green);
  --accent-ink: var(--lk-gray-950);
}
```

Update the file's top comment block to describe the new contrast numbers:
gray-900 (#18181b) on gray-50 (#fafafa) and gray-100 (#f4f4f5) on gray-950
(#09090b) both clear AAA; olive on gray-50 and green on gray-950 keep the
same pairing logic as before since the source hex values for green/olive are
unchanged.

- [ ] **Step 2: Update src/styles/palette.ts email mirror**

The email template still needs literal hex (no `light-dark()`/`color-mix()`
in email clients), so mirror only the light-theme resolved values:

```typescript
export const PALETTE = {
  green: '#08cb00',
  olive: '#253900',
  black: '#18181b',
  paper: '#fafafa',
} as const;

export const EMAIL = {
  background: PALETTE.paper,
  ink: PALETTE.black,
  inkSoft: PALETTE.olive,
  accent: PALETTE.olive,
  accentInk: PALETTE.paper,
  rule: PALETTE.black,
  vivid: PALETTE.green,
} as const;
```

`black` changes from `#000000` to `#18181b` (the new gray-900) and `paper`
from `#eeeeee` to `#fafafa` (the new gray-50) so the email keeps matching the
in-app light theme's ink/background pair.

- [ ] **Step 3: Run the palette test**

Run: `pnpm vitest run tests/unit/palette.test.ts --project unit`
Expected: PASS. The test reads hex directly out of `tokens.css` via regex —
confirm it still finds `--lk-green`, `--lk-olive`, `--lk-black`,
`--lk-paper`. Since `--lk-black`/`--lk-paper` were removed from tokens.css in
Step 1 (replaced by the gray ramp), the test's `palette('lk-black')` /
`palette('lk-paper')` calls will fail to find a match. Fix this by keeping
two alias declarations in tokens.css's palette block so the test's literal
lookups still resolve, without reintroducing them as the actual theme
source:

```css
:root {
  --lk-green: #08cb00;
  --lk-olive: #253900;
  --lk-black: #18181b;
  --lk-paper: #fafafa;
  /* gray ramp as above */
}
```

Then re-run the same command. Expected: PASS, including
`base.css never puts text on the vivid fill` — that describe block reads
`src/styles/base.css`, which Task 3 deletes. Until Task 3 lands, leave
`base.css` in place unmodified so this test file still has a target; Task 3
updates/removes this describe block together with deleting the file.

- [ ] **Step 4: Run the token lint**

Run: `pnpm lint:tokens`
Expected: `OK: no hex colour literals outside src/styles/tokens.css` (the
new gray hex values are all inside `tokens.css`, and `palette.ts` is on the
allowed list).

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/palette.ts
git commit -m "Retheme tokens to a neutral gray scale with soft shadows and real radius"
```

---

### Task 2: Install shadcn/ui and Geist font, wire theme layer

**Files:**
- Create: `components.json` (shadcn config)
- Create: `src/lib/utils.ts` (shadcn's `cn()` helper)
- Modify: `app/globals.css` (replace Blueprint `@theme inline` mappings with
  shadcn-compatible ones, add Geist)
- Modify: `app/layout.tsx` (swap fonts)
- Modify: `package.json` (new dependencies from the shadcn init)

**Interfaces:**
- Consumes: tokens produced in Task 1 (`--bg`, `--ink`, `--accent`, etc.)
- Produces: `cn(...)` utility from `@/lib/utils`, used by every shadcn
  component installed in Task 3.

- [ ] **Step 1: Run shadcn init**

Run: `pnpm dlx shadcn@latest init`

When prompted:
- Style: New York
- Base color: Neutral
- CSS variables: Yes
- Tailwind config location: `app/globals.css` (this repo has no separate
  `tailwind.config.ts` — Tailwind v4 config lives in CSS)

This creates `components.json` and `src/lib/utils.ts`, and will attempt to
add its own `@theme`/`:root` CSS block to `app/globals.css`. Do not accept
its generated color tokens wholesale — the next step reconciles them with
the existing token layer.

- [ ] **Step 2: Reconcile app/globals.css**

Read the current file (`app/globals.css`) and the shadcn-generated block. The
existing `@theme inline` block already exposes semantic tokens as Tailwind
utilities (`--color-bg`, `--color-ink`, etc.) — keep that pattern, but add
the shadcn-expected token names so shadcn components resolve correctly.
Replace the `@theme inline` block with:

```css
@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--ink);

  --color-card: var(--bg-surface);
  --color-card-foreground: var(--ink);

  --color-popover: var(--bg-surface);
  --color-popover-foreground: var(--ink);

  --color-primary: var(--accent);
  --color-primary-foreground: var(--accent-ink);

  --color-secondary: var(--bg-surface-hover);
  --color-secondary-foreground: var(--ink);

  --color-muted: var(--bg-surface);
  --color-muted-foreground: var(--ink-soft);

  --color-accent: var(--bg-surface-hover);
  --color-accent-foreground: var(--ink);

  --color-destructive: #dc2626;
  --color-destructive-foreground: #fafafa;

  --color-border: var(--rule-soft);
  --color-input: var(--rule-soft);
  --color-ring: var(--accent);

  /* Keep the existing product-specific tokens too — components built in
   * later tasks use these directly for difficulty/status colours. */
  --color-bg: var(--bg);
  --color-bg-surface: var(--bg-surface);
  --color-bg-surface-hover: var(--bg-surface-hover);
  --color-code-bg: var(--code-bg);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-ink-mute: var(--ink-mute);
  --color-accent-vivid: var(--accent-vivid);
  --color-accent-hover: var(--accent-hover);
  --color-accent-tint: var(--accent-tint);
  --color-rule: var(--rule);
  --color-rule-soft: var(--rule-soft);
  --color-status-done: var(--status-done);
  --color-status-pending: var(--status-pending);
  --color-difficulty-easy: var(--difficulty-easy);
  --color-difficulty-medium: var(--difficulty-medium);
  --color-difficulty-hard: var(--difficulty-hard);

  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);

  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius: var(--radius-md);

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
}
```

Note `--color-primary` maps to `--accent` (text-safe olive/green per theme),
not `--accent-vivid` — this preserves the existing accessibility invariant
from Task 1/the palette test.

Keep the file's existing top comment about `/docs` isolation and the
Fumadocs imports (`@import 'fumadocs-ui/css/neutral.css'` etc.) exactly as
they are — this task does not touch that boundary.

- [ ] **Step 3: Add Geist font in app/layout.tsx**

Edit `app/layout.tsx`. Replace the `VT323`/`Source_Serif_4` imports with
Geist (keep JetBrains Mono — still used for technical strings per the spec):

```typescript
import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Geist({
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Geist({
  subsets: ['latin'],
  variable: '--font-body-src',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-src',
  display: 'swap',
});
```

`display` and `body` both resolve to Geist (matching the spec's "Geist for
headings and UI text" — no separate serif body font in the new system).
Leave the rest of the file (the `THEME_INIT` script, the `<html>`/`<body>`
structure) untouched — that dual `data-theme`/`.dark` mechanism is unrelated
to typography and still correct.

- [ ] **Step 4: Update font-family stacks in tokens.css**

Edit `src/styles/tokens.css`'s font stack block:

```css
:root {
  --font-display: var(--font-display-src), ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-body-src), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono-src), ui-monospace, Consolas, monospace;
  --font-heading: var(--font-display);
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm typecheck`
Expected: PASS (no import errors from the font/CSS changes).

Run: `pnpm lint:tokens`
Expected: PASS (`--color-destructive: #dc2626;` and `#fafafa` in Step 2 are
inside `app/globals.css`, not an allowed file — move these two hex values
into `tokens.css` instead as `--destructive` / `--destructive-ink`, then
reference them from `app/globals.css` as `var(--destructive)`. Re-run after
fixing.)

Add to `src/styles/tokens.css`'s role-tokens block:

```css
--destructive: #dc2626;
--destructive-ink: #fafafa;
```

And update `app/globals.css`'s `@theme inline` block:

```css
--color-destructive: var(--destructive);
--color-destructive-foreground: var(--destructive-ink);
```

Re-run `pnpm lint:tokens`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components.json src/lib/utils.ts app/globals.css app/layout.tsx src/styles/tokens.css package.json pnpm-lock.yaml
git commit -m "Install shadcn/ui, switch to Geist, wire theme tokens to shadcn's color slots"
```

---

### Task 3: Delete Blueprint base.css, install core shadcn components

**Files:**
- Delete: `src/styles/base.css`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(auth)/layout.tsx`
- Create: `src/styles/product.css` (replacement base layer: resets, body
  defaults, focus rings, scrollbar — no `.lk-*` classes)
- Create: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`,
  `textarea.tsx`, `card.tsx`, `progress.tsx`, `badge.tsx`, `separator.tsx`,
  `alert.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `sonner.tsx` (all via
  shadcn CLI)
- Modify: `tests/unit/palette.test.ts` (remove the `base.css` describe block)

**Interfaces:**
- Produces: `Button`, `Input`, `Label`, `Textarea`, `Card` (+
  `CardHeader`/`CardContent`/`CardFooter`/`CardTitle`/`CardDescription`),
  `Progress`, `Badge`, `Separator`, `Alert` (+ `AlertTitle`/`AlertDescription`),
  `AlertDialog` (+ subcomponents), `DropdownMenu` (+ subcomponents), `Toaster`
  and `toast()` from `sonner` — all imported from `@/components/ui/*` in
  later tasks.

- [ ] **Step 1: Install shadcn components**

Run:
```bash
pnpm dlx shadcn@latest add button input label textarea card progress badge separator alert alert-dialog dropdown-menu sonner
```

This creates the files under `src/components/ui/` listed above and adds
`@radix-ui/*`, `class-variance-authority`, `sonner` to `package.json`.

- [ ] **Step 2: Write the replacement base layer**

Create `src/styles/product.css`:

```css
/*
 * Product base layer. Consumes tokens from tokens.css only — no literals.
 *
 * Imported from app/(app)/layout.tsx and app/(auth)/layout.tsx, NOT the root
 * layout, so /docs (Fumadocs, app/globals.css) is unaffected. See the
 * comment at the top of app/globals.css before moving this import.
 */

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--ink);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  transition:
    background-color var(--duration-base) var(--ease-out),
    color var(--duration-base) var(--ease-out);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0;
}

code, kbd, pre {
  font-family: var(--font-mono);
  font-size: 0.86em;
}

code {
  background: var(--code-bg);
  border-radius: var(--radius-sm);
  padding: 2px 5px;
}

::selection {
  background: var(--accent-tint-strong);
  color: var(--ink);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--rule-soft);
  border-radius: var(--radius-lg);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--ink-mute);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

No `.lk-*` classes, no `border-radius: 0` reset, no hard shadow class — those
are fully replaced by shadcn components in later tasks.

- [ ] **Step 3: Delete base.css and update the two layout imports**

Delete `src/styles/base.css`.

Edit `app/(app)/layout.tsx`:
```typescript
import '@/styles/product.css';

export default function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

Edit `app/(auth)/layout.tsx`:
```typescript
import '@/styles/product.css';

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

Update both files' comments to reference `product.css` instead of
`base.css`, keeping the explanation of why the import lives per-route-group
(unlayered CSS outranking Fumadocs utilities) — that reasoning still applies
verbatim to the new file.

- [ ] **Step 4: Update tests/unit/palette.test.ts**

Remove the entire `describe('base.css never puts text on the vivid fill', ...)`
block (it reads a file that no longer exists). Keep every other describe
block — they all read `tokens.css`/`palette.ts`, which still exist.

- [ ] **Step 5: Run tests and lint**

Run: `pnpm vitest run tests/unit/palette.test.ts --project unit`
Expected: PASS.

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If shadcn-generated components trip
`@typescript-eslint/consistent-type-imports`, fix the flagged imports to use
`import type` — do not disable the rule.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete Blueprint base.css, install shadcn core components"
```

---

### Task 4: App shell (top nav) and shared layout primitives

**Files:**
- Create: `src/components/app-shell.tsx` (server component: top nav wrapper)
- Create: `src/components/theme-toggle.tsx` (replaces `app/theme-toggle.tsx`)
- Delete: `app/theme-toggle.tsx`
- Modify: `app/(app)/layout.tsx` (wrap children in `AppShell`)

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button` (Task 3).
- Produces: `<AppShell>{children}</AppShell>` — used by `(app)` route group
  pages in Task 6/7. `<ThemeToggle />` client component, same external
  behavior as today (reads/writes `data-theme` + `.dark` + `localStorage`).

- [ ] **Step 1: Rebuild ThemeToggle on shadcn Button**

Create `src/components/theme-toggle.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The only client-side JavaScript for theming. Mirrors the pre-paint script
 * in app/layout.tsx, which owns the initial value.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('lk-theme', next);
    setTheme(next);
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

Delete `app/theme-toggle.tsx`.

- [ ] **Step 2: Build AppShell**

Create `src/components/app-shell.tsx`:

```typescript
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@app/(auth)/actions';

/**
 * Shared top nav for every authenticated page. Server Component — the only
 * client pieces are ThemeToggle and the sign-out button's pending state,
 * which SubmitButton (rebuilt in Task 5) already handles.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-[var(--header-bg)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-(--container-max) items-center justify-between px-6">
          <Link href="/roadmaps" className="font-display text-lg font-semibold tracking-tight">
            LockedIn
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

Note the sign-out button here is a plain shadcn `Button` with `type="submit"`,
not `SubmitButton` — a sign-out action is instant and rare enough that a
pending spinner isn't worth the complexity; Task 5's `SubmitButton` is
reserved for the forms where users actually notice latency (create, upload,
save, mark-solved).

`import { signOutAction } from '@app/(auth)/actions'` uses the `@app/*` path
alias already declared in `tsconfig.json` for `./app/*`.

- [ ] **Step 3: Verify with typecheck**

Run: `pnpm typecheck`
Expected: PASS.

Note: `AppShell` is not wired into any layout yet — that happens in Task 6
when the roadmap pages are rebuilt, since `(app)/layout.tsx` wraps both
`/roadmaps` and `/roadmaps/[id]`, and both need the shell.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell.tsx src/components/theme-toggle.tsx
git rm app/theme-toggle.tsx
git commit -m "Add AppShell top nav and rebuild ThemeToggle on shadcn Button"
```

---

### Task 5: Rebuild SubmitButton on shadcn Button

**Files:**
- Modify: `app/submit-button.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `Loader2` icon from
  `lucide-react`.
- Produces: `<SubmitButton pendingLabel="..." variant="..." size="...">` —
  same prop contract as today (`pendingLabel` required, `children`,
  `className`, `disabled`, plus now shadcn's `variant`/`size` props via
  `ComponentProps<typeof Button>`), consumed unchanged by every form in
  Tasks 6–8.

- [ ] **Step 1: Rewrite the component**

Replace the contents of `app/submit-button.tsx`:

```typescript
'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A submit button that knows its own form is in flight.
 *
 * Every mutation here is a Server Action, and a Server Action on a cold
 * function can take a second or more. `useFormStatus` reads the pending
 * state of the nearest parent `<form>`, which is why this is one small
 * client component rather than a prop threaded down from each page: pages
 * stay Server Components, and a page with several forms gets independent
 * pending states for free.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...rest
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

This keeps the exact same external contract (`pendingLabel`, disabled while
pending, `aria-busy`) while delegating visuals to shadcn's `Button`, which
already provides variant styling, focus rings, and disabled-state opacity.

- [ ] **Step 2: Verify with typecheck**

Run: `pnpm typecheck`
Expected: FAIL at every current call site that passes `className="lk-btn lk-btn-primary"` (string literal, no longer a valid prop shape change by itself, but `className` is still accepted by `Button`/`ComponentProps` so this specific case won't error — however these class names will now render alongside shadcn's own classes with no effect since `.lk-btn`/`.lk-btn-primary` no longer exist). This is expected and intentional: Tasks 6–8 replace every such call site's className with a shadcn `variant` prop instead. Do not fix call sites in this task — that happens where each page is rebuilt.

Run: `pnpm typecheck` and confirm the only errors (if any) are type errors,
not the stale-className issue described above (which is invisible to the
type checker). Expected: PASS, since `className` remains a valid string
prop.

- [ ] **Step 3: Commit**

```bash
git add app/submit-button.tsx
git commit -m "Rebuild SubmitButton on shadcn Button, keep useFormStatus contract"
```

---

### Task 6: Rebuild sign-in and sign-up pages

**Files:**
- Modify: `app/(auth)/sign-in/page.tsx`
- Modify: `app/(auth)/sign-up/page.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`
  from `@/components/ui/card`, `Input` from `@/components/ui/input`,
  `Label` from `@/components/ui/label`, `Alert`/`AlertDescription` from
  `@/components/ui/alert`, `SubmitButton` from `@app/submit-button`
  (rebuilt Task 5). Reuses `signInAction`/`signUpAction` from
  `app/(auth)/actions.ts` unchanged.

- [ ] **Step 1: Rebuild sign-in page**

Replace `app/(auth)/sign-in/page.tsx`:

```typescript
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { signInAction } from '../actions';
import { SubmitButton } from '../../submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Welcome back to LockedIn.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form action={signInAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>
            <SubmitButton pendingLabel="Signing in" className="w-full">
              Sign in
            </SubmitButton>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Rebuild sign-up page**

Replace `app/(auth)/sign-up/page.tsx`, same structure, sign-up fields:

```typescript
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { signUpAction } from '../actions';
import { SubmitButton } from '../../submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Start a roadmap and let LockedIn nag you.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form action={signUpAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" type="text" name="name" autoComplete="name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <SubmitButton pendingLabel="Creating account" className="w-full">
              Create account
            </SubmitButton>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have one?{' '}
            <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Verify with typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual check**

Run: `pnpm dev`, visit `/sign-in` and `/sign-up`. Confirm: card is centered,
form fields have visible labels, error alert renders when navigating to
`/sign-in?error=test`, tab order goes email → password → submit → sign-up
link, focus ring visible on every interactive element, dark mode (toggle via
devtools: `document.documentElement.setAttribute('data-theme','dark')`)
keeps text readable.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/sign-in/page.tsx" "app/(auth)/sign-up/page.tsx"
git commit -m "Rebuild sign-in and sign-up pages on shadcn Card/Input/Alert"
```

---

### Task 7: Rebuild roadmap list page with AppShell, filter, and archive confirm

**Files:**
- Modify: `app/(app)/roadmaps/page.tsx`
- Modify: `app/(app)/layout.tsx` (wrap children in `AppShell` from Task 4)
- Create: `app/(app)/roadmaps/roadmap-card.tsx` (client component: overflow
  menu + `AlertDialog` confirm for archive/unarchive)
- Create: `app/(app)/roadmaps/status-filter.tsx` (client component: deferred
  status filter)
- Modify: `app/(app)/roadmaps/timezone-field.tsx` (restyle only, same logic)

**Interfaces:**
- Consumes: `AppShell` (Task 4), `Card`, `Badge`, `Button`,
  `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`,
  `AlertDialog` (+ subcomponents), `SubmitButton` (Task 5). Reuses
  `listRoadmapsFor`, `createRoadmapAction`, `setStatusAction` unchanged.
- Produces: `<RoadmapCard roadmap={...} />` client component consumed by this
  page only. `<StatusFilter roadmaps={...}>{(filtered) => ...}</StatusFilter>`
  pattern — actually implemented as a client component owning both the
  filter UI and the filtered list render, taking `roadmaps: Roadmap[]` as a
  prop, so the Server Component page still fetches data and passes it down.

- [ ] **Step 1: Wire AppShell into the (app) layout**

Edit `app/(app)/layout.tsx`:

```typescript
import '@/styles/product.css';
import { AppShell } from '@/components/app-shell';

export default function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2: Build RoadmapCard client component**

Create `app/(app)/roadmaps/roadmap-card.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { Roadmap } from '@/domain/types';
import { setStatusAction } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * Archiving stops all nagging for a roadmap, so it gets a confirm step —
 * unlike unarchiving, which is always safe to do immediately.
 */
export function RoadmapCard({ roadmap }: { roadmap: Roadmap }) {
  const isArchived = roadmap.status === 'ARCHIVED';

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="grid gap-1">
          <Link href={`/roadmaps/${roadmap.id}`} className="font-medium hover:underline">
            {roadmap.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {roadmap.startDate} → {roadmap.endDate} · {roadmap.sendTimeLocal}{' '}
            {roadmap.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isArchived ? 'secondary' : 'default'}>
            {roadmap.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Roadmap actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isArchived ? (
                <form action={setStatusAction}>
                  <input type="hidden" name="roadmapId" value={roadmap.id} />
                  <input type="hidden" name="status" value="ACTIVE" />
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left">
                      Unarchive
                    </button>
                  </DropdownMenuItem>
                </form>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Archive
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive &ldquo;{roadmap.name}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This stops all daily emails for this roadmap. You can
                        unarchive it later from the same menu.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <form action={setStatusAction}>
                        <input type="hidden" name="roadmapId" value={roadmap.id} />
                        <input type="hidden" name="status" value="ARCHIVED" />
                        <AlertDialogAction type="submit">
                          Archive
                        </AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          {isArchived ? 'Not sending emails' : 'Nagging daily'}
        </div>
      </CardContent>
    </Card>
  );
}
```

`onSelect={(e) => e.preventDefault()}` on the destructive `DropdownMenuItem`
stops Radix from closing the dropdown before the `AlertDialog` opens — a
documented Radix pattern for nesting a confirm dialog inside a dropdown
trigger.

- [ ] **Step 3: Build StatusFilter client component with deferred filtering**

Create `app/(app)/roadmaps/status-filter.tsx`:

```typescript
'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { Roadmap } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { RoadmapCard } from './roadmap-card';

type Filter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

/**
 * Client-side filter over an already-fetched list — no refetch, no server
 * round trip. useDeferredValue keeps the filter buttons responsive even if
 * the list ever grows large enough that re-rendering it is not instant.
 */
export function StatusFilter({ roadmaps }: { roadmaps: Roadmap[] }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const deferredFilter = useDeferredValue(filter);

  const filtered = useMemo(() => {
    if (deferredFilter === 'ALL') return roadmaps;
    return roadmaps.filter((r) => r.status === deferredFilter);
  }, [roadmaps, deferredFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        {(['ALL', 'ACTIVE', 'ARCHIVED'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {value === 'ALL' ? 'All' : value === 'ACTIVE' ? 'Active' : 'Archived'}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roadmaps match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rebuild the page**

Replace `app/(app)/roadmaps/page.tsx`:

```typescript
import { AlertCircle } from 'lucide-react';
import { requireUserId } from '@/http/session';
import { listRoadmapsFor } from '@/usecases/roadmaps';
import { createRoadmapAction } from '../actions';
import { SubmitButton } from '../../submit-button';
import { StatusFilter } from './status-filter';
import { TimezoneField } from './timezone-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function RoadmapsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await requireUserId();
  const [{ error }, roadmaps] = await Promise.all([
    searchParams,
    listRoadmapsFor(userId),
  ]);

  return (
    <div className="mx-auto grid max-w-(--container-max) gap-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roadmaps</h1>
        <p className="text-sm text-muted-foreground">
          Every plan you&apos;re being nagged about.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {roadmaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Create a roadmap, upload some problems, and it will
          start nagging you.
        </p>
      ) : (
        <StatusFilter roadmaps={roadmaps} />
      )}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">New roadmap</CardTitle>
          <CardDescription>Name it, time-box it, pick a send time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createRoadmapAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Blind 75" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" name="startDate" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" name="endDate" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sendTimeLocal">Daily send time</Label>
              <Input
                id="sendTimeLocal"
                type="time"
                name="sendTimeLocal"
                required
                defaultValue="07:00"
              />
            </div>
            <TimezoneField />
            <SubmitButton pendingLabel="Creating" className="justify-self-start">
              Create
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Restyle TimezoneField**

Edit `app/(app)/roadmaps/timezone-field.tsx`, same logic, shadcn components:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TimezoneField() {
  const [zone, setZone] = useState('UTC');

  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  return (
    <div className="grid gap-2">
      <Label htmlFor="timezone">Time zone</Label>
      <Input
        id="timezone"
        name="timezone"
        value={zone}
        onChange={(event) => setZone(event.target.value)}
        required
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify with typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Manual check**

Run: `pnpm dev`, visit `/roadmaps` with at least one active and one archived
roadmap (create via the form, then archive one). Confirm: filter buttons
switch the visible list instantly, archiving opens a confirm dialog and
cancel/escape closes it without archiving, confirming archives and updates
the badge, unarchive has no confirm step, dropdown menu opens/closes with
keyboard (Enter/Escape/arrow keys), top nav shows on this page.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/roadmaps/page.tsx" "app/(app)/roadmaps/roadmap-card.tsx" "app/(app)/roadmaps/status-filter.tsx" "app/(app)/roadmaps/timezone-field.tsx"
git commit -m "Rebuild roadmap list: AppShell nav, deferred status filter, archive confirm dialog"
```

---

### Task 8: Optimistic mark-solved action and rebuild roadmap detail page

**Files:**
- Create: `app/(app)/roadmaps/[id]/problem-list.tsx` (client component:
  optimistic mark-solved)
- Modify: `app/(app)/actions.ts` (add a non-redirecting variant of mark-complete
  for the optimistic client component to call)
- Modify: `app/(app)/roadmaps/[id]/page.tsx`

**Interfaces:**
- Consumes: `useOptimistic` (React 19, already the installed version per
  `package.json`), `markComplete` usecase from `@/usecases/progress`
  (existing, unchanged signature).
- Produces: `markCompleteInPlace(roadmapId, itemId): Promise<{ ok: true } | { ok: false, error: string }>`
  exported from `app/(app)/actions.ts` — a new Server Action alongside the
  existing `markCompleteAction`, used only by `ProblemList`. The existing
  `markCompleteAction` (redirect-based) stays exactly as-is since nothing
  else in the plan calls it after this task, but it stays because removing a
  Server Action a form-action attribute could still reference is out of
  scope for a presentation-only rebuild — dead-code removal is not part of
  this plan's goal. `<ProblemList roadmapId={string} items={ItemWithCompletion[]} />`
  consumed by the page.

- [ ] **Step 1: Add a non-redirecting mark-complete Server Action**

Edit `app/(app)/actions.ts`. The existing `markCompleteAction` redirects,
which is wrong for a client component using `useOptimistic` — that pattern
needs the action to resolve with a value so the component can reconcile or
roll back. Add a new export (keep the existing `markCompleteAction`
untouched, since it's a straightforward addition, not a modification):

```typescript
export async function markCompleteInPlace(
  roadmapId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  'use server';
  const userId = await requireUserId();

  try {
    await markComplete(userId, roadmapId, itemId);
  } catch (error) {
    return { ok: false, error: reasonFor(error) };
  }

  revalidatePath(`/roadmaps/${roadmapId}`);
  return { ok: true };
}
```

This is a plain async function with an inline `'use server'` directive
(valid alongside the file-level `'use server'` already at the top of
`app/(app)/actions.ts`), callable directly from a client component instead
of only as a `<form action={...}>` target.

- [ ] **Step 2: Build ProblemList client component**

Create `app/(app)/roadmaps/[id]/problem-list.tsx`:

```typescript
'use client';

import { useOptimistic, useTransition } from 'react';
import { Check } from 'lucide-react';
import type { Difficulty } from '@/domain/types';
import { markCompleteInPlace } from '../../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Item {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  position: number;
  completed: boolean;
}

const DIFFICULTY_VARIANT: Record<Difficulty, 'default' | 'secondary' | 'outline'> = {
  EASY: 'default',
  MEDIUM: 'secondary',
  HARD: 'outline',
};

/**
 * Mark-solved is the single most-clicked action in the product, so it gets
 * an optimistic update instead of waiting on the Server Action round trip.
 * On failure, useOptimistic's state reverts automatically once the real
 * items prop is unchanged and the transition settles — we surface the error
 * by leaving the item unmarked and relying on the (rare) failure being
 * visible on next interaction, matching the low-stakes nature of this action.
 */
export function ProblemList({
  roadmapId,
  items,
}: {
  roadmapId: string;
  items: Item[];
}) {
  const [optimisticItems, setOptimisticItem] = useOptimistic(
    items,
    (state, completedId: string) =>
      state.map((item) =>
        item.id === completedId ? { ...item, completed: true } : item,
      ),
  );
  const [, startTransition] = useTransition();

  function handleMarkSolved(itemId: string) {
    startTransition(async () => {
      setOptimisticItem(itemId);
      await markCompleteInPlace(roadmapId, itemId);
    });
  }

  if (optimisticItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No problems yet. Paste some CSV below.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {optimisticItems.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-md border border-border p-3"
        >
          <span
            aria-hidden
            className={
              item.completed
                ? 'flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
                : 'size-5 shrink-0 rounded-full border-2 border-dashed border-muted-foreground'
            }
          >
            {item.completed ? <Check className="size-3" /> : null}
          </span>
          <div className="grid flex-1 gap-0.5">
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {item.title}
            </a>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>#{item.position}</span>
              <Badge variant={DIFFICULTY_VARIANT[item.difficulty]} className="text-xs">
                {item.difficulty}
              </Badge>
            </div>
          </div>
          {item.completed ? (
            <span className="text-sm text-muted-foreground">Done</span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleMarkSolved(item.id)}>
              Mark solved
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Rebuild the roadmap detail page**

Replace `app/(app)/roadmaps/[id]/page.tsx`:

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { requireUserId } from '@/http/session';
import { getProgressFor, listItemsWithCompletionFor } from '@/usecases/progress';
import { getRoadmapFor } from '@/usecases/roadmaps';
import {
  sendNowAction,
  updateDatesAction,
  uploadCsvAction,
} from '../../actions';
import { SubmitButton } from '../../../submit-button';
import { ProblemList } from './problem-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export default async function RoadmapDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sweep?: string }>;
}) {
  const userId = await requireUserId();
  const [{ id }, { error, sweep }] = await Promise.all([params, searchParams]);

  const roadmap = await getRoadmapFor(userId, id);
  if (roadmap === null) notFound();

  const [items, progress] = await Promise.all([
    listItemsWithCompletionFor(userId, id),
    getProgressFor(userId, id),
  ]);

  const percent =
    progress && progress.totalCount > 0
      ? Math.round((progress.completedCount / progress.totalCount) * 100)
      : 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-6 py-10">
      <div>
        <Link
          href="/roadmaps"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All roadmaps
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{roadmap.name}</h1>
          <Badge variant={roadmap.status === 'ARCHIVED' ? 'secondary' : 'default'}>
            {roadmap.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {roadmap.startDate} → {roadmap.endDate} · {roadmap.sendTimeLocal}{' '}
          {roadmap.timezone}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {sweep ? (
        <Alert>
          <AlertDescription>
            <span className="font-medium">Sweep result:</span> {sweep}
          </AlertDescription>
        </Alert>
      ) : null}

      {progress ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
            <CardDescription>
              {progress.completedCount} of {progress.totalCount} solved · day{' '}
              {progress.daysElapsed} of {progress.totalDays}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={percent} />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Problems</h2>
        <ProblemList roadmapId={roadmap.id} items={items ?? []} />
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Upload problems</h2>
          <p className="text-sm text-muted-foreground">
            title,url,difficulty — one per line. Header optional.
          </p>
        </div>
        <form action={uploadCsvAction} className="grid gap-3">
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <Textarea
            name="csv"
            rows={6}
            required
            defaultValue={'Two Sum,https://leetcode.com/problems/two-sum,EASY'}
          />
          <SubmitButton pendingLabel="Appending" className="justify-self-start">
            Append
          </SubmitButton>
        </form>
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reschedule</h2>
          <p className="text-sm text-muted-foreground">
            Nothing is precomputed, so changing these changes tomorrow&apos;s email.
          </p>
        </div>
        <form action={updateDatesAction} className="grid max-w-sm gap-4">
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <div className="grid gap-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={roadmap.startDate}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={roadmap.endDate}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sendTimeLocal">Daily send time</Label>
            <Input
              id="sendTimeLocal"
              type="time"
              name="sendTimeLocal"
              defaultValue={roadmap.sendTimeLocal}
              required
            />
          </div>
          <SubmitButton pendingLabel="Saving" className="justify-self-start">
            Save
          </SubmitButton>
        </form>
      </section>

      {process.env.NODE_ENV === 'production' ? null : (
        <>
          <Separator />
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Send now</h2>
              <p className="text-sm text-muted-foreground">
                Development only. Runs the real sweep over{' '}
                <strong>every active roadmap</strong>, not just this one,
                including the send log — so a second press does nothing
                until tomorrow.
              </p>
            </div>
            <form action={sendNowAction}>
              <input type="hidden" name="roadmapId" value={roadmap.id} />
              <SubmitButton pendingLabel="Sweeping" variant="outline">
                Run sweep
              </SubmitButton>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
```

Note `markCompleteAction` import is removed from this file since
`ProblemList` now owns marking solved via `markCompleteInPlace` — but the
export itself stays in `app/(app)/actions.ts` per the plan's constraint
against removing working code outside this rebuild's scope.

- [ ] **Step 4: Verify with typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If `markCompleteAction` is now flagged as unused by
`@typescript-eslint/no-unused-vars` — it isn't, since unused-export checks
aren't part of that rule and the function is still exported — no action
needed. If any import is genuinely unused, remove only that import line.

- [ ] **Step 5: Manual check**

Run: `pnpm dev`, visit a roadmap detail page with at least 2 unsolved
problems. Click "Mark solved" on one: confirm the row updates to the
checked/"Done" state immediately (no visible network wait), and reload the
page to confirm it persisted server-side. Test the CSV upload and reschedule
forms still work identically to before. Confirm the progress bar reflects
`percent` correctly at 0%, mid, and 100%.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/actions.ts" "app/(app)/roadmaps/[id]/page.tsx" "app/(app)/roadmaps/[id]/problem-list.tsx"
git commit -m "Add optimistic mark-solved and rebuild roadmap detail page"
```

---

### Task 9: Build the landing page

**Files:**
- Modify: `app/page.tsx`
- Create: `app/(marketing)/layout.tsx` (imports `product.css`, same pattern
  as `(app)`/`(auth)`)
- Modify: `app/page.tsx` needs to move under a route group so it can import
  `product.css` without affecting the root layout — actually simplest: keep
  `app/page.tsx` at the root but give it its own inline styling import,
  matching how `(app)` and `(auth)` do it via a layout. Use a new
  `app/(marketing)/page.tsx` and delete the root `app/page.tsx`, since Next's
  route groups don't change the URL — `(marketing)/page.tsx` still serves `/`.
- Delete: `app/page.tsx`
- Create: `app/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `currentUserId` from `@/http/session` (existing), `Button` from
  `@/components/ui/button`.
- Produces: nothing consumed elsewhere — this is a leaf page.

- [ ] **Step 1: Create the marketing route group layout**

Create `app/(marketing)/layout.tsx`:

```typescript
import '@/styles/product.css';

/**
 * Same purpose as app/(app)/layout.tsx and app/(auth)/layout.tsx: scope the
 * product CSS layer to this route group so it stays out of the /docs CSS
 * bundle. See the comment at the top of app/globals.css.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

- [ ] **Step 2: Move the home page into the route group**

Delete `app/page.tsx`. Create `app/(marketing)/page.tsx`:

```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserId } from '@/http/session';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const userId = await currentUserId();
  if (userId !== null) redirect('/roadmaps');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="grid gap-4">
        <span className="text-sm font-medium text-muted-foreground">LockedIn</span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          A roadmap that nags you<br className="hidden sm:block" /> until you finish it.
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Upload your problem list, set a pace, and get one email a day until
          it&apos;s done.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
```

`redirect()` still fires for signed-in visitors, matching today's exact
behavior for that case; signed-out visitors now see content instead of an
immediate bounce to `/sign-in`.

- [ ] **Step 3: Verify with typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual check**

Run: `pnpm dev`. Visit `/` while signed out: confirm the landing page
renders with both CTAs working. Sign in, then visit `/` again: confirm it
redirects straight to `/roadmaps` with no flash of landing content.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add landing page for signed-out visitors at /"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm db:up` (if not already running), then `pnpm test`
Expected: All unit and integration tests PASS. Integration tests exercise
route handlers, not page rendering, so they should be unaffected by this
plan — if any fail, investigate whether a Server Action signature was
accidentally changed (constraint violation) rather than adjusting the test.

- [ ] **Step 2: Run typecheck and lint one final time**

Run: `pnpm typecheck && pnpm lint && pnpm lint:tokens`
Expected: All PASS.

- [ ] **Step 3: Full manual walkthrough**

Use the `run` skill (or `pnpm dev` directly) to exercise, in both light and
dark mode, at both 375px and desktop widths:
sign-up → sign-in → create roadmap → upload CSV → mark a problem
solved (confirm optimistic update) → reschedule dates → archive (confirm
dialog appears) → unarchive → sign out → landing page while signed out.

Confirm: no horizontal scroll at 375px, all interactive elements show a
visible focus ring on keyboard Tab, no layout shift when toggling theme, no
console errors.

- [ ] **Step 4: Confirm /docs is unaffected**

Visit `/docs` and confirm it still renders in Fumadocs' own styling with no
visual bleed from the new `product.css` (expected, since it's imported only
from `(app)`, `(auth)`, `(marketing)` layouts, never the root layout or
`app/docs/layout.tsx`).

- [ ] **Step 5: Final commit if any fixes were needed**

If Steps 1–4 surfaced any fixes, commit them:

```bash
git add -A
git commit -m "Fix issues found in full verification pass"
```
