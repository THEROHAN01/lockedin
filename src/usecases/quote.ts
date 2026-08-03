import { quoteForDate } from '@/domain/digest';
import type { AiProvider } from '@/ai/provider';
import type { LocalDate } from '@/domain/types';

const MOTIVATIONAL_PROMPT =
  'Write one short, original, motivating sentence (max 25 words) for someone ' +
  'working through LeetCode problems as part of a daily study habit. Use ' +
  'different wording each time you are asked — do not repeat a previous ' +
  'phrasing. Plain text only: no quotation marks, no attribution, no emoji, ' +
  'no markdown.';

/**
 * Where the digest's quote actually comes from.
 *
 * Falls back to the static `quoteForDate` table — deterministic, no I/O —
 * whenever there is no provider configured, the provider returns nothing
 * usable, or the call fails outright. The same reasoning ADR-013 applied to
 * the send itself applies here: an optional enhancement failing must never
 * be what blocks a digest from going out.
 */
export async function resolveDailyQuote(
  provider: AiProvider | null,
  today: LocalDate,
): Promise<string> {
  if (!provider) return quoteForDate(today);

  try {
    const text = (await provider.generateText(MOTIVATIONAL_PROMPT)).trim();
    return text.length > 0 ? text : quoteForDate(today);
  } catch {
    return quoteForDate(today);
  }
}
