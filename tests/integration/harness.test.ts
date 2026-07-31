import { describe, expect, it } from 'vitest';
import { prisma, resetDb } from '../helpers/db';

/**
 * Guards the test harness itself. The first assertion is the important one:
 * every integration test truncates the whole schema, so if the suite ever
 * pointed at the development database it would silently destroy local data.
 */
describe('integration harness', () => {
  it('is connected to the test database, never the development one', async () => {
    const rows = await prisma.$queryRaw<Array<{ db: string }>>`
      SELECT current_database() AS db
    `;
    expect(rows[0]?.db).toBe('lockedin_test');
  });

  it('truncates cleanly against the current schema', async () => {
    await expect(resetDb()).resolves.toBeUndefined();
  });
});
