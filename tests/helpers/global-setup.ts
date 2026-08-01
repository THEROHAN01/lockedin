import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

/**
 * Brings the test database's schema up to date once per run, rather than once
 * per test file. Uses `migrate deploy` (not `dev`) so a run can never prompt,
 * generate a migration, or reset the database on drift — it either applies
 * committed migrations or fails loudly.
 */
export default function setup(): void {
  config({ path: '.env', quiet: true });

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.',
    );
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
