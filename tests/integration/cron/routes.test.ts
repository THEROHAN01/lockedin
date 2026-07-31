import { describe, expect, it, vi } from 'vitest';
import { request } from '../../helpers/api';
import { GET as cron } from '@app/api/cron/send-daily/route';
import { POST as sendNow } from '@app/api/dev/send-now/route';

/**
 * The routes' own responsibility is authentication and wiring; the sweep itself is
 * covered against a FakeChannel in send-daily-digests.test.ts. These run with an
 * empty database, so no roadmap is due and the real channel is never used.
 */

function withSecret(secret: string): Request {
  const headers = new Headers({ authorization: `Bearer ${secret}` });
  return new Request('http://localhost:3000/api/cron/send-daily', { headers });
}

describe('GET /api/cron/send-daily', () => {
  it('is 401 without an Authorization header', async () => {
    expect((await cron(request('GET'))).status).toBe(401);
  });

  it('is 401 with the wrong secret', async () => {
    expect((await cron(withSecret('not-the-secret'))).status).toBe(401);
  });

  it('is 401 for a bare token without the Bearer scheme', async () => {
    const secret = process.env.CRON_SECRET ?? '';
    const headers = new Headers({ authorization: secret });
    const response = await cron(
      new Request('http://localhost:3000/api/cron/send-daily', { headers }),
    );
    expect(response.status).toBe(401);
  });

  it('reports the sweep result with the right secret', async () => {
    const secret = process.env.CRON_SECRET;
    expect(secret, 'CRON_SECRET must be set in .env for this test').toBeTruthy();

    const response = await cron(withSecret(secret!));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });
});

describe('POST /api/dev/send-now', () => {
  it('runs outside production', async () => {
    const response = await sendNow();
    expect(response.status).toBe(200);
  });

  it('does not exist in production', async () => {
    // Unauthenticated by design, so the guarantee has to be that it is absent
    // rather than protected.
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect((await sendNow()).status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
