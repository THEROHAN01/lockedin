import type { ParsedItem, RoadmapItem } from '@/domain/types';
import { toRoadmapItem } from './mappers';
import { prisma } from './prisma';

/**
 * Appends items after any that already exist, preserving the given order.
 *
 * Positions continue from the current maximum rather than restarting, so a
 * second upload extends the roadmap instead of colliding with it.
 */
export async function appendItems(
  roadmapId: string,
  items: readonly ParsedItem[],
): Promise<RoadmapItem[]> {
  if (items.length === 0) return [];

  const highest = await prisma.roadmapItem.aggregate({
    where: { roadmapId },
    _max: { position: true },
  });
  const start = (highest._max.position ?? -1) + 1;

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
