import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const withMDX = createMDX();

const nextConfig: NextConfig = {
  /**
   * Emits .next/standalone — a self-contained server plus only the node_modules
   * files Next traced as reachable. The Dockerfile copies that instead of the
   * full dependency tree, which is the difference between an image carrying
   * mermaid, prisma's CLI and the whole toolchain and one carrying what runs.
   *
   * Deliberately conditional rather than always on. Vercel does not use this
   * output — it builds with its own adapter (ADR-007) — so switching it on
   * unconditionally would change the production deploy path to buy nothing
   * there. Only the Docker build sets BUILD_STANDALONE, so `pnpm build` and
   * CI stay byte-for-byte what they were.
   */
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  eslint: {
    /**
     * Linting is its own step (`pnpm lint`), not a side effect of building.
     *
     * Next's build-time check also emits "the Next.js plugin was not detected"
     * against this repo, which is a false negative: its detection heuristic looks
     * for `eslint-config-next`, whereas eslint.config.mjs wires
     * @next/eslint-plugin-next directly because the shared config needs
     * FlatCompat to work with a flat config. The rules demonstrably run — they
     * caught a `<head>` element during setup.
     */
    ignoreDuringBuilds: true,
  },
};

export default withMDX(nextConfig);
