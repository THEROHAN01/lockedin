import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { SquareTerminal } from 'lucide-react';
import { baseOptions } from './layout.shared';
import { source } from './source';
import '@/styles/docs.css';

export default function DocsRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /**
     * The wrapper is a marker, not a styling hook: src/styles/docs.css targets
     * `body:has(.fd-docs)` through it, so the docs variables also reach the
     * search dialog and mobile sidebar, which render into portals on <body>.
     */
    <div className="fd-docs">
      <RootProvider
        /**
         * next-themes is scoped to this subtree — app/layout.tsx already owns
         * the pre-paint theme script for the product routes — but it is
         * configured to write exactly what that script writes: both the `dark`
         * class (which Fumadocs' theme and Tailwind's `dark:` variant read) and
         * `data-theme` (which the blueprint tokens read), under the one
         * `lk-theme` key. Toggling in the docs therefore rethemes the product
         * too, and vice versa.
         *
         * `enableSystem` matches the script's own fallback, and the navbar
         * switch is set to `light-dark` below so it only ever stores 'light' or
         * 'dark' — the script reads the key as `saved === 'dark'` and would
         * treat a stored 'system' as light.
         */
        theme={{
          attribute: ['class', 'data-theme'],
          storageKey: 'lk-theme',
          defaultTheme: 'system',
          enableSystem: true,
          disableTransitionOnChange: true,
        }}
      >
        <DocsLayout
          tree={source.getPageTree()}
          {...baseOptions()}
          themeSwitch={{ mode: 'light-dark' }}
          sidebar={{
            /**
             * No root toggle. Tabs trade "see everything" for "see one
             * section", which is the wrong trade at two sections of three
             * pages — both fit in the sidebar at once. Set explicitly so
             * marking a folder `root` in meta.json later is a deliberate
             * decision rather than a silent layout change.
             */
            tabs: false,
            /** Both sections open on arrival; nothing is deep enough to nest. */
            defaultOpenLevel: 1,
            banner: (
              /**
               * The API reference is generated from the Zod schemas that
               * validate requests (src/http/openapi.ts) and lives outside the
               * page tree, so the sidebar is the only place it can surface.
               */
              <a
                href="/api-docs"
                className="flex flex-row items-center gap-2 rounded-lg border bg-fd-card p-2.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <SquareTerminal className="size-4 shrink-0" />
                <span>
                  <span className="block font-medium text-fd-foreground">
                    API reference
                  </span>
                  Try the endpoints in Swagger UI
                </span>
              </a>
            ),
          }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
