import type { ParsedItem, RoadmapItem } from '@/domain/types';
import { isUniqueViolation } from './errors';
import { toRoadmapItem } from './mappers';
import { prisma } from './prisma';

/** Enough for a double submit; a real pile-up should surface, not spin. */
const MAX_APPEND_ATTEMPTS = 3;

/**
 * Appends items after any that already exist, preserving the given order.
 *
 * Positions continue from the current maximum rather than restarting, so a second
 * upload extends the roadmap instead of overwriting it.
 *
 * Reading MAX(position) and then inserting is a race: two overlapping uploads can
 * read the same maximum. UNIQUE(roadmapId, position) turns that from silently
 * scrambled ordering into a violation, and this retry recomputes the maximum and
 * tries again. Wrapping the pair in a transaction would not help — READ COMMITTED
 * does not block a concurrent read-then-write — and a sequence would be
 * disproportionate for a rare, user-initiated action.
 */
export async function appendItems(
  roadmapId: string,
  items: readonly ParsedItem[],
): Promise<RoadmapItem[]> {
  if (items.length === 0) return [];

  for (let attempt = 1; ; attempt += 1) {
    const highest = await prisma.roadmapItem.aggregate({
      where: { roadmapId },
      _max: { position: true },
    });
    const start = (highest._max.position ?? -1) + 1;

    try {
      const rows = await prisma.roadmapItem.createManyAndReturn({
        data: items.map((item, index) => ({
          roadmapId,
          title: item.title,
          url: item.url,
          difficulty: item.difficulty,
          position: start + index,
        })),
      });
      return rows.map(toRoadmapItem).sort((a, b) => a.position - b.position);
    } catch (error) {
      if (attempt >= MAX_APPEND_ATTEMPTS || !isUniqueViolation(error)) throw error;
    }
  }
}

export async function listItems(roadmapId: string): Promise<RoadmapItem[]> {
  const rows = await prisma.roadmapItem.findMany({
    where: { roadmapId },
    orderBy: { position: 'asc' },
  });
  return rows.map(toRoadmapItem);
}

/**
 * Items with no COMPLETED event, in roadmap order — the candidates for today's
 * email. Its length is also the `remainingCount` the pacing rule divides.
 */
export async function listOutstandingItems(
  roadmapId: string,
): Promise<RoadmapItem[]> {
  const rows = await prisma.roadmapItem.findMany({
    where: {
      roadmapId,
      progressEvents: { none: { type: 'COMPLETED' } },
    },
    orderBy: { position: 'asc' },
  });
  return rows.map(toRoadmapItem);
}

export async function countItems(roadmapId: string): Promise<number> {
  return prisma.roadmapItem.count({ where: { roadmapId } });
}
