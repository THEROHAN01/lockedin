import { describe, expect, it } from 'vitest';
import { signUpAndSession, type TestSession } from '../../helpers/auth';
import { type ErrorBody, jsonOf, params, request } from '../../helpers/api';
import { POST as createRoadmap } from '@app/api/roadmaps/route';
import {
  GET as listItems,
  POST as uploadItems,
} from '@app/api/roadmaps/[id]/items/route';
import { PUT as markComplete } from '@app/api/roadmaps/[id]/items/[itemId]/completion/route';
import { GET as getProgress } from '@app/api/roadmaps/[id]/progress/route';
import { GET as getRoadmap } from '@app/api/roadmaps/[id]/route';
import type { Progress, Roadmap, RoadmapItem } from '@/domain/types';

type ItemWithCompletion = RoadmapItem & { completed: boolean };

const CSV = [
  'Two Sum,https://leetcode.com/problems/two-sum,EASY',
  'Add Two Numbers,https://leetcode.com/problems/add,MEDIUM',
  'Median of Arrays,https://leetcode.com/problems/median,HARD',
].join('\n');

async function roadmapFor(session: TestSession): Promise<Roadmap> {
  const response = await createRoadmap(
    request('POST', {
      session,
      body: {
        name: 'Blind 75',
        startDate: '2026-01-01',
        endDate: '2026-01-30',
        sendTimeLocal: '07:00',
        timezone: 'Asia/Kolkata',
      },
    }),
  );
  return jsonOf<Roadmap>(response);
}

async function seeded() {
  const session = await signUpAndSession();
  const roadmap = await roadmapFor(session);
  const response = await uploadItems(
    request('POST', { session, body: { csv: CSV } }),
    params({ id: roadmap.id }),
  );
  const items = await jsonOf<RoadmapItem[]>(response);
  return { session, roadmap, items };
}

describe('POST /api/roadmaps/:id/items', () => {
  it('creates the items and returns 201 with them in full', async () => {
    const { items } = await seeded();
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum',
      difficulty: 'EASY',
      position: 0,
    });
  });

  it('rejects the whole upload if any row is bad, listing every bad row', async () => {
    const session = await signUpAndSession();
    const roadmap = await roadmapFor(session);

    const response = await uploadItems(
      request('POST', {
        session,
        body: {
          csv: [
            'Good,https://example.com/a,EASY',
            'Bad difficulty,https://example.com/b,TRIVIAL',
            'Also good,https://example.com/c,HARD',
            'No url,,MEDIUM',
          ].join('\n'),
        },
      }),
      params({ id: roadmap.id }),
    );

    expect(response.status).toBe(422);
    const body = await jsonOf<ErrorBody>(response);
    expect(body.error.details?.map((d) => d.path)).toEqual(['row.2', 'row.4']);

    // Nothing partially imported.
    const after = await listItems(request('GET', { session }), params({ id: roadmap.id }));
    expect(await jsonOf<ItemWithCompletion[]>(after)).toHaveLength(0);
  });

  it('is 404 for someone else’s roadmap', async () => {
    const owner = await signUpAndSession();
    const stranger = await signUpAndSession();
    const roadmap = await roadmapFor(owner);

    const response = await uploadItems(
      request('POST', { session: stranger, body: { csv: CSV } }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(404);
  });

  it('is 401 without a session', async () => {
    const response = await uploadItems(
      request('POST', { body: { csv: CSV } }),
      params({ id: 'whatever' }),
    );
    expect(response.status).toBe(401);
  });
});

