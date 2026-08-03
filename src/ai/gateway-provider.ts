import { generateText } from 'ai';
import type { AiProvider } from './provider';

/**
 * Real implementation, backed by the Vercel AI SDK's default Gateway
 * provider. `model` is a plain string (e.g. "anthropic/claude-sonnet-5")
 * rather than a provider-specific import, so swapping models or providers
 * later is a config change here, not a code change — the same reason Resend
 * sits behind `NotificationChannel` instead of being called directly.
 *
 * `model` is an injected dep rather than read from `process.env` here, so
 * this file is testable without env-stubbing; `from-env.ts` owns reading the
 * environment.
 */
export function createGatewayProvider(deps: { model: string }): AiProvider {
  return {
    async generateText(prompt: string): Promise<string> {
      const { text } = await generateText({ model: deps.model, prompt });
      return text;
    },
  };
}
