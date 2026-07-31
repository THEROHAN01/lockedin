import { localDateToUtcDate, utcDateToLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { isUniqueViolation } from './errors';
import { prisma } from './prisma';

/** Identifies one roadmap-day. */
export function sentKey(roadmapId: string, localDate: LocalDate): string {
  return `${roadmapId}|${localDate}`;
}

/**
 * Claims today's send for a roadmap. Returns false if it was already sent.
 *
 * The claim is the UNIQUE(roadmapId, localDate) insert itself, not a preceding
 * read — two overlapping cron invocations would both pass a read-then-write
 * check, and the user would be mailed twice. Losing this race is normal, so it
 * is a boolean rather than an exception.
 */
export async function recordSend(
  roadmapId: string,
  localDate: LocalDate,
  itemCount: number,
): Promise<boolean> {
  try {
    await prisma.sendLog.create({
      data: {
        roadmapId,
        localDate: localDateToUtcDate(localDate),
        itemCount,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/**
 * Which roadmap-days have already been sent, for the whole sweep in one query.
 *
 * Due-ness stays true for the rest of the roadmap's local day, so this is asked
 * about every due roadmap on all 96 daily ticks. A point query per roadmap here
 * is the first thing that breaks under load — see ARCHITECTURE.md §6.
 */
export async function findSentKeys(
  roadmapIds: readonly string[],
  localDates: readonly LocalDate[],
): Promise<Set<string>> {
  if (roadmapIds.length === 0 || localDates.length === 0) return new Set();

  const rows = await prisma.sendLog.findMany({
    where: {
      roadmapId: { in: [...roadmapIds] },
      localDate: { in: localDates.map(localDateToUtcDate) },
    },
    select: { roadmapId: true, localDate: true },
  });

  return new Set(
    rows.map((row) => sentKey(row.roadmapId, utcDateToLocalDate(row.localDate))),
  );
}
