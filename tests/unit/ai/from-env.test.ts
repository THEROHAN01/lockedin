import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviderFromEnv } from '@/ai/from-env';

describe('aiProviderFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when neither var is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('AI_MODEL', '');

    expect(aiProviderFromEnv()).toBeNull();
  });

  it('returns null when only the API key is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'key');
    vi.stubEnv('AI_MODEL', '');

    expect(aiProviderFromEnv()).toBeNull();
  });

  it('returns null when only the model is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('AI_MODEL', 'anthropic/claude-sonnet-5');

    expect(aiProviderFromEnv()).toBeNull();
  });

  it('returns a provider when both are set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'key');
    vi.stubEnv('AI_MODEL', 'anthropic/claude-sonnet-5');

    expect(aiProviderFromEnv()).not.toBeNull();
  });
});
