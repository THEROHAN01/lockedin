import { describe, expect, it } from 'vitest';
import { FakeChannel } from '@/notifications/fake-channel';
import type { DailyDigest } from '@/domain/types';

const DIGEST: DailyDigest = {
  roadmapName: 'Blind 75',
  items: [
    { title: 'Two Sum', url: 'https://example.com/a', difficulty: 'EASY' },
  ],
  progress: {
    completedCount: 1,
    totalCount: 3,
    daysElapsed: 2,
    totalDays: 30,
  },
  quote: 'Show up today.',
};

describe('FakeChannel', () => {
  it('records what would have been sent', async () => {
    const channel = new FakeChannel();
    await channel.send('a@example.com', DIGEST);

    expect(channel.sent).toEqual([{ to: 'a@example.com', digest: DIGEST }]);
  });

  it('records in order', async () => {
    const channel = new FakeChannel();
    await channel.send('a@example.com', DIGEST);
    await channel.send('b@example.com', DIGEST);

    expect(channel.sent.map((s) => s.to)).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('can be told to fail for one recipient', async () => {
    // NotificationChannel.send returns a promise that can reject, and the cron
    // sweep must survive one roadmap failing. Without this the fake could only
    // model the happy path and a second ad-hoc double would get invented.
    const channel = new FakeChannel({ failFor: ['broken@example.com'] });

    await expect(channel.send('broken@example.com', DIGEST)).rejects.toThrow();
    await expect(channel.send('fine@example.com', DIGEST)).resolves.toBeUndefined();
  });

  it('does not record a send that failed', async () => {
    const channel = new FakeChannel({ failFor: ['broken@example.com'] });
    await channel.send('broken@example.com', DIGEST).catch(() => undefined);

    expect(channel.sent).toEqual([]);
    expect(channel.failed).toEqual(['broken@example.com']);
  });
});
