import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

/**
 * Integration-test database access.
 *
 * DATABASE_URL is redirected to TEST_DATABASE_URL before any client is built,
 * so an integration run cannot touch development data even by accident. This
 * module must therefore be imported before anything that constructs its own
 * PrismaClient.
 */
config({ path: '.env', quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.',
  );
}
process.env.DATABASE_URL = testUrl;

export const prisma = new PrismaClient({ log: ['warn', 'error'] });

/**
 * Empties every table, discovered from the live schema rather than hardcoded,
 * so it keeps working as models are added in later phases.
 */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
