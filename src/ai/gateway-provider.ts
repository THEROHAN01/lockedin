import { createGateway, generateText } from 'ai';
import type { AiProvider } from './provider';

/**
 * Real implementation, backed by the Vercel AI SDK's Gateway. `model` is a
 * plain string (e.g. "anthropic/claude-sonnet-5") rather than a
 * provider-specific import, so swapping models or providers later is a
 * config change here, not a code change — the same reason Resend sits behind
 * `NotificationChannel` instead of being called directly.
 *
 * `apiKey` is passed to `createGateway` explicitly rather than left for the
 * SDK to read `AI_GATEWAY_API_KEY` itself, so this provider takes the same
 * shape as `createSarvamProvider` — one generic `AI_API_KEY` covers whichever
 * provider `AI_PROVIDER` selects (ADR-018) instead of a provider-specific
 * variable name.
 *
 * Both deps are injected rather than read from `process.env` here, so this
 * file is testable without env-stubbing; `from-env.ts` owns reading the
 * environment.
 */
export function createGatewayProvider(deps: {
  apiKey: string;
  model: string;
}): AiProvider {
  const model = createGateway({ apiKey: deps.apiKey })(deps.model);

  return {
    async generateText(prompt: string): Promise<string> {
      const { text } = await generateText({ model, prompt });
      return text;
    },
  };
}
