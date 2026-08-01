import { describe, expect, it } from 'vitest';
import { signUpAndSession } from '../../helpers/auth';
import { type ErrorBody, jsonOf, params, request } from '../../helpers/api';
import { GET as listRoadmaps, POST as createRoadmap } from '@app/api/roadmaps/route';
import {
  GET as getRoadmap,
  PATCH as patchRoadmap,
} from '@app/api/roadmaps/[id]/route';
import type { Roadmap } from '@/domain/types';

const VALID = {
  name: 'Blind 75',
  startDate: '2026-01-01',
  endDate: '2026-01-30',
  sendTimeLocal: '07:00',
  timezone: 'Asia/Kolkata',
};

async function created(session: Awaited<ReturnType<typeof signUpAndSession>>) {
  const response = await createRoadmap(request('POST', { body: VALID, session }));
  return jsonOf<Roadmap>(response);
}

describe('POST /api/roadmaps', () => {
  it('creates and returns 201 with the roadmap', async () => {
    const session = await signUpAndSession();
    const response = await createRoadmap(request('POST', { body: VALID, session }));

    expect(response.status).toBe(201);
    expect(await jsonOf<Roadmap>(response)).toMatchObject({
      ...VALID,
      userId: session.userId,
      status: 'ACTIVE',
    });
  });

  it('is 401 without a session', async () => {
    const response = await createRoadmap(request('POST', { body: VALID }));
    expect(response.status).toBe(401);
    expect((await jsonOf<ErrorBody>(response)).error.code).toBe('UNAUTHENTICATED');
  });

  it('is 400 for a body that is not JSON', async () => {
    const session = await signUpAndSession();
    const response = await createRoadmap(request('POST', { body: '{oops', session }));
    expect(response.status).toBe(400);
    expect((await jsonOf<ErrorBody>(response)).error.code).toBe('MALFORMED_JSON');
  });

  it('is 422 when the end date precedes the start date', async () => {
    const session = await signUpAndSession();
    const response = await createRoadmap(
      request('POST', {
        body: { ...VALID, startDate: '2026-01-30', endDate: '2026-01-01' },
        session,
      }),
    );

    expect(response.status).toBe(422);
    const body = await jsonOf<ErrorBody>(response);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details?.some((d) => d.path === 'endDate')).toBe(true);
  });

  it('is 422 for a send time that is not HH:mm', async () => {
    const session = await signUpAndSession();
    const response = await createRoadmap(
      request('POST', { body: { ...VALID, sendTimeLocal: '7am' }, session }),
    );
    expect(response.status).toBe(422);
  });

  it('is 422 for an unknown IANA time zone', async () => {
    // A send time is meaningless without a real zone, and an unknown one would
    // throw deep inside the cron sweep instead of at the boundary.
    const session = await signUpAndSession();
    const response = await createRoadmap(
      request('POST', { body: { ...VALID, timezone: 'Mars/Olympus_Mons' }, session }),
    );
    expect(response.status).toBe(422);
    const body = await jsonOf<ErrorBody>(response);
    expect(body.error.details?.some((d) => d.path === 'timezone')).toBe(true);
  });

  it('reports every invalid field at once, not just the first', async () => {
    const session = await signUpAndSession();
    const response = await createRoadmap(
      request('POST', {
        body: { ...VALID, name: '', sendTimeLocal: '99:99', timezone: 'nope' },
        session,
      }),
    );
    const body = await jsonOf<ErrorBody>(response);
    expect(body.error.details?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/roadmaps', () => {
  it('returns only the caller’s roadmaps', async () => {
    const mine = await signUpAndSession();
    const theirs = await signUpAndSession();
    await created(mine);
    await created(theirs);

    const response = await listRoadmaps(request('GET', { session: mine }));
    expect(response.status).toBe(200);
    const list = await jsonOf<Roadmap[]>(response);
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe(mine.userId);
  });

  it('is 401 without a session', async () => {
    expect((await listRoadmaps(request('GET'))).status).toBe(401);
  });
});

describe('GET /api/roadmaps/:id', () => {
  it('returns the roadmap to its owner', async () => {
    const session = await signUpAndSession();
    const roadmap = await created(session);

    const response = await getRoadmap(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(200);
    expect((await jsonOf<Roadmap>(response)).id).toBe(roadmap.id);
  });

  it('is 404 — not 403 — for someone else’s roadmap', async () => {
    // A 403 would confirm the id exists, turning the API into an id oracle.
    const owner = await signUpAndSession();
    const stranger = await signUpAndSession();
    const roadmap = await created(owner);

    const response = await getRoadmap(
      request('GET', { session: stranger }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(404);
    expect((await jsonOf<ErrorBody>(response)).error.code).toBe('NOT_FOUND');
  });

  it('is 404 for an id that does not exist', async () => {
    const session = await signUpAndSession();
    const response = await getRoadmap(
      request('GET', { session }),
      params({ id: 'nope' }),
    );
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/roadmaps/:id', () => {
  it('changes dates after creation', async () => {
    // The point of recomputing the quota at send time: dates stay editable.
    const session = await signUpAndSession();
    const roadmap = await created(session);

    const response = await patchRoadmap(
      request('PATCH', { body: { endDate: '2026-03-15' }, session }),
      params({ id: roadmap.id }),
    );

    expect(response.status).toBe(200);
    expect(await jsonOf<Roadmap>(response)).toMatchObject({
      endDate: '2026-03-15',
      startDate: '2026-01-01',
    });
  });

  it('archives and unarchives through status, with no bespoke endpoint', async () => {
    const session = await signUpAndSession();
    const roadmap = await created(session);

    const archived = await patchRoadmap(
      request('PATCH', { body: { status: 'ARCHIVED' }, session }),
      params({ id: roadmap.id }),
    );
    expect((await jsonOf<Roadmap>(archived)).status).toBe('ARCHIVED');

    const revived = await patchRoadmap(
      request('PATCH', { body: { status: 'ACTIVE' }, session }),
      params({ id: roadmap.id }),
    );
    expect((await jsonOf<Roadmap>(revived)).status).toBe('ACTIVE');
  });

  it('refuses COMPLETED from a request body', async () => {
    // COMPLETED is server-derived. The TypeScript type that excludes it is no
    // defence against untrusted JSON, so this must be a runtime check.
    const session = await signUpAndSession();
    const roadmap = await created(session);

    const response = await patchRoadmap(
      request('PATCH', { body: { status: 'COMPLETED' }, session }),
      params({ id: roadmap.id }),
    );

    expect(response.status).toBe(422);
    const after = await getRoadmap(request('GET', { session }), params({ id: roadmap.id }));
    expect((await jsonOf<Roadmap>(after)).status).toBe('ACTIVE');
  });

  it('rejects an unknown status value', async () => {
    const session = await signUpAndSession();
    const roadmap = await created(session);
    const response = await patchRoadmap(
      request('PATCH', { body: { status: 'BANANA' }, session }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(422);
  });

  it('is 404 for someone else’s roadmap, and leaves it untouched', async () => {
    const owner = await signUpAndSession();
    const stranger = await signUpAndSession();
    const roadmap = await created(owner);

    const response = await patchRoadmap(
      request('PATCH', { body: { name: 'Hijacked' }, session: stranger }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(404);

    const after = await getRoadmap(
      request('GET', { session: owner }),
      params({ id: roadmap.id }),
    );
    expect((await jsonOf<Roadmap>(after)).name).toBe('Blind 75');
  });

  it('is 401 without a session', async () => {
    const response = await patchRoadmap(
      request('PATCH', { body: { name: 'x' } }),
      params({ id: 'whatever' }),
    );
    expect(response.status).toBe(401);
  });
});
