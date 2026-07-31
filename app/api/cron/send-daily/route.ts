import { unauthenticated } from '@/http/respond';
import { emailChannelFromEnv } from '@/notifications/from-env';
import { sendDailyDigests } from '@/usecases/send-daily-digests';

/**
 * The daily trigger, called by Vercel Cron every 15 minutes.
 *
 * This mutates on GET, which violates GET-safety. Vercel Cron only issues GET
 * requests to the configured path, so there is no alternative verb available
 * (ADR-006/007). Two mitigations: the Bearer secret controls who can trigger it,
 * and `force-dynamic` below means a cached 200 can never be served in place of
 * actually running the sweep.
 *
 * A per-roadmap failure is reported in the body, not as an HTTP error: the sweep
 * deliberately survives one roadmap failing, so the request itself succeeded.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  // A plain comparison is adequate for a 256-bit random token behind network
  // jitter; the interesting failure here is a missing secret, not a timing leak.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return unauthenticated();
  }

  const result = await sendDailyDigests(new Date(), emailChannelFromEnv());
  return Response.json(result);
}
