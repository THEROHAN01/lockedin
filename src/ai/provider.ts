/**
 * The seam for invoking an AI model from anywhere in the codebase.
 *
 * Deliberately one method, one string in, one string out. This is a
 * text-generation seam, not an agent framework — tool-calling and multi-turn
 * state for later agentic work are a different, richer interface, and
 * speculatively building that in now would be guessing at a shape no real
 * caller has justified yet. `NotificationChannel` grew its `SendContext`
 * parameter only when ADR-013 needed it; this interface should grow the same
 * way, from a real second requirement rather than in advance of one.
 */
export interface AiProvider {
  generateText(prompt: string): Promise<string>;
}
