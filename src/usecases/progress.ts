import { localDateFor } from '@/domain/dates';
import { computeProgress } from '@/domain/progress';
import type { Progress, RoadmapItem } from '@/domain/types';
import { countItems, listItems, listOutstandingItems } from '@/data/items';
import {
  countCompleted,
  listCompletedItemIds,
  markItemComplete,
} from '@/data/progress';
import { findOwnedRoadmap, setRoadmapStatus } from '@/data/roadmaps';

/**
 * Reading and writing progress.
 *
 * Both directions live here. The read side previously sat in `roadmaps.ts`, which
 * split one subject across two modules — completion is one concern whether you
 * are recording it or reporting it.
 */

export type ItemWithCompletion = RoadmapItem & { completed: boolean };

/**
 * Marks an item solved.
 *
 * Returns false when the roadmap is not the caller's, or when the item is not in
 * that roadmap — the caller answers 404 for both. Two levels of check are needed:
 * roadmap ownership alone would let a caller name any item id alongside a roadmap
 * they own.
 */
export async function markComplete(
  userId: string,
  roadmapId: string,
  itemId: string,
): Promise<boolean> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return false;

  const marked = await markItemComplete(roadmapId, itemId);
  if (!marked) return false;

  // Finishing the last item is what ends a roadmap. Passing the end date does
  // not — nagging continues until everything is done.
  if (roadmap.status === 'ACTIVE') {
    const outstanding = await listOutstandingItems(roadmapId);
    if (outstanding.length === 0) {
      await setRoadmapStatus(roadmapId, 'COMPLETED');
    }
  }

  return true;
}

/**
 * `completed` is derived rather than stored on the item: completion is an event,
 * and `RoadmapItem` stays a description of the item itself.
 */
export async function listItemsWithCompletionFor(
  userId: string,
  roadmapId: string,
): Promise<ItemWithCompletion[] | null> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return null;

  const [items, completedIds] = await Promise.all([
    listItems(roadmapId),
    listCompletedItemIds(roadmapId),
  ]);
  const done = new Set(completedIds);

  return items.map((item) => ({ ...item, completed: done.has(item.id) }));
}

export async function getProgressFor(
  userId: string,
  roadmapId: string,
): Promise<Progress | null> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return null;

  const [totalCount, completedCount] = await Promise.all([
    countItems(roadmapId),
    countCompleted(roadmapId),
  ]);

  return computeProgress({
    completedCount,
    totalCount,
    startDate: roadmap.startDate,
    endDate: roadmap.endDate,
    // Reading the clock is this layer's job. The domain receives `today` as a
    // value, which is what keeps it testable without mocking.
    today: localDateFor(new Date(), roadmap.timezone),
  });
}
