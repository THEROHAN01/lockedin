# CLAUDE.md — the docs site at `/docs`

Guidance for working on the Fumadocs site. Read this before changing anything
under `app/docs/`, `content/docs/`, `source.config.ts`, or the CSS files named
below. The root [`CLAUDE.md`](../../CLAUDE.md) covers the rest of the app.

## Where things live

| File | Role |
|---|---|
| `app/docs/layout.tsx` | `RootProvider` + `DocsLayout`. Owns theme wiring, sidebar options, and imports `src/styles/docs.css` |
| `app/docs/layout.shared.tsx` | `baseOptions()` — navbar, links, and the `GITHUB_*` constants both the navbar and Edit-on-GitHub use |
| `app/docs/[[...slug]]/page.tsx` | The page shell: TOC style, breadcrumbs, `editOnGithub`, metadata |
| `app/docs/source.ts` | `loader()`, including the `icon` resolver |
| `app/docs/mdx-components.tsx` | The component set every MDX page compiles against |
| `app/docs/mermaid.tsx` | Client component that renders ```` ```mermaid ```` fences |
| `source.config.ts` | Collection definition + the remark plugin that rewrites mermaid fences |
| `app/api/search/route.ts` | Search endpoint (Fumadocs' default path, so it sits outside this folder) |
| `src/styles/docs.css` | Docs-only CSS. Deliberately almost empty — see below |
| `content/docs/**` | The MDX and `meta.json` |

`.source/` is generated (`postinstall` runs `fumadocs-mdx`, and `pnpm dev`/`pnpm
build` regenerate it). It is gitignored. Never edit it.

## The rule that broke this once

**The docs are styled by Fumadocs. The blueprint design system stops at the
docs boundary, on purpose.**

`src/styles/base.css` is unlayered global CSS, and unlayered declarations beat
every `@layer` regardless of specificity. Fumadocs' whole visual system lives in
`@layer base`/`utilities`. When `base.css` was imported from the root layout it
therefore won every overlap, and `/docs` rendered as a collision of two design
systems: square corners on every card, a pixel font on every heading, serif body
text, and Fumadocs' own colours overridden.

The fix is isolation, not overrides:

- `base.css` is imported from `app/(app)/layout.tsx` and `app/(auth)/layout.tsx`,
  **not** the root layout. Those two layouts exist only for that import — they
  look like dead code and are not.
- `src/styles/docs.css` adds nothing back. If you catch yourself writing a rule
  there to undo something the product CSS is doing, the product CSS has leaked
  and that is the bug to fix.

So: **do not move `base.css` back into `app/layout.tsx`**, and do not add a
product route outside `(app)`/`(auth)` that needs blueprint styling without
giving it that import. `app/page.tsx` is exempt only because it is a bare
redirect that renders no markup.

Conversely, **Fumadocs' CSS has to stay in `app/globals.css`** and cannot move
into `docs.css`. `fumadocs-ui/css/preset.css` declares the `@theme` variables,
`@utility`/`@variant` definitions and `@source` globs Tailwind needs at build
time, and there is one Tailwind entry point. It is inert on product routes
because its own rules sit in `@layer base`, which the blueprint layer outranks.

Quick check after any CSS change — the docs bundle must contain nothing from the
blueprint layer:

```bash
curl -s "http://localhost:3000/_next/static/css/app/docs/layout.css" \
  | grep -cE "lk-btn|VT323|font-body"     # must be 0
```

## Theme is written twice, and that is load-bearing

Two systems read the theme and neither is worth converting:

- the blueprint tokens key off `[data-theme]` (`src/styles/tokens.css`)
- Fumadocs' theme and Tailwind's `dark:` variant key off `.dark` — **stock,
  unpatched**

So both are always written, under the one `lk-theme` localStorage key: by the
pre-paint script in `app/layout.tsx`, by `app/theme-toggle.tsx`, and by
`next-themes` in `app/docs/layout.tsx` (`attribute: ['class', 'data-theme']`).

Two traps:

1. **`lk-theme` may only ever hold `'light'` or `'dark'`.** The pre-paint script
   reads it as `saved === 'dark'`, so a stored `'system'` silently means light.
   This is why `themeSwitch` is set to `mode: 'light-dark'` — do not switch it to
   `'light-dark-system'` without changing that script too.
2. **Any new theme control must write both.** Writing only `data-theme` leaves
   the docs in light mode on a dark page.

Dark mode needs no CSS overrides. If you find yourself redefining a `.dark`
selector or a `--color-fd-*` value for dark mode, check the class is being set
before writing CSS.

## Engineering pages are mirrors — do not put components in them

`content/docs/engineering/{architecture,decisions,roadmap}.mdx` are near-verbatim
mirrors of `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and `docs/ROADMAP.md`. A
post-commit hook in `.claude/settings.json` re-mirrors them whenever the source
`.md` changes, so:

- **Do not add `<Cards>`, `<Steps>`, `<Callout>` or any other component to those
  three pages.** The next mirror pass will delete it.
- Only the frontmatter survives a mirror. `icon:` is safe there; body content is
  not.
- If you change `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` or
  `docs/ROADMAP.md`, the mirror must be updated in the same change.
  `DECISIONS.md` is append-only — the only valid edit is a new ADR at the end.

Components belong in `content/docs/index.mdx` and `content/docs/product/*.mdx`,
which are authored for the web and have no upstream file.

## Adding a page

1. Create the `.mdx` under `content/docs/<section>/`.
2. Frontmatter: `title` (required), `description`, `icon` (optional),
   `full: true` for a page that should use the whole width.
3. **Add the filename to that folder's `meta.json` `pages` array.** This is the
   easiest mistake to make here: once `pages` is present, it is an allow-list,
   not just an ordering. A page left out of it **does not appear in the sidebar
   at all** — and because it still routes and still gets prerendered, nothing
   fails and no test catches it. The page is simply unreachable by navigation.
   (`"..."` as an entry expands to "everything else, alphabetically", if you ever
   want a folder that does not need curating.)
4. Nothing else. Pages are prerendered through `generateStaticParams`, and the
   sidebar, breadcrumbs, search index and Edit-on-GitHub link all derive from
   the tree.

## Adding a component to MDX

MDX has no implicit imports. Either:

- register it in `getMDXComponents()` (`app/docs/mdx-components.tsx`) — do this
  for anything content authors should reach for without ceremony; or
- `import` it at the top of the one `.mdx` file that needs it — what
  `content/docs/index.mdx` does for its Lucide icons.

Keep `...defaultMdxComponents` spread first: it supplies the styled
`pre`/`a`/`table`/heading overrides, including anchored headings and the code
block's copy button.

## Icons

`icon:` in frontmatter or `meta.json` is an unread string unless
`loader({ icon })` in `app/docs/source.ts` resolves it. Names are Lucide
**PascalCase** (`ScrollText`, not `scroll-text`). An unknown name silently drops
the icon rather than failing the route — so if an icon does not appear, suspect
the casing before suspecting the wiring.

## Mermaid

```` ```mermaid ```` fences are rewritten into `<Mermaid chart="…" />` by a
remark plugin in `source.config.ts`, before Shiki sees them. That exists because
the engineering mirrors have to keep their diagrams as portable markdown fences.

Consequences worth knowing:

- Authors write a normal fence. Do not write `<Mermaid>` by hand.
- The fence never reaches the highlighter, so the DSL is not also shipped as
  syntax-highlighted text.
- The substitution runs **before** `remarkStructure`, so diagram source is not in
  the search index. Keep it ordered that way.
- `mermaid` is imported dynamically inside the client component. Never import it
  at module scope — it is large and DOM-bound.
- `Mermaid` calls `useTheme()`, so it only works inside the docs subtree's
  `RootProvider`. It is not reusable on product routes as-is.

## Things that will fail CI

- **A new `route.ts` under `app/api/`** must appear in `src/http/openapi.ts` or
  be listed in `NOT_PART_OF_THE_API` in `tests/unit/http/openapi.test.ts`.
  `/api/search` is listed there because it serves the documentation and its
  contract is Fumadocs' to define, not ours.
- **A hex colour literal in `src/styles/docs.css`** (or any `.css`) fails
  `pnpm lint:tokens`. Use a `--color-fd-*` variable, or a token from
  `src/styles/tokens.css`.
- `pnpm typecheck` covers `source.config.ts`. The local `MdxNode` interface there
  is deliberate — do not replace it with imports from `mdast`/`@types/unist`,
  which are transitive deps of the MDX toolchain rather than ours.

## Verifying a docs change

`pnpm typecheck && pnpm lint && pnpm lint:tokens && pnpm test` catches the
wiring. It cannot catch "the docs look wrong", which is how this broke the first
time — so also load the pages:

```bash
pnpm dev        # never alongside pnpm build against the same .next
```

Then check, in a browser, in **both** themes:

- a page with components (`/docs/product/overview`) — corners are rounded,
  headings are the docs sans, `<Steps>` and `<Callout>` are styled
- a mirror page (`/docs/engineering/architecture`) — diagrams render as diagrams
- search (`⌘K` / `Ctrl-K`) returns results
- the theme switch in the sidebar footer, then navigate to `/roadmaps` and
  confirm the product agrees with it
