import { describe, expect, it } from 'vitest';
import { DAILY_CAP, computeDailyQuota } from '@/domain/quota';

/**
 * The pacing rule: ceil(remaining / daysLeft), daysLeft inclusive of today,
 * floored at 1 once the end date has passed, capped at DAILY_CAP.
 *
 * Nothing is persisted, so this is a pure function of current state — which is
 * what lets a user edit their dates and have the next email simply reflect it.
 */

const END = '2026-01-30';

describe('computeDailyQuota — the worked example from docs/ARCHITECTURE.md §4', () => {
  // 30 items, Jan 1 -> Jan 30, user ignores Jan 2-5.
  it.each([
    ['2026-01-01', 30, 1, 'on schedule at the start'],
    ['2026-01-06', 30, 2, 'after ignoring four days'],
    ['2026-01-07', 28, 2, 'having caught up two'],
    ['2026-01-28', 8, 3, 'near the deadline'],
    ['2026-01-30', 6, 5, 'final day, capped'],
    ['2026-02-02', 6, 5, 'past the end date, still nagging'],
  ])('%s with %i remaining sends %i (%s)', (today, remainingCount, expected) => {
    expect(computeDailyQuota({ remainingCount, today, endDate: END })).toBe(
      expected,
    );
  });
});

describe('computeDailyQuota', () => {
  it('sends nothing when the roadmap is finished', () => {
    expect(
      computeDailyQuota({ remainingCount: 0, today: '2026-01-06', endDate: END }),
    ).toBe(0);
  });

  it('never sends fewer than one while anything remains', () => {
    // 1 item spread over 30 days rounds to 1, not 0.
    expect(
      computeDailyQuota({ remainingCount: 1, today: '2026-01-01', endDate: END }),
    ).toBe(1);
  });

  it('never sends more than the cap', () => {
    expect(
      computeDailyQuota({
        remainingCount: 500,
        today: '2026-01-30',
        endDate: END,
      }),
    ).toBe(DAILY_CAP);
  });

  it('floors days-left at one rather than dividing by zero or a negative', () => {
    const wellPastEnd = computeDailyQuota({
      remainingCount: 3,
      today: '2027-06-01',
      endDate: END,
    });
    expect(wellPastEnd).toBe(3);
  });

  it('raises the daily load gradually as the deficit grows', () => {
    // The reason for choosing remaining/daysLeft over a cumulative pace line:
    // ignoring the email must not produce a punishing catch-up bill.
    const quotas = ['2026-01-06', '2026-01-14', '2026-01-22'].map((today) =>
      computeDailyQuota({ remainingCount: 30, today, endDate: END }),
    );
    expect(quotas).toEqual([2, 2, 4]);
    expect(quotas[0]).toBeLessThan(quotas[2]!);
  });

  it('caps at five, which is the documented value', () => {
    expect(DAILY_CAP).toBe(5);
  });

  it('rejects a malformed date rather than guessing', () => {
    expect(() =>
      computeDailyQuota({
        remainingCount: 5,
        today: 'tomorrow',
        endDate: END,
      }),
    ).toThrow();
  });
});
