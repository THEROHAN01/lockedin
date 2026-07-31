import { describe, expect, it } from 'vitest';
import { computeProgress } from '@/domain/progress';

const SPAN = { startDate: '2026-01-01', endDate: '2026-01-30' } as const;

describe('computeProgress', () => {
  it('reports both halves: problems solved and days elapsed', () => {
    expect(
      computeProgress({ ...SPAN, completedCount: 7, totalCount: 30, today: '2026-01-09' }),
    ).toEqual({
      completedCount: 7,
      totalCount: 30,
      daysElapsed: 9,
      totalDays: 30,
    });
  });

  it('counts the start day as day one', () => {
    const p = computeProgress({
      ...SPAN,
      completedCount: 0,
      totalCount: 30,
      today: '2026-01-01',
    });
    expect(p.daysElapsed).toBe(1);
  });

  it('reports zero days elapsed before the roadmap starts', () => {
    const p = computeProgress({
      ...SPAN,
      completedCount: 0,
      totalCount: 30,
      today: '2025-12-28',
    });
    expect(p.daysElapsed).toBe(0);
  });

  it('clamps days elapsed once the end date has passed', () => {
    // The roadmap keeps nagging past its end date, but "day 47 of 30" is
    // nonsense in an email.
    const p = computeProgress({
      ...SPAN,
      completedCount: 4,
      totalCount: 30,
      today: '2026-02-16',
    });
    expect(p.daysElapsed).toBe(30);
    expect(p.totalDays).toBe(30);
  });

  it('handles a roadmap with no items yet', () => {
    expect(
      computeProgress({ ...SPAN, completedCount: 0, totalCount: 0, today: '2026-01-09' }),
    ).toEqual({
      completedCount: 0,
      totalCount: 0,
      daysElapsed: 9,
      totalDays: 30,
    });
  });

  it('handles a single-day roadmap', () => {
    const p = computeProgress({
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      completedCount: 1,
      totalCount: 1,
      today: '2026-01-01',
    });
    expect(p).toEqual({
      completedCount: 1,
      totalCount: 1,
      daysElapsed: 1,
      totalDays: 1,
    });
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      computeProgress({
        startDate: '2026-01-30',
        endDate: '2026-01-01',
        completedCount: 0,
        totalCount: 5,
        today: '2026-01-30',
      }),
    ).toThrow();
  });
});
