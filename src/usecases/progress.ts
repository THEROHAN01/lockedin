import { listOutstandingItems } from '@/data/items';
import { markItemComplete } from '@/data/progress';
import { findOwnedRoadmap, setRoadmapStatus } from '@/data/roadmaps';

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
