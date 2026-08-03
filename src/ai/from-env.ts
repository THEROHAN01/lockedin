import { createGatewayProvider } from './gateway-provider';
import { createSarvamProvider } from './sarvam-provider';
import type { AiProvider } from './provider';

/**
 * The production provider, wired from environment variables — deliberately
 * not the same shape as `emailChannelFromEnv`. Email is mandatory to the
 * product's job, so a missing value there fails loudly. AI is best-effort
 * infrastructure — the daily quote falls back to a static table if this
 * returns `null` (ADR-017) — so a missing value here is a normal, expected
 * state: this returns `null` rather than throwing, and every call site is
 * required to treat `null` as "fall back to the non-AI default."
 *
 * Exactly three variables, generic across every provider: `AI_PROVIDER`
 * picks the implementation, `AI_MODEL` and `AI_API_KEY` are handed to
 * whichever one that is (ADR-018). Switching providers means changing all
 * three together — there is no `SARVAM_*`- or `GATEWAY_*`-prefixed variable
 * to remember, and adding a third provider later needs no new variable
 * names, only a new `if` branch here.
 *
 * `AI_PROVIDER` unset is "not configured" (`null`); set to something neither
 * implementation recognises is a real mistake and throws, the same
 * distinction ADR-016 drew.
 */
export function aiProviderFromEnv(): AiProvider | null {
  const selected = process.env.AI_PROVIDER;
  if (!selected) return null;

  if (selected !== 'gateway' && selected !== 'sarvam') {
    throw new Error(
      `AI_PROVIDER is "${selected}", but only "gateway" and "sarvam" are recognised.`,
    );
  }

  const model = process.env.AI_MODEL;
  const apiKey = process.env.AI_API_KEY;
  if (!model || !apiKey) return null;

  return selected === 'gateway'
    ? createGatewayProvider({ apiKey, model })
    : createSarvamProvider({ apiKey, model });
}
