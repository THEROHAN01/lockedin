import { createGatewayProvider } from './gateway-provider';
import type { AiProvider } from './provider';

/**
 * The production provider, wired from environment variables — deliberately
 * not the same shape as `emailChannelFromEnv`. Email is mandatory to the
 * product's job, so a missing value there fails loudly. AI has no consumer
 * yet and is best-effort infrastructure, so a missing value here is a normal,
 * expected state: this returns `null` rather than throwing, and every call
 * site is required to treat `null` as "fall back to the non-AI default."
 *
 * (The Gateway SDK reads `AI_GATEWAY_API_KEY` itself; it's checked explicitly
 * here so "not configured" is this clean `null` rather than a confusing
 * failure the first time something calls `generateText`.)
 */
export function aiProviderFromEnv(): AiProvider | null {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiKey || !model) return null;

  return createGatewayProvider({ model });
}
