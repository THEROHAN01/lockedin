import { describe, expect, it } from 'vitest';
import { prisma } from '../../helpers/db';
import { ITEMS, makeRoadmap, makeUser } from '../../helpers/factories';
import { appendItems } from '@/data/items';
import {
  countCompleted,
  listCompletedItemIds,
  markItemComplete,
} from '@/data/progress';

async function seeded() {
  const user = await makeUser();
  const roadmap = await makeRoadmap(user.id);
  const items = await appendItems(roadmap.id, ITEMS);
  return { user, roadmap, items };
}

describe('markItemComplete', () => {
  it('records an append-only event rather than flipping a flag', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);

    const events = await prisma.progressEvent.findMany({
      where: { roadmapId: roadmap.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      itemId: items[0]!.id,
      type: 'COMPLETED',
    });
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it('is idempotent — marking twice does not double count', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);
    await markItemComplete(roadmap.id, items[0]!.id);

    expect(await countCompleted(roadmap.id)).toBe(1);
  });

  it('does not throw on a repeat, so the API can stay a plain idempotent PUT', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);
    await expect(
      markItemComplete(roadmap.id, items[0]!.id),
    ).resolves.not.toThrow();
  });
});

describe('the unique constraint backing idempotency', () => {
  it('is enforced by the database, not only by application code', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);

    // Two concurrent requests would both pass an application-level check.
    await expect(
      prisma.progressEvent.create({
        data: {
          roadmapId: roadmap.id,
          itemId: items[0]!.id,
          type: 'COMPLETED',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('countCompleted', () => {
  it('counts distinct items', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);
    await markItemComplete(roadmap.id, items[1]!.id);

    expect(await countCompleted(roadmap.id)).toBe(2);
  });

  it('is zero for an untouched roadmap', async () => {
    const { roadmap } = await seeded();
    expect(await countCompleted(roadmap.id)).toBe(0);
  });

  it('does not leak across roadmaps', async () => {
    const first = await seeded();
    const second = await seeded();
    await markItemComplete(first.roadmap.id, first.items[0]!.id);

    expect(await countCompleted(first.roadmap.id)).toBe(1);
    expect(await countCompleted(second.roadmap.id)).toBe(0);
  });
});

describe('listCompletedItemIds', () => {
  it('reports which items are done', async () => {
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[2]!.id);

    expect(await listCompletedItemIds(roadmap.id)).toEqual([items[2]!.id]);
  });
});

describe('history retention', () => {
  it('keeps the timestamp, which is what a future XP or streak layer reads', async () => {
    // The reason completion is an event log rather than a boolean: ROADMAP.md
    // requires progress be computable later without re-deriving history.
    const { roadmap, items } = await seeded();
    await markItemComplete(roadmap.id, items[0]!.id);

    const event = await prisma.progressEvent.findFirst({
      where: { roadmapId: roadmap.id },
    });
    expect(event?.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
