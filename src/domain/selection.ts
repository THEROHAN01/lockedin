import type { RoadmapItem } from './types';

/**
 * Which problems today's email carries: the first `quota` outstanding items in
 * roadmap order.
 *
 * Callers pass items that are already outstanding — the repository filters
 * completed ones out — but the ordering is re-applied here rather than trusted.
 * Getting it wrong means sending the wrong problems, and a defensive sort costs
 * nothing at these list sizes.
 */
export function selectItemsForToday(
  outstanding: readonly RoadmapItem[],
  quota: number,
): RoadmapItem[] {
  if (quota <= 0) return [];
  return [...outstanding]
    .sort((a, b) => a.position - b.position)
    .slice(0, quota);
}
