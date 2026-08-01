import { createEmailChannel, resendSender } from './email-channel';
import type { NotificationChannel } from './channel';

/**
 * The production channel, wired from environment variables.
 *
 * One place reads the mail configuration, so a missing value fails immediately
 * and identically wherever a digest is sent from. Tests never call this — they
 * pass a FakeChannel into the sweep directly.
 */
export function emailChannelFromEnv(): NotificationChannel {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');
  if (!from) throw new Error('EMAIL_FROM is not set.');

  return createEmailChannel({ sender: resendSender(apiKey), from });
}
