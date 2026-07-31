import { describe, expect, it } from 'vitest';
import { prisma } from '../../helpers/db';
import { makeRoadmap, makeUser } from '../../helpers/factories';
import { appendItems } from '@/data/items';
import { markItemComplete } from '@/data/progress';
import { setRoadmapStatus } from '@/data/roadmaps';
import { FakeChannel } from '@/notifications/fake-channel';
import { sendDailyDigests } from '@/usecases/send-daily-digests';
import type { Difficulty, ParsedItem } from '@/domain/types';

/**
 * The sweep, against real Postgres with a fake channel. `now` is always passed
 * in, so every case below is deterministic — no clock mocking anywhere.
 *
 * Reference instant: 2026-01-06T02:00:00Z.
 *   Asia/Kolkata (+05:30) -> 07:30 on 2026-01-06
 *   America/New_York (-05:00) -> 21:00 on 2026-01-05
 */
const AT_0730_IST = new Date('2026-01-06T02:00:00Z');
const AT_0630_IST = new Date('2026-01-06T01:00:00Z');

function items(count: number): ParsedItem[] {
  const cycle: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
  return Array.from({ length: count }, (_, i) => ({
    title: `Problem ${i + 1}`,
    url: `https://leetcode.com/problems/p${i + 1}`,
    difficulty: cycle[i % 3] ?? 'EASY',
  }));
}

async function seed(
  options: {
    itemCount?: number;
    startDate?: string;
    endDate?: string;
    sendTimeLocal?: string;
    timezone?: string;
  } = {},
) {
  const user = await makeUser();
  const roadmap = await makeRoadmap(user.id, {
    startDate: options.startDate ?? '2026-01-01',
    endDate: options.endDate ?? '2026-01-30',
    sendTimeLocal: options.sendTimeLocal ?? '07:00',
    timezone: options.timezone ?? 'Asia/Kolkata',
  });
  const created = await appendItems(roadmap.id, items(options.itemCount ?? 30));
  return { user, roadmap, items: created };
}

describe('due-ness', () => {
  it('sends once when the local clock has reached the send time', async () => {
    const { user } = await seed();
    const channel = new FakeChannel();

    const result = await sendDailyDigests(AT_0730_IST, channel);

    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]?.to).toBe(user.email);
  });

  it('sends nothing before the send time', async () => {
    await seed();
    const channel = new FakeChannel();

    const result = await sendDailyDigests(AT_0630_IST, channel);

    expect(result.sent).toBe(0);
    expect(channel.sent).toEqual([]);
  });

  it('still sends late in the local day, so a missed run self-heals', async () => {
    await seed();
    const channel = new FakeChannel();

    // 18:00 UTC is 23:30 IST — hours past the send time, same local day.
    await sendDailyDigests(new Date('2026-01-06T18:00:00Z'), channel);
    expect(channel.sent).toHaveLength(1);
  });

  it('sends nothing before the roadmap starts', async () => {
    await seed({ startDate: '2026-02-01', endDate: '2026-03-01' });
    const channel = new FakeChannel();

    expect((await sendDailyDigests(AT_0730_IST, channel)).sent).toBe(0);
  });

  it('skips ARCHIVED roadmaps', async () => {
    const { roadmap } = await seed();
    await setRoadmapStatus(roadmap.id, 'ARCHIVED');
    const channel = new FakeChannel();

    expect((await sendDailyDigests(AT_0730_IST, channel)).sent).toBe(0);
  });

  it('skips COMPLETED roadmaps', async () => {
    const { roadmap } = await seed();
    await setRoadmapStatus(roadmap.id, 'COMPLETED');
    const channel = new FakeChannel();

    expect((await sendDailyDigests(AT_0730_IST, channel)).sent).toBe(0);
  });
});

describe('idempotency', () => {
  it('sends exactly once across two sweeps in the same local day', async () => {
    // The cron polls every 15 minutes and due-ness stays true for the rest of the
    // local day. Without the send log this user would be mailed 96 times.
    await seed();
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);
    await sendDailyDigests(new Date('2026-01-06T03:00:00Z'), channel);
    await sendDailyDigests(new Date('2026-01-06T12:00:00Z'), channel);

    expect(channel.sent).toHaveLength(1);
  });

  it('sends again the next local day', async () => {
    await seed();
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);
    await sendDailyDigests(new Date('2026-01-07T02:00:00Z'), channel);

    expect(channel.sent).toHaveLength(2);
  });

  it('records what the pacing engine decided', async () => {
    // Jan 6 with 30 outstanding and 25 days left: ceil(30 / 25) = 2. This column
    // is the only place that number survives — the quota is never persisted.
    await seed({ itemCount: 30 });
    await sendDailyDigests(AT_0730_IST, new FakeChannel());

    const log = await prisma.sendLog.findFirst();
    expect(log?.itemCount).toBe(2);
    expect(log?.localDate.toISOString().slice(0, 10)).toBe('2026-01-06');
  });
});

