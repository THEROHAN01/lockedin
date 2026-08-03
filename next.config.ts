import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const withMDX = createMDX();

const nextConfig: NextConfig = {
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
