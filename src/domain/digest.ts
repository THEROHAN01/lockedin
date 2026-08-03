import { daysInclusive } from './dates';
import type { DailyDigest, LocalDate, Progress, RoadmapItem } from './types';

/**
 * Composes the daily email's payload.
 *
 * The quote table lives here rather than in a file of its own: it is a constant
 * with exactly one consumer, and a module per constant is boilerplate.
 * Unattributed on purpose — a misattributed quote is worse than an anonymous one.
 */

export const QUOTES: readonly string[] = [
  'The only way past it is through it.',
  'You do not have to be fast. You have to be regular.',
  'A problem you cannot solve today is a problem you have not seen enough of.',
  'Discipline is choosing what you want most over what you want now.',
  'Every expert was once a beginner who refused to stop.',
  'Confusion is the feeling of learning something.',
  'Small daily improvements are what compound into mastery.',
  'The problem is not that it is hard. The problem is expecting it not to be.',
  'Start before you feel ready, because you will not feel ready.',
  'Consistency beats intensity, every single week.',
  'You cannot think your way to a solution you have never practised.',
  'Show up today. That is the whole trick.',
];

const EPOCH: LocalDate = '1970-01-01';

/**
 * A stable quote per calendar day: the same date always yields the same quote,
 * and consecutive days step through the table. Deterministic so it is testable
 * and so re-rendering an email never changes it.
 */
export function quoteForDate(date: LocalDate): string {
  const dayNumber = daysInclusive(EPOCH, date) - 1;
  const size = QUOTES.length;
  if (size === 0) throw new Error('the quote table is empty');

  const index = ((dayNumber % size) + size) % size;
  const quote = QUOTES[index];
  if (quote === undefined) throw new Error(`no quote at index ${index}`);
  return quote;
}

export function buildDigest(input: {
  roadmapName: string;
  items: readonly RoadmapItem[];
  progress: Progress;
  quote: string;
}): DailyDigest {
  const { roadmapName, items, progress, quote } = input;

  if (items.length === 0) {
    throw new Error(
      'refusing to build an empty digest; deciding not to send is the caller’s job',
    );
  }

  return {
    roadmapName,
    // Projected down deliberately: the email has no business knowing about
    // internal ids or ordering.
    items: items.map(({ title, url, difficulty }) => ({
      title,
      url,
      difficulty,
    })),
    progress,
    quote,
  };
}