describe('the pacing rule, end to end', () => {
  it('sends one problem when on schedule', async () => {
    // 30 items over 30 days, on day one: ceil(30 / 30) = 1.
    await seed({ itemCount: 30 });
    const channel = new FakeChannel();

    await sendDailyDigests(new Date('2026-01-01T02:00:00Z'), channel);

    expect(channel.sent[0]?.digest.items).toHaveLength(1);
    expect(channel.sent[0]?.digest.items[0]?.title).toBe('Problem 1');
  });

  it('sends two after ignoring four days', async () => {
    // 30 items, Jan 1 -> Jan 30, nothing solved, today is Jan 6:
    // ceil(30 / 25 days left) = 2.
    await seed({ itemCount: 30 });
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);

    expect(channel.sent[0]?.digest.items.map((i) => i.title)).toEqual([
      'Problem 1',
      'Problem 2',
    ]);
  });

  it('caps at five past the end date, and keeps nagging', async () => {
    await seed({ itemCount: 20, startDate: '2025-12-01', endDate: '2025-12-31' });
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);

    expect(channel.sent[0]?.digest.items).toHaveLength(5);
  });

  it('skips items already solved', async () => {
    const { roadmap, items: created } = await seed({ itemCount: 30 });
    await markItemComplete(roadmap.id, created[0]!.id);
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);

    expect(channel.sent[0]?.digest.items[0]?.title).toBe('Problem 2');
  });

  it('carries progress and a quote', async () => {
    const { roadmap, items: created } = await seed({ itemCount: 30 });
    await markItemComplete(roadmap.id, created[0]!.id);
    const channel = new FakeChannel();

    await sendDailyDigests(AT_0730_IST, channel);

    const digest = channel.sent[0]?.digest;
    expect(digest?.roadmapName).toBe('Blind 75');
    expect(digest?.progress).toMatchObject({
      completedCount: 1,
      totalCount: 30,
      daysElapsed: 6,
      totalDays: 30,
    });
    expect(digest?.quote).toBeTruthy();
  });
});

describe('finishing', () => {
  it('marks the roadmap COMPLETED and sends nothing when every item is done', async () => {
    const { roadmap, items: created } = await seed({ itemCount: 3 });
    for (const item of created) {
      await markItemComplete(roadmap.id, item.id);
    }
    const channel = new FakeChannel();

    const result = await sendDailyDigests(AT_0730_IST, channel);

    expect(channel.sent).toEqual([]);
    expect(result.sent).toBe(0);

    const after = await prisma.roadmap.findUnique({ where: { id: roadmap.id } });
    expect(after?.status).toBe('COMPLETED');
  });

  it('sends nothing for a roadmap with no items yet', async () => {
    await seed({ itemCount: 0 });
    const channel = new FakeChannel();
    expect((await sendDailyDigests(AT_0730_IST, channel)).sent).toBe(0);
  });
});

describe('timezones', () => {
  it('fires two roadmaps in different zones at different UTC instants', async () => {
    const kolkata = await makeUser();
    const newYork = await makeUser();
    const kolkataRoadmap = await makeRoadmap(kolkata.id, {
      timezone: 'Asia/Kolkata',
      sendTimeLocal: '07:00',
    });
    const newYorkRoadmap = await makeRoadmap(newYork.id, {
      timezone: 'America/New_York',
      sendTimeLocal: '07:00',
    });
    await appendItems(kolkataRoadmap.id, items(5));
    await appendItems(newYorkRoadmap.id, items(5));

    // 02:00 UTC: 07:30 in Kolkata (due), 21:00 the previous day in New York
    // (also past 07:00 on its own local day, so also due) — use an instant where
    // only one has reached its send time: 2026-01-06T01:00Z is 06:30 IST (not
    // due) and 20:00 on Jan 5 in New York (due).
    const channel = new FakeChannel();
    await sendDailyDigests(new Date('2026-01-06T01:00:00Z'), channel);

    expect(channel.sent.map((s) => s.to)).toEqual([newYork.email]);
  });

  it('treats the local date as the roadmap’s own, not UTC', async () => {
    const user = await makeUser();
    const roadmap = await makeRoadmap(user.id, {
      timezone: 'America/New_York',
      sendTimeLocal: '07:00',
    });
    await appendItems(roadmap.id, items(5));

    await sendDailyDigests(new Date('2026-01-06T01:00:00Z'), new FakeChannel());

    const log = await prisma.sendLog.findFirst({ where: { roadmapId: roadmap.id } });
    // 20:00 on Jan 5 locally, even though it is Jan 6 in UTC.
    expect(log?.localDate.toISOString().slice(0, 10)).toBe('2026-01-05');
  });
});

describe('failure isolation', () => {
  it('one roadmap failing does not stop the others', async () => {
    const broken = await seed({ itemCount: 5 });
    const fine = await seed({ itemCount: 5 });
    const channel = new FakeChannel({ failFor: [broken.user.email] });

    const result = await sendDailyDigests(AT_0730_IST, channel);

    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(channel.sent.map((s) => s.to)).toEqual([fine.user.email]);
  });

  it('leaves no claim behind for a failed send, so the next sweep retries', async () => {
    // The claim is written before the send so concurrent invocations cannot both
    // deliver. If the send then fails, the claim must be released or the user
    // silently loses that whole day.
    const { user, roadmap } = await seed({ itemCount: 5 });

    await sendDailyDigests(AT_0730_IST, new FakeChannel({ failFor: [user.email] }));
    expect(await prisma.sendLog.count({ where: { roadmapId: roadmap.id } })).toBe(0);

    const retry = new FakeChannel();
    await sendDailyDigests(new Date('2026-01-06T03:00:00Z'), retry);
    expect(retry.sent).toHaveLength(1);
  });
});

describe('sweep accounting', () => {
  it('reports nothing to do when no roadmaps exist', async () => {
    expect(await sendDailyDigests(AT_0730_IST, new FakeChannel())).toMatchObject({
      sent: 0,
      failed: 0,
    });
  });

  it('counts roadmaps it deliberately passed over', async () => {
    await seed({ itemCount: 5 });
    await seed({ itemCount: 5, startDate: '2026-06-01', endDate: '2026-07-01' });

    const result = await sendDailyDigests(AT_0730_IST, new FakeChannel());
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
