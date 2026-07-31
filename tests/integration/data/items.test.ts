import { describe, expect, it } from 'vitest';
import { prisma } from '../../helpers/db';
import { ITEMS, makeRoadmap, makeUser } from '../../helpers/factories';
import {
  appendItems,
  countItems,
  listItems,
  listOutstandingItems,
} from '@/data/items';
import { markItemComplete } from '@/data/progress';

async function roadmapWithItems() {
  const user = await makeUser();
  const roadmap = await makeRoadmap(user.id);
  const items = await appendItems(roadmap.id, ITEMS);
  return { user, roadmap, items };
}

describe('appendItems', () => {
  it('numbers positions from zero, in the order given', async () => {
    const { items } = await roadmapWithItems();
    expect(items.map((i) => [i.position, i.title])).toEqual([
      [0, 'Two Sum'],
      [1, 'Add Two Numbers'],
      [2, 'Median of Arrays'],
    ]);
  });

  it('continues numbering when more are appended later', async () => {
    const { roadmap } = await roadmapWithItems();
    const more = await appendItems(roadmap.id, [
      { title: 'Later', url: 'https://example.com/later', difficulty: 'EASY' },
    ]);
    expect(more[0]?.position).toBe(3);
  });

  it('returns domain items, without leaking database columns', async () => {
    const { items } = await roadmapWithItems();
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      'difficulty',
      'id',
      'position',
      'title',
      'url',
    ]);
  });

  it('accepts an empty list without writing anything', async () => {
    const user = await makeUser();
    const roadmap = await makeRoadmap(user.id);
    expect(await appendItems(roadmap.id, [])).toEqual([]);
    expect(await countItems(roadmap.id)).toBe(0);
  });
});

describe('listItems', () => {
  it('orders by position', async () => {
    const { roadmap } = await roadmapWithItems();
    const listed = await listItems(roadmap.id);
    expect(listed.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('is scoped to one roadmap', async () => {
    const { roadmap } = await roadmapWithItems();
    const other = await makeRoadmap((await makeUser()).id);
    await appendItems(other.id, [ITEMS[0]]);

    expect(await listItems(roadmap.id)).toHaveLength(3);
    expect(await listItems(other.id)).toHaveLength(1);
  });
});

describe('listOutstandingItems', () => {
  it('is everything at first', async () => {
    const { roadmap } = await roadmapWithItems();
    expect(await listOutstandingItems(roadmap.id)).toHaveLength(3);
  });

  it('excludes completed items and keeps position order', async () => {
    const { roadmap, items } = await roadmapWithItems();
    await markItemComplete(roadmap.id, items[0]!.id);

    const outstanding = await listOutstandingItems(roadmap.id);
    expect(outstanding.map((i) => i.title)).toEqual([
      'Add Two Numbers',
      'Median of Arrays',
    ]);
  });

  it('is empty once every item is done', async () => {
    const { roadmap, items } = await roadmapWithItems();
    for (const item of items) {
      await markItemComplete(roadmap.id, item.id);
    }
    expect(await listOutstandingItems(roadmap.id)).toEqual([]);
  });
});

describe('cascade', () => {
  it('deletes items with their roadmap', async () => {
    const { roadmap } = await roadmapWithItems();
    await prisma.roadmap.delete({ where: { id: roadmap.id } });
    expect(await countItems(roadmap.id)).toBe(0);
  });
});
