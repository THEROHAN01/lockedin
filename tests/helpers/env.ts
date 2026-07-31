import { config } from 'dotenv';

/**
 * Redirects DATABASE_URL to the test database.
 *
 * Must be imported before anything that constructs a PrismaClient — including
 * the application's own client in src/data/prisma.ts. ES module imports are
 * evaluated in order, so importing this module first in tests/helpers/db.ts is
 * what guarantees it.
 */
config({ path: '.env', quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.',
  );
}

process.env.DATABASE_URL = testUrl;

export const TEST_DATABASE_URL = testUrl;
