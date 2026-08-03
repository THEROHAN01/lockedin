import { describe, expect, it } from 'vitest';
import { FakeAiProvider } from '@/ai/fake-provider';

describe('FakeAiProvider', () => {
  it('returns the default canned response', async () => {
    const provider = new FakeAiProvider();
    await expect(provider.generateText('give me a quote')).resolves.toBe(
      'A fake motivational quote.',
    );
  });

  it('records every prompt it was called with, in order', async () => {
    const provider = new FakeAiProvider();
    await provider.generateText('first');
    await provider.generateText('second');

    expect(provider.prompts).toEqual(['first', 'second']);
  });

  it('can respond as a function of the prompt', async () => {
    const provider = new FakeAiProvider({
      response: (prompt) => `echo: ${prompt}`,
    });

    await expect(provider.generateText('hi')).resolves.toBe('echo: hi');
  });

  it('can be told to fail', async () => {
    // generateText returns a promise that can reject, and any real call site
    // is required to fall back rather than let that reach a user. Without
    // this the fake could only model the happy path.
    const provider = new FakeAiProvider({ shouldFail: true });

    await expect(provider.generateText('give me a quote')).rejects.toThrow();
  });

  it('still records the prompt on a failed call', async () => {
    const provider = new FakeAiProvider({ shouldFail: true });
    await provider.generateText('give me a quote').catch(() => undefined);

    expect(provider.prompts).toEqual(['give me a quote']);
  });
});
