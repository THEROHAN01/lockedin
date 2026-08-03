import { describe, expect, it } from 'vitest';
import { quoteForDate } from '@/domain/digest';
import { FakeAiProvider } from '@/ai/fake-provider';
import { resolveDailyQuote } from '@/usecases/quote';

// Usecases normally need the database or the clock (ARCHITECTURE.md §9), which
// is why they're tested through integration. This one needs neither — its only
// dependency is the injected AiProvider, faked below — so it belongs here.

describe('resolveDailyQuote', () => {
  it('falls back to the static table when no provider is configured', async () => {
    await expect(resolveDailyQuote(null, '2026-01-09')).resolves.toBe(
      quoteForDate('2026-01-09'),
    );
  });

  it('returns the provider\'s text when it succeeds', async () => {
    const provider = new FakeAiProvider({ response: 'Keep going.' });
    await expect(resolveDailyQuote(provider, '2026-01-09')).resolves.toBe(
      'Keep going.',
    );
  });

  it('falls back to the static table when the provider returns nothing usable', async () => {
    const provider = new FakeAiProvider({ response: '   ' });
    await expect(resolveDailyQuote(provider, '2026-01-09')).resolves.toBe(
      quoteForDate('2026-01-09'),
    );
  });

  it('falls back to the static table when the provider call fails', async () => {
    // An optional enhancement failing must never be what blocks a digest —
    // same reasoning ADR-013 applied to the send itself.
    const provider = new FakeAiProvider({ shouldFail: true });
    await expect(resolveDailyQuote(provider, '2026-01-09')).resolves.toBe(
      quoteForDate('2026-01-09'),
    );
  });

  it('sends the same motivational prompt regardless of the date', async () => {
    const provider = new FakeAiProvider();
    await resolveDailyQuote(provider, '2026-01-09');
    await resolveDailyQuote(provider, '2026-01-10');

    expect(provider.prompts).toHaveLength(2);
    expect(provider.prompts[0]).toBe(provider.prompts[1]);
  });
});
