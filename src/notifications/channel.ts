import type { DailyDigest } from '@/domain/types';

/**
 * How a digest reaches a person.
 *
 * `ROADMAP.md` requires that the code deciding *what* to send and *when* not be
 * entangled with the code deciding *how*. This is that seam. Email is the only
 * implementation in the MVP; WhatsApp and push are deferred.
 *
 * One honest caveat, also in ARCHITECTURE.md §2: adding a channel is not purely
 * "write a new implementation". The sweep currently takes one channel for the
 * whole run, so per-user preference will need a field on the user and a change
 * from "take a channel" to "resolve a channel per roadmap". What this seam buys
 * is that the domain and the digest logic do not move.
 *
 * `to` is deliberately an opaque string rather than an email address, so a phone
 * number or device token fits without changing the signature.
 */

export interface SendContext {
  /**
   * Stable identity for this delivery, for provider-side deduplication.
   *
   * Not decoration. The sweep gives its send-log claim back when a send throws,
   * so it can retry on the next tick — which means an *ambiguous* failure, a
   * timeout after the provider already accepted the message, would otherwise
   * deliver twice. Passing the same key on the retry lets the provider collapse
   * them. Every channel worth using supports some form of this.
   */
  idempotencyKey: string;
}

export interface NotificationChannel {
  send(to: string, digest: DailyDigest, context: SendContext): Promise<void>;
}
