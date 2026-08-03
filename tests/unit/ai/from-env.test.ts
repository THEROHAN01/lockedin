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

  it('throws on an unrecognised AI_PROVIDER value', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');

    expect(() => aiProviderFromEnv()).toThrow(/openai/);
  });

  describe('gateway', () => {
    it('returns null when AI_MODEL is unset', () => {
      vi.stubEnv('AI_PROVIDER', 'gateway');
      vi.stubEnv('AI_MODEL', '');

      expect(aiProviderFromEnv()).toBeNull();
    });

    it('returns a provider when AI_MODEL is set', () => {
      vi.stubEnv('AI_PROVIDER', 'gateway');
      vi.stubEnv('AI_MODEL', 'anthropic/claude-sonnet-5');

      expect(aiProviderFromEnv()).not.toBeNull();
    });
  });

  describe('sarvam', () => {
    it('returns null when only the API key is set', () => {
      vi.stubEnv('AI_PROVIDER', 'sarvam');
      vi.stubEnv('SARVAM_API_KEY', 'key');
      vi.stubEnv('SARVAM_MODEL', '');

      expect(aiProviderFromEnv()).toBeNull();
    });

    it('returns null when only the model is set', () => {
      vi.stubEnv('AI_PROVIDER', 'sarvam');
      vi.stubEnv('SARVAM_API_KEY', '');
      vi.stubEnv('SARVAM_MODEL', 'sarvam-105b');

      expect(aiProviderFromEnv()).toBeNull();
    });

    it('returns a provider when both are set', () => {
      vi.stubEnv('AI_PROVIDER', 'sarvam');
      vi.stubEnv('SARVAM_API_KEY', 'key');
      vi.stubEnv('SARVAM_MODEL', 'sarvam-105b');

      expect(aiProviderFromEnv()).not.toBeNull();
    });
  });
});
