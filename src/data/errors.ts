import { Prisma } from '@prisma/client';

/**
 * Driver-error classification.
 *
 * Separate from mappers.ts, which translates rows into domain types: these
 * change for different reasons — a mapper changes when a domain shape or column
 * changes, this changes if Prisma's error scheme does or a new constraint needs
 * recognising.
 */

/**
 * A unique-constraint violation.
 *
 * Both unique constraints in this schema exist to make a duplicate a normal,
 * expected outcome rather than an error — a second send in the same local day,
 * or an item marked complete twice. Callers translate this into a boolean.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
