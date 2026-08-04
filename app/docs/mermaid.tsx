'use client';

import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

/**
 * Renders one mermaid diagram. Substituted in for ```mermaid fences by the
 * remark plugin in source.config.ts, so nothing in content/ references it
 * directly.
 *
 * Client-side and lazily imported: mermaid is a large, DOM-bound library, so it
 * is kept out of the server bundle and off every route that has no diagram.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    void (async () => {
      const { default: mermaid } = await import('mermaid');

      mermaid.initialize({
        startOnLoad: false,
        /**
         * Diagram sources are repository files, not user input — but strict
         * mode costs nothing here and keeps that from becoming load-bearing if
         * a future roadmap source ever renders authored markdown.
         */
        securityLevel: 'strict',
        /**
         * 'neutral' rather than mermaid's 'default': default is lavender and
         * yellow, which reads as a foreign object dropped into a greyscale
         * page. 'neutral' is mermaid's own greyscale theme, so the diagrams
         * belong to the page without being restyled by hand.
         */
        theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
        /** Inherit the docs typeface instead of mermaid's own default. */
        fontFamily: 'inherit',
      });

      /**
       * mermaid puts this straight into an id attribute and a CSS selector, and
       * React's useId returns colons, which are not valid there.
       */
      const renderId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
      const { svg: rendered } = await mermaid.render(renderId, chart);

      if (current) setSvg(rendered);
    })();

    return () => {
      current = false;
    };
    // Re-renders on theme change: mermaid bakes colours into the SVG, so there
    // is no CSS-only way to reflect a light/dark switch.
  }, [chart, id, resolvedTheme]);

  return (
    <div
      className="my-6 overflow-x-auto rounded-lg border bg-fd-card p-4 [&_svg]:mx-auto [&_svg]:h-auto"
      /**
       * Empty until the effect resolves. The height reservation keeps the
       * page from jumping when the diagram lands.
       */
      aria-busy={svg === null}
      style={svg === null ? { minHeight: '8rem' } : undefined}
      /**
       * The markup is mermaid's own output from a build-time repository file,
       * generated with securityLevel 'strict'. There is no request, user or
       * database data anywhere in this path — keep it that way.
       */
      dangerouslySetInnerHTML={svg === null ? undefined : { __html: svg }}
    />
  );
}
