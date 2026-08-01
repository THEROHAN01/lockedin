import { afterAll, beforeEach } from 'vitest';
import { prisma, resetDb } from './db';

// Every integration test starts from an empty database. Combined with the
// single-fork, serialised pool in vitest.config.ts, this makes test order
// irrelevant without any per-test bookkeeping.
beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});
