import { SarvamAIClient, type SarvamAI } from 'sarvamai';
import type { AiProvider } from './provider';

/**
 * Second implementation of the seam, over Sarvam's chat completion API.
 *
 * `model` is typed as a plain string here even though the SDK's own request
 * type narrows it to a three-member literal union (`sarvam-105b` |
 * `sarvam-30b` | `sarvam-m`) — same reasoning as the Gateway provider's model
 * string: it comes from configuration, not a compile-time choice, so the cast
 * happens once, here, rather than pushing the SDK's literal type out to
 * `from-env.ts` or the interface.
 *
 * `content` on the response message is optional in the SDK's types (a tool
 * call or a refusal can leave it unset); returning `''` in that case is a
 * caller-visible signal of "nothing to say" rather than throwing, since a
 * missing message is a valid response shape, not a transport failure.
 */
export function createSarvamProvider(deps: {
  apiKey: string;
  model: string;
}): AiProvider {
  const client = new SarvamAIClient({ apiSubscriptionKey: deps.apiKey });

  return {
    async generateText(prompt: string): Promise<string> {
      const response = await client.chat.completions({
        model: deps.model as SarvamAI.SarvamModelIds,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.choices[0]?.message.content ?? '';
    },
  };
}
