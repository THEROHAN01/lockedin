import { PrismaClient } from '@prisma/client';

/**
 * One client per process. Cached on globalThis outside production because Next's
 * dev server re-evaluates modules on every edit, and a fresh pool per reload
 * exhausts Postgres connections within a few saves.
 */
const globalForPrisma = globalThis as unknown as {
  lockedinPrisma?: PrismaClient;
};

/**
 * `error` is deliberately not logged. Both unique constraints in this schema
 * exist so that a duplicate is an expected outcome — a second send in the same
 * local day, an item marked complete twice — and callers translate the violation
 * into a boolean. Logging those as errors fills the test output with failures
 * that are not failures, which trains everyone to ignore it. Genuine problems
 * still surface as thrown exceptions.
 */
export const prisma =
  globalForPrisma.lockedinPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.lockedinPrisma = prisma;
}
