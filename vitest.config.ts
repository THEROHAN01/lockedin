import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = {
  // Longest prefix first: '@/' would otherwise swallow '@app/'.
  '@app': fileURLToPath(new URL('./app', import.meta.url)),
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

// tsconfig sets jsx: preserve for Next, which esbuild cannot execute. The email
// template is .tsx and is rendered in tests, so transform it automatically.
// Must be declared per project — a root-level esbuild option does not propagate.
const esbuild = { jsx: 'automatic' } as const;

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        // Pure domain logic. No database, no network, no clock.
        // If a test here needs any of those, the code under test is in the wrong layer.
        resolve: { alias },
        esbuild,
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        // Repositories, route handlers, cron orchestrator. Real Postgres.
        // Serialised: these share one database and truncate between files.
        resolve: { alias },
        esbuild,
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/helpers/global-setup.ts'],
          setupFiles: ['tests/helpers/setup-integration.ts'],
          // One fork, files run one at a time: they share a single database and
          // truncate between files, so parallelism here would be cross-talk.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
