import { prisma } from './prisma';

/**
 * Completion is an append-only event, never a boolean on the item, so a future
 * XP/level/mission layer can read history rather than re-derive it.
 */

/**
 * Idempotent by way of the UNIQUE(itemId, type) constraint: a repeat is a no-op
 * rather than an error, which is what lets the API be a plain idempotent PUT.
 *
 * The empty `update` is deliberate — re-marking must not move the original
 * timestamp, which is the thing worth keeping.
 */
export async function markItemComplete(
  roadmapId: string,
  itemId: string,
): Promise<void> {
  await prisma.progressEvent.upsert({
    where: { itemId_type: { itemId, type: 'COMPLETED' } },
    create: { roadmapId, itemId, type: 'COMPLETED' },
    update: {},
  });
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