describe('GET /api/roadmaps/:id/items', () => {
  it('carries per-item completion, which the detail screen needs on every load', async () => {
    const { session, roadmap, items } = await seeded();

    await markComplete(
      request('PUT', { session }),
      params({ id: roadmap.id, itemId: items[1]!.id }),
    );

    const response = await listItems(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(200);

    const listed = await jsonOf<ItemWithCompletion[]>(response);
    expect(listed.map((i) => [i.position, i.completed])).toEqual([
      [0, false],
      [1, true],
      [2, false],
    ]);
  });

  it('is 404 for someone else’s roadmap', async () => {
    const { roadmap } = await seeded();
    const stranger = await signUpAndSession();
    const response = await listItems(
      request('GET', { session: stranger }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/roadmaps/:id/items/:itemId/completion', () => {
  it('is 204 on the first mark', async () => {
    const { session, roadmap, items } = await seeded();
    const response = await markComplete(
      request('PUT', { session }),
      params({ id: roadmap.id, itemId: items[0]!.id }),
    );
    expect(response.status).toBe(204);
  });

  it('is 204 again on a repeat, being idempotent by definition of PUT', async () => {
    const { session, roadmap, items } = await seeded();
    const target = params({ id: roadmap.id, itemId: items[0]!.id });

    expect((await markComplete(request('PUT', { session }), target)).status).toBe(204);
    expect(
      (
        await markComplete(
          request('PUT', { session }),
          params({ id: roadmap.id, itemId: items[0]!.id }),
        )
      ).status,
    ).toBe(204);

    const progress = await getProgress(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect((await jsonOf<Progress>(progress)).completedCount).toBe(1);
  });

  it('flips the roadmap to COMPLETED once the last item is done', async () => {
    const { session, roadmap, items } = await seeded();
    for (const item of items) {
      await markComplete(
        request('PUT', { session }),
        params({ id: roadmap.id, itemId: item.id }),
      );
    }

    const response = await getRoadmap(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect((await jsonOf<Roadmap>(response)).status).toBe('COMPLETED');
  });

  it('is 404 for an item belonging to a different roadmap', async () => {
    // Roadmap-level ownership is not enough: without an item-level check this is
    // an IDOR, and it corrupts the other roadmap's completed count.
    const mine = await seeded();
    const theirs = await seeded();

    const response = await markComplete(
      request('PUT', { session: mine.session }),
      params({ id: mine.roadmap.id, itemId: theirs.items[0]!.id }),
    );
    expect(response.status).toBe(404);

    const progress = await getProgress(
      request('GET', { session: theirs.session }),
      params({ id: theirs.roadmap.id }),
    );
    expect((await jsonOf<Progress>(progress)).completedCount).toBe(0);
  });

  it('is 404 for someone else’s roadmap', async () => {
    const { roadmap, items } = await seeded();
    const stranger = await signUpAndSession();
    const response = await markComplete(
      request('PUT', { session: stranger }),
      params({ id: roadmap.id, itemId: items[0]!.id }),
    );
    expect(response.status).toBe(404);
  });

  it('is 401 without a session', async () => {
    const response = await markComplete(
      request('PUT'),
      params({ id: 'a', itemId: 'b' }),
    );
    expect(response.status).toBe(401);
  });
});

describe('GET /api/roadmaps/:id/progress', () => {
  it('reports both halves: problems solved and days elapsed', async () => {
    const { session, roadmap, items } = await seeded();
    await markComplete(
      request('PUT', { session }),
      params({ id: roadmap.id, itemId: items[0]!.id }),
    );

    const response = await getProgress(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(200);

    const progress = await jsonOf<Progress>(response);
    expect(progress).toMatchObject({
      completedCount: 1,
      totalCount: 3,
      totalDays: 30,
    });
    expect(progress.daysElapsed).toBeGreaterThanOrEqual(0);
  });

  it('does not divide by zero on a roadmap with no items', async () => {
    const session = await signUpAndSession();
    const roadmap = await roadmapFor(session);

    const response = await getProgress(
      request('GET', { session }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(200);
    expect(await jsonOf<Progress>(response)).toMatchObject({
      completedCount: 0,
      totalCount: 0,
      totalDays: 30,
    });
  });

  it('is 404 for someone else’s roadmap', async () => {
    const { roadmap } = await seeded();
    const stranger = await signUpAndSession();
    const response = await getProgress(
      request('GET', { session: stranger }),
      params({ id: roadmap.id }),
    );
    expect(response.status).toBe(404);
  });
});
