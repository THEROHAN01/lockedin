import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviderFromEnv } from '@/ai/from-env';

describe('aiProviderFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when AI_PROVIDER is unset', () => {
    vi.stubEnv('AI_PROVIDER', '');

    expect(aiProviderFromEnv()).toBeNull();
  });

  it('throws on an unrecognised AI_PROVIDER value, regardless of other vars', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('AI_MODEL', '');
    vi.stubEnv('AI_API_KEY', '');

    expect(() => aiProviderFromEnv()).toThrow(/openai/);
  });

  for (const provider of ['gateway', 'sarvam']) {
    describe(provider, () => {
      it('returns null when AI_MODEL is unset', () => {
        vi.stubEnv('AI_PROVIDER', provider);
        vi.stubEnv('AI_MODEL', '');
        vi.stubEnv('AI_API_KEY', 'key');

        expect(aiProviderFromEnv()).toBeNull();
      });

      it('returns null when AI_API_KEY is unset', () => {
        vi.stubEnv('AI_PROVIDER', provider);
        vi.stubEnv('AI_MODEL', 'some-model');
        vi.stubEnv('AI_API_KEY', '');

        expect(aiProviderFromEnv()).toBeNull();
      });

      it('returns a provider when both are set', () => {
        vi.stubEnv('AI_PROVIDER', provider);
        vi.stubEnv('AI_MODEL', 'some-model');
        vi.stubEnv('AI_API_KEY', 'key');

        expect(aiProviderFromEnv()).not.toBeNull();
      });
    });
  }
});
