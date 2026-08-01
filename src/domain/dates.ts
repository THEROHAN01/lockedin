import type { LocalDate, LocalTime } from './types';

/**
 * Calendar and wall-clock arithmetic. Pure: the current instant is never read
 * here, only received as an argument.
 *
 * Local dates are treated as calendar values, not instants — they are parsed to
 * UTC midnight so that day arithmetic is immune to daylight saving. A roadmap
 * spanning a spring-forward is still exactly N days long.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_DAY = 86_400_000;

function toUtcMidnight(date: LocalDate): number {
  const match = DATE_PATTERN.exec(date);
  if (match === null) {
    throw new Error(`Invalid LocalDate "${date}", expected YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);

  // Date.UTC happily rolls 2026-13-01 into 2027, and 2026-02-30 into March.
  // Round-tripping rejects both, and rejects NaN for free.
  const roundTrip = new Date(ms);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new Error(`Invalid LocalDate "${date}", no such calendar day`);
  }

  return ms;
}

function minutesIntoDay(time: LocalTime): number {
  const match = TIME_PATTERN.exec(time);
  if (match === null) {
    throw new Error(`Invalid LocalTime "${time}", expected HH:mm (24-hour)`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatPartsIn(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  // Throws RangeError on an unknown IANA zone, which is the behaviour we want.
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return parts;
}

function requirePart(parts: Record<string, string>, key: string): string {
  const value = parts[key];
  if (value === undefined) {
    throw new Error(`Intl returned no "${key}" part for the requested format`);
  }
  return value;
}

/**
 * Whether a string names a time zone this runtime knows.
 *
 * Worth checking at the boundary: an unknown zone is accepted silently by the
 * database and then throws deep inside the cron sweep, days later.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A `LocalDate` as the UTC-midnight instant Postgres stores for a `date` column.
 *
 * Pure — this reads no clock, it only reinterprets a calendar value. Used by the
 * data layer, which owns the database representation; the domain itself never
 * handles instants for calendar values.
 */
export function localDateToUtcDate(date: LocalDate): Date {
  return new Date(toUtcMidnight(date));
}

/** The inverse: a UTC-midnight `date` column value back to a `LocalDate`. */
export function utcDateToLocalDate(instant: Date): LocalDate {
  const iso = instant.toISOString();
  return iso.slice(0, iso.indexOf('T'));
}

/**
 * Days from `from` to `to` counting both ends, so a single day is 1.
 *
 * Goes non-positive once `to` is in the past. Callers floor it — the pacing rule
 * uses `Math.max(1, ...)` — but this function stays honest about direction
 * rather than silently clamping.
 */
export function daysInclusive(from: LocalDate, to: LocalDate): number {
  const span = toUtcMidnight(to) - toUtcMidnight(from);
  return Math.round(span / MS_PER_DAY) + 1;
}

/** The calendar date at `instant`, as seen in `timeZone`. */
export function localDateFor(instant: Date, timeZone: string): LocalDate {
  const parts = formatPartsIn(instant, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return `${requirePart(parts, 'year')}-${requirePart(parts, 'month')}-${requirePart(parts, 'day')}`;
}

/** The wall-clock time at `instant`, as seen in `timeZone`. */
export function localTimeFor(instant: Date, timeZone: string): LocalTime {
  const parts = formatPartsIn(instant, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${requirePart(parts, 'hour')}:${requirePart(parts, 'minute')}`;
}

/**
 * Whether today's digest is owed, given the roadmap's local wall clock.
 *
 * Deliberately "at or after", not "within a window around". The cron polls every
 * 15 minutes; pairing this with the SendLog uniqueness constraint means a missed
 * or failed run still delivers later the same day, with no retry state to keep.
 */
export function isSendDue(
  localTime: LocalTime,
  sendTimeLocal: LocalTime,
): boolean {
  return minutesIntoDay(localTime) >= minutesIntoDay(sendTimeLocal);
}
