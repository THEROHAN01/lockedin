import './env';
import { prisma } from '@/data/prisma';

export { prisma };

/**
 * Empties every table, discovered from the live schema rather than hardcoded,
 * so it keeps working as models are added.
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
