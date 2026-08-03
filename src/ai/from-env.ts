import { createGatewayProvider } from './gateway-provider';
import { createSarvamProvider } from './sarvam-provider';
import type { AiProvider } from './provider';

/**
 * The production provider, wired from environment variables — deliberately
 * not the same shape as `emailChannelFromEnv`. Email is mandatory to the
 * product's job, so a missing value there fails loudly. AI has no consumer
 * yet and is best-effort infrastructure, so a missing value here is a normal,
 * expected state: this returns `null` rather than throwing, and every call
 * site is required to treat `null` as "fall back to the non-AI default."
 *
 * `AI_PROVIDER` picks which implementation to build, rather than inferring it
 * from which keys happen to be set — an implicit "whichever key is present
 * wins" fallback chain would silently change providers the moment both keys
 * exist (e.g. one left over from testing), which is exactly the kind of
 * config-driven surprise `emailChannelFromEnv`'s "one place reads it" model
 * exists to avoid. `AI_PROVIDER` unset is "not configured" (`null`);
 * `AI_PROVIDER` set to something unrecognised is a real mistake and throws.
 *
 * (The Gateway SDK reads `AI_GATEWAY_API_KEY` itself; it's checked explicitly
 * here anyway so "not configured" is this clean `null` rather than a
 * confusing failure the first time something calls `generateText`.)
 */
export function aiProviderFromEnv(): AiProvider | null {
  const selected = process.env.AI_PROVIDER;
  if (!selected) return null;

  if (selected === 'gateway') {
    const model = process.env.AI_MODEL;
    if (!model) return null;
    return createGatewayProvider({ model });
  }

  if (selected === 'sarvam') {
    const apiKey = process.env.SARVAM_API_KEY;
    const model = process.env.SARVAM_MODEL;
    if (!apiKey || !model) return null;
    return createSarvamProvider({ apiKey, model });
  }

  throw new Error(
    `AI_PROVIDER is "${selected}", but only "gateway" and "sarvam" are recognised.`,
  );
}
