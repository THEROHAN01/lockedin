import type { DailyDigest } from '@/domain/types';
import type { NotificationChannel, SendContext } from './channel';

interface Attempt {
  to: string;
  digest: DailyDigest;
  context: SendContext;
}

/**
 * The channel every test asserts against, so no test ever reaches Resend.
 *
 * It can be told to fail for particular recipients. That is not a convenience:
 * `send` returns a promise that can reject, and the cron sweep is required to
 * survive one roadmap's send failing. A fake that could only succeed would force
 * a second, ad-hoc double to be invented for that case, and then the two
 * implementations would no longer be tested against the same contract.
 *
 * `attempts` records failures too, because the idempotency key of a failed
 * attempt is exactly what a retry has to reuse.
 */
export class FakeChannel implements NotificationChannel {
  readonly attempts: Attempt[] = [];
  readonly sent: Attempt[] = [];
  readonly failed: string[] = [];

  private readonly failFor: ReadonlySet<string>;

  constructor(options: { failFor?: readonly string[] } = {}) {
    this.failFor = new Set(options.failFor ?? []);
  }

  send(to: string, digest: DailyDigest, context: SendContext): Promise<void> {
    this.attempts.push({ to, digest, context });

    if (this.failFor.has(to)) {
      this.failed.push(to);
      return Promise.reject(new Error(`FakeChannel was told to fail for ${to}`));
    }

    this.sent.push({ to, digest, context });
    return Promise.resolve();
  }
}
