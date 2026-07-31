import { daysInclusive } from './dates';
import type { LocalDate, Progress } from './types';

/**
 * How far along a roadmap is, in both problems and days.
 *
 * Days elapsed is clamped to the roadmap's length: nagging continues past the
 * end date, but "day 47 of 30" is nonsense in an email.
 */
export function computeProgress(input: {
  completedCount: number;
  totalCount: number;
  startDate: LocalDate;
  endDate: LocalDate;
  today: LocalDate;
}): Progress {
  const { completedCount, totalCount, startDate, endDate, today } = input;

  const totalDays = daysInclusive(startDate, endDate);
  if (totalDays < 1) {
    throw new Error(
      `endDate ${endDate} is before startDate ${startDate}; a roadmap must span at least one day`,
    );
  }

  const sinceStart = daysInclusive(startDate, today);
  const daysElapsed = Math.min(totalDays, Math.max(0, sinceStart));

  return { completedCount, totalCount, daysElapsed, totalDays };
}
