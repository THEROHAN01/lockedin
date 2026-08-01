import { describe, expect, it } from 'vitest';
import { request } from '../../helpers/api';
import { makeRoadmap, makeUser } from '../../helpers/factories';
import { appendItems } from '@/data/items';
import { GET as cron } from '@app/api/cron/send-daily/route';

/**
 * The route's own responsibility is authentication, wiring, and choosing a status
 * code; the sweep itself is covered against a FakeChannel in
 * send-daily-digests.test.ts.
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

  it('is 200 for an idle tick, with nothing attempted', async () => {
    const response = await cron(withSecret(process.env.CRON_SECRET ?? ''));
    expect(response.status).toBe(200);
  });

  it('is 5xx when every attempted send failed', async () => {
    // Vercel's cron monitoring keys off HTTP status, so a systemic outage — a
    // revoked API key, say — must not look like a healthy tick. Partial failure
    // stays 200 by design; total failure is something being broken.
    // The test .env carries a placeholder Resend key, so real delivery fails.
    const user = await makeUser();
    const roadmap = await makeRoadmap(user.id, {
      startDate: '2020-01-01',
      endDate: '2030-01-01',
      sendTimeLocal: '00:01',
    });
    await appendItems(roadmap.id, [
      { title: 'Two Sum', url: 'https://example.com/a', difficulty: 'EASY' },
    ]);

    const response = await cron(withSecret(process.env.CRON_SECRET ?? ''));

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await response.json()).toMatchObject({ sent: 0, failed: 1 });
  });
});
