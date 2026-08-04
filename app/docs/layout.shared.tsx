import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Lock } from 'lucide-react';

/**
 * One place for the repo coordinates: the navbar's GitHub button needs the URL,
 * and every page's "Edit on GitHub" link needs the owner/repo split.
 */
export const GITHUB_OWNER = 'THEROHAN01';
export const GITHUB_REPO = 'lockedin';
export const GITHUB_BRANCH = 'main';
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

/**
 * Options shared by every Fumadocs layout in the app. Only the docs layout uses
 * them today; it stays factored out because that is the seam Fumadocs expects
 * you to add a home/landing layout on, and the navbar has to be identical
 * across the two or the header visibly changes shape between them.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    /**
     * Renders the GitHub icon button in the navbar, and is reused by
     * `editOnGithub` on each page.
     */
    githubUrl: GITHUB_URL,
    nav: {
      /**
       * Fumadocs lays the title out as a flex row, so a mark plus a wordmark is
       * the shape it expects here. Styled with fd tokens rather than the
       * blueprint palette so it retheme with the docs, not against them.
       */
      title: (
        <>
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-fd-primary text-fd-primary-foreground"
          >
            <Lock className="size-3.5" />
          </span>
          LockedIn
        </>
      ),
      /** The docs index, not `/` — `/` redirects into the signed-in app. */
      url: '/docs',
    },
    links: [
      {
        text: 'API reference',
        url: '/api-docs',
        /**
         * Swagger UI, served outside the Next router by
         * app/api-docs/route.ts, so it must be a hard navigation.
         */
        external: true,
      },
      {
        type: 'button',
        text: 'Open app',
        url: '/roadmaps',
        external: true,
      },
    ],
  };
}
