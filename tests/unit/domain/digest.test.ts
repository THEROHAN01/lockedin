import { describe, expect, it } from 'vitest';
import { QUOTES, buildDigest, quoteForDate } from '@/domain/digest';
import type { Progress, RoadmapItem } from '@/domain/types';

function item(position: number): RoadmapItem {
  return {
    id: `id-${position}`,
    title: `Problem ${position}`,
    url: `https://leetcode.com/problems/p${position}`,
    difficulty: 'MEDIUM',
    position,
  };
}

const PROGRESS: Progress = {
  completedCount: 7,
  totalCount: 30,
  daysElapsed: 9,
  totalDays: 30,
};

describe('quoteForDate', () => {
  it('returns the same quote for the same date', () => {
    expect(quoteForDate('2026-01-09')).toBe(quoteForDate('2026-01-09'));
  });

  it('changes from one day to the next', () => {
    expect(quoteForDate('2026-01-09')).not.toBe(quoteForDate('2026-01-10'));
  });

  it('always returns a quote from the table', () => {
    const dates = Array.from(
      { length: 40 },
      (_, i) => `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
    );
    for (const d of dates) {
      expect(QUOTES).toContain(quoteForDate(d));
    }
  });

  it('reaches every quote in the table over a full cycle', () => {
    const seen = new Set<string>();
    for (let i = 0; i < QUOTES.length; i++) {
      const day = String(i + 1).padStart(2, '0');
      seen.add(quoteForDate(`2026-01-${day}`));
    }
    expect(seen.size).toBe(QUOTES.length);
  });
});

describe('buildDigest', () => {
  it('carries every field the daily email is specified to contain', () => {
    const digest = buildDigest({
      roadmapName: 'Blind 75',
      items: [item(1)],
      progress: PROGRESS,
      today: '2026-01-09',
    });

    // ROADMAP.md feature 5: title, link, difficulty, progress, a quote.
    expect(digest.roadmapName).toBe('Blind 75');
    expect(digest.items).toEqual([
      {
        title: 'Problem 1',
        url: 'https://leetcode.com/problems/p1',
        difficulty: 'MEDIUM',
      },
    ]);
    expect(digest.progress).toEqual(PROGRESS);
    expect(digest.quote).toBe(quoteForDate('2026-01-09'));
  });

  it('carries a list, because the quota can exceed one', () => {
    const digest = buildDigest({
      roadmapName: 'Blind 75',
      items: [item(1), item(2), item(3), item(4), item(5)],
      progress: PROGRESS,
      today: '2026-01-09',
    });
    expect(digest.items).toHaveLength(5);
    expect(digest.items.map((i) => i.title)).toEqual([
      'Problem 1',
      'Problem 2',
      'Problem 3',
      'Problem 4',
      'Problem 5',
    ]);
  });

  it('drops internal fields the email has no business knowing', () => {
    const digest = buildDigest({
      roadmapName: 'Blind 75',
      items: [item(1)],
      progress: PROGRESS,
      today: '2026-01-09',
    });
    expect(digest.items[0]).not.toHaveProperty('id');
    expect(digest.items[0]).not.toHaveProperty('position');
  });

  it('refuses to build an empty digest', () => {
    // Nothing to send means no email at all, which is the orchestrator's
    // decision to make before it gets here.
    expect(() =>
      buildDigest({
        roadmapName: 'Blind 75',
        items: [],
        progress: PROGRESS,
        today: '2026-01-09',
      }),
    ).toThrow();
  });
});
