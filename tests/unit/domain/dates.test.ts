import { describe, expect, it } from 'vitest';
import {
  daysInclusive,
  isSendDue,
  localDateFor,
  localTimeFor,
} from '@/domain/dates';

/**
 * All pure. No clock, no mocking — the instant is always an argument.
 */

describe('daysInclusive', () => {
  it('counts a single day as one', () => {
    expect(daysInclusive('2026-01-01', '2026-01-01')).toBe(1);
  });

  it('counts a January roadmap as thirty days', () => {
    expect(daysInclusive('2026-01-01', '2026-01-30')).toBe(30);
  });

  it('counts the final day as one', () => {
    expect(daysInclusive('2026-01-30', '2026-01-30')).toBe(1);
  });

  it('goes non-positive once the end date has passed', () => {
    // Callers floor this at 1. Returning a negative rather than clamping keeps
    // the function honest about direction.
    expect(daysInclusive('2026-02-02', '2026-01-30')).toBe(-2);
  });

  it('is unaffected by daylight saving transitions', () => {
    // Local dates are calendar values, not instants. Spanning the US spring
    // forward must still be three days, not 2.958.
    expect(daysInclusive('2026-03-07', '2026-03-09')).toBe(3);
  });

  it('spans a leap day', () => {
    expect(daysInclusive('2028-02-28', '2028-03-01')).toBe(3);
  });

  it('rejects a malformed date', () => {
    expect(() => daysInclusive('01-01-2026', '2026-01-30')).toThrow();
    expect(() => daysInclusive('2026-13-01', '2026-01-30')).toThrow();
  });
});

describe('localDateFor', () => {
  it('rolls forward for a positive offset zone', () => {
    // 19:00 UTC is 00:30 the next day in Kolkata (+05:30).
    expect(
      localDateFor(new Date('2026-01-01T19:00:00Z'), 'Asia/Kolkata'),
    ).toBe('2026-01-02');
  });

  it('stays on the same day just before the roll', () => {
    expect(
      localDateFor(new Date('2026-01-01T18:29:00Z'), 'Asia/Kolkata'),
    ).toBe('2026-01-01');
  });

  it('rolls backward for a negative offset zone', () => {
    // 05:00 UTC is still the previous evening in Niue (-11:00).
    expect(localDateFor(new Date('2026-01-01T05:00:00Z'), 'Pacific/Niue')).toBe(
      '2025-12-31',
    );
  });

  it('gives two roadmaps in different zones different local dates at one instant', () => {
    const instant = new Date('2026-01-01T19:00:00Z');
    expect(localDateFor(instant, 'Asia/Kolkata')).toBe('2026-01-02');
    expect(localDateFor(instant, 'America/New_York')).toBe('2026-01-01');
  });

  it('rejects an unknown time zone', () => {
    expect(() =>
      localDateFor(new Date('2026-01-01T00:00:00Z'), 'Mars/Olympus_Mons'),
    ).toThrow();
  });
});

describe('localTimeFor', () => {
  it('formats as 24-hour HH:mm', () => {
    expect(
      localTimeFor(new Date('2026-01-01T19:00:00Z'), 'Asia/Kolkata'),
    ).toBe('00:30');
  });

  it('uses 00 rather than 24 at midnight', () => {
    expect(localTimeFor(new Date('2026-01-01T00:00:00Z'), 'UTC')).toBe('00:00');
  });

  it('reads standard time before the DST transition', () => {
    // US spring forward 2026 is 08 March at 02:00 local.
    expect(
      localTimeFor(new Date('2026-03-08T06:30:00Z'), 'America/New_York'),
    ).toBe('01:30');
  });

  it('reads daylight time after the DST transition', () => {
    expect(
      localTimeFor(new Date('2026-03-08T07:30:00Z'), 'America/New_York'),
    ).toBe('03:30');
  });
});

describe('isSendDue', () => {
  it('is due exactly at the send time', () => {
    expect(isSendDue('07:00', '07:00')).toBe(true);
  });

  it('is not due one minute before', () => {
    expect(isSendDue('06:59', '07:00')).toBe(false);
  });

  it('is still due late in the day', () => {
    // Self-healing: a missed cron run must still deliver later the same day.
    expect(isSendDue('23:59', '07:00')).toBe(true);
  });

  it('is not due at all before a late send time', () => {
    expect(isSendDue('00:00', '22:00')).toBe(false);
  });

  it('rejects a malformed send time', () => {
    expect(() => isSendDue('07:00', '7am')).toThrow();
    expect(() => isSendDue('07:00', '24:00')).toThrow();
    expect(() => isSendDue('07:00', '07:60')).toThrow();
  });
});
