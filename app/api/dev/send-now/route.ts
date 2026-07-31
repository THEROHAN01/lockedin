import { emailChannelFromEnv } from '@/notifications/from-env';
import { sendDailyDigests } from '@/usecases/send-daily-digests';

/**
 * Runs the sweep on demand so a real email can be put in a real inbox while
 * developing, without waiting for the next quarter hour.
 *
 * Refuses to exist in production. It has no authentication, and it must not:
 * adding one would make it a second, weaker path to triggering sends. Not
 * existing is the stronger guarantee.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 });
  }

  const result = await sendDailyDigests(new Date(), emailChannelFromEnv());
  return Response.json(result);
}
