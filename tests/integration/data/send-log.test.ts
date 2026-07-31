import { describe, expect, it } from 'vitest';
import { prisma } from '../../helpers/db';
import { makeRoadmap, makeUser } from '../../helpers/factories';
import { findSentKeys, recordSend, sentKey } from '@/data/send-log';

async function roadmap() {
  const user = await makeUser();
  return makeRoadmap(user.id);
}

describe('recordSend', () => {
  it('accepts the first send of a local day', async () => {
    const r = await roadmap();
    expect(await recordSend(r.id, '2026-01-06', 2)).toBe(true);
  });

  it('refuses a second send on the same local day, without throwing', async () => {
    // This is the guard against mailing a user 96 times a day. The caller needs
    // a boolean, not an exception, because losing the race is normal.
    const r = await roadmap();
    expect(await recordSend(r.id, '2026-01-06', 2)).toBe(true);
    expect(await recordSend(r.id, '2026-01-06', 2)).toBe(false);
  });

  it('accepts the next local day', async () => {
    const r = await roadmap();
    await recordSend(r.id, '2026-01-06', 2);
    expect(await recordSend(r.id, '2026-01-07', 1)).toBe(true);
  });

  it('stores the local date as given, with no timezone drift', async () => {
    // The roadmap is Asia/Kolkata. If this column round-tripped through a
    // local-time conversion, the date would shift and "once a day" would break.
    const r = await roadmap();
    await recordSend(r.id, '2026-01-06', 3);

    const row = await prisma.sendLog.findFirst({ where: { roadmapId: r.id } });
    expect(row?.localDate.toISOString().slice(0, 10)).toBe('2026-01-06');
  });

  it('records what the pacing engine decided, which is stored nowhere else', async () => {
    const r = await roadmap();
    await recordSend(r.id, '2026-01-06', 4);

    const row = await prisma.sendLog.findFirst({ where: { roadmapId: r.id } });
    expect(row?.itemCount).toBe(4);
  });

  it('is scoped per roadmap', async () => {
    const a = await roadmap();
    const b = await roadmap();
    expect(await recordSend(a.id, '2026-01-06', 1)).toBe(true);
    expect(await recordSend(b.id, '2026-01-06', 1)).toBe(true);
  });
});

describe('the unique constraint backing idempotency', () => {
  it('is enforced by the database, not only by application code', async () => {
    const r = await roadmap();
    await recordSend(r.id, '2026-01-06', 1);

    await expect(
      prisma.sendLog.create({
        data: {
          roadmapId: r.id,
          localDate: new Date('2026-01-06T00:00:00Z'),
          itemCount: 1,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('findSentKeys', () => {
  it('answers for many roadmaps in one query rather than one each', async () => {
    // Due-ness stays true for the rest of the local day, so this lookup runs
    // against every due roadmap on all 96 ticks. Per-roadmap point queries here
    // are the first thing that breaks under load.
    const a = await roadmap();
    const b = await roadmap();
    const c = await roadmap();
    await recordSend(a.id, '2026-01-06', 1);
    await recordSend(c.id, '2026-01-06', 1);

    const sent = await findSentKeys([a.id, b.id, c.id], ['2026-01-06']);

    expect(sent.has(sentKey(a.id, '2026-01-06'))).toBe(true);
    expect(sent.has(sentKey(b.id, '2026-01-06'))).toBe(false);
    expect(sent.has(sentKey(c.id, '2026-01-06'))).toBe(true);
  });

  it('distinguishes dates, so two zones on different local days do not collide', async () => {
    const r = await roadmap();
    await recordSend(r.id, '2026-01-06', 1);

    const sent = await findSentKeys([r.id], ['2026-01-06', '2026-01-07']);
    expect(sent.has(sentKey(r.id, '2026-01-06'))).toBe(true);
    expect(sent.has(sentKey(r.id, '2026-01-07'))).toBe(false);
  });

  it('returns an empty set for empty input without hitting the database', async () => {
    expect(await findSentKeys([], [])).toEqual(new Set());
    expect(await findSentKeys(['x'], [])).toEqual(new Set());
  });
});
