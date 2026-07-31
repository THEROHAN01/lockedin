import { describe, expect, it } from 'vitest';
import { selectItemsForToday } from '@/domain/selection';
import type { RoadmapItem } from '@/domain/types';

function item(position: number, title = `p${position}`): RoadmapItem {
  return {
    id: `id-${position}`,
    title,
    url: `https://leetcode.com/problems/${title}`,
    difficulty: 'EASY',
    position,
  };
}

describe('selectItemsForToday', () => {
  it('takes the first N by position', () => {
    const selected = selectItemsForToday([item(1), item(2), item(3)], 2);
    expect(selected.map((i) => i.position)).toEqual([1, 2]);
  });

  it('orders by position even when the caller does not', () => {
    // The repository is expected to order, but the domain should not depend on
    // it having done so — getting the order wrong sends the wrong problems.
    const selected = selectItemsForToday([item(3), item(1), item(2)], 2);
    expect(selected.map((i) => i.position)).toEqual([1, 2]);
  });

  it('returns everything when fewer remain than the quota', () => {
    const selected = selectItemsForToday([item(4), item(5)], 5);
    expect(selected.map((i) => i.position)).toEqual([4, 5]);
  });

  it('returns nothing for an empty roadmap', () => {
    expect(selectItemsForToday([], 3)).toEqual([]);
  });

  it('returns nothing when the quota is zero', () => {
    expect(selectItemsForToday([item(1)], 0)).toEqual([]);
  });

  it('does not mutate the caller’s array', () => {
    const input = [item(3), item(1)];
    selectItemsForToday(input, 2);
    expect(input.map((i) => i.position)).toEqual([3, 1]);
  });
});
