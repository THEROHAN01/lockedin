import { daysInclusive } from './dates';
import type { LocalDate } from './types';

/**
 * How many problems today's email carries.
 *
 * Rate-based and recomputed on every send — nothing is persisted, no item is
 * ever assigned to a date. That is what lets a user change their end date, or
 * add items, and have the next email simply reflect it. See ARCHITECTURE.md §4.
 */

/**
 * A twenty-problem email is noise rather than a nudge, so the daily count is
 * bounded regardless of how far behind the user is.
 *
 * Not a parameter: no field on Roadmap configures it, so an overridable
 * argument would be a knob with no caller.
 */
export const DAILY_CAP = 5;

export function computeDailyQuota(input: {
  remainingCount: number;
  today: LocalDate;
  endDate: LocalDate;
}): number {
  const { remainingCount, today, endDate } = input;

  // Validate dates even when there is nothing to send, so a malformed roadmap
  // fails loudly rather than looking finished.
  const daysLeft = Math.max(1, daysInclusive(today, endDate));

  if (remainingCount <= 0) return 0;

  const perDay = Math.ceil(remainingCount / daysLeft);
  return Math.min(DAILY_CAP, Math.max(1, perDay));
}
