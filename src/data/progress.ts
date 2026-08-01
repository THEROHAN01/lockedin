import { prisma } from './prisma';

/**
 * Completion is an append-only event, never a boolean on the item, so a future
 * XP/level/mission layer can read history rather than re-derive it.
 */

/**
 * Marks an item complete, returning false if the item is not in that roadmap.
 * Callers translate false into a 404, the same as a missing roadmap.
 *
 * The membership check is not optional. ProgressEvent carries `roadmapId`
 * denormalised so `countCompleted` avoids a join, which means an inconsistent
 * pair is silently corrupting: `countCompleted(roadmapId)` would include an item
 * that roadmap never contained, inflating a stranger's progress. Verifying the
 * pair here rather than in each caller makes the invariant impossible to violate
 * through this module.
 *
 * Idempotent by way of UNIQUE(itemId, type): a repeat is a no-op rather than an
 * error, which is what lets the API be a plain idempotent PUT. The empty
 * `update` is deliberate — re-marking must not move the original timestamp,
 * which is the thing worth keeping.
 */
export async function markItemComplete(
  roadmapId: string,
  itemId: string,
): Promise<boolean> {
  const item = await prisma.roadmapItem.findFirst({
    where: { id: itemId, roadmapId },
    select: { id: true },
  });
  if (item === null) return false;

  await prisma.progressEvent.upsert({
    where: { itemId_type: { itemId, type: 'COMPLETED' } },
    create: { roadmapId, itemId, type: 'COMPLETED' },
    update: {},
  });

  return true;
}

/**
 * A plain count is already distinct-by-item: UNIQUE(itemId, type) permits at most
 * one COMPLETED event per item.
 */
export async function countCompleted(roadmapId: string): Promise<number> {
  return prisma.progressEvent.count({
    where: { roadmapId, type: 'COMPLETED' },
  });
}

export async function listCompletedItemIds(
  roadmapId: string,
): Promise<string[]> {
  const rows = await prisma.progressEvent.findMany({
    where: { roadmapId, type: 'COMPLETED' },
    select: { itemId: true },
    orderBy: { occurredAt: 'asc' },
  });
  return rows.map((row) => row.itemId);
}
