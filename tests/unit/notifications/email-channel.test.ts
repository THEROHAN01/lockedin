import { describe, expect, it } from 'vitest';
import { createEmailChannel } from '@/notifications/email-channel';
import type { EmailMessage, EmailSender } from '@/notifications/email-channel';
import type { DailyDigest } from '@/domain/types';

const DIGEST: DailyDigest = {
  roadmapName: 'Blind 75',
  items: [
    { title: 'Two Sum', url: 'https://example.com/a', difficulty: 'EASY' },
    { title: 'Add Two', url: 'https://example.com/b', difficulty: 'MEDIUM' },
  ],
  progress: { completedCount: 1, totalCount: 3, daysElapsed: 2, totalDays: 30 },
  quote: 'Show up today.',
};

function recordingSender() {
  const messages: EmailMessage[] = [];
  const sender: EmailSender = {
    send(message) {
      messages.push(message);
      return Promise.resolve();
    },
  };
  return { sender, messages };
}

describe('createEmailChannel', () => {
  it('maps a digest onto one email', async () => {
    // Resend is injected rather than imported, so this exercises the real
    // mapping without stubbing a module or reaching the network.
    const { sender, messages } = recordingSender();
    const channel = createEmailChannel({ sender, from: 'LockedIn <nag@x.com>' });

    await channel.send('user@example.com', DIGEST);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: 'user@example.com',
      from: 'LockedIn <nag@x.com>',
      subject: 'Blind 75 — 2 problems today',
    });
    expect(messages[0]?.html).toContain('Two Sum');
  });

  it('lets a send failure propagate, so the sweep can isolate it', async () => {
    const sender: EmailSender = {
      send() {
        return Promise.reject(new Error('resend is down'));
      },
    };
    const channel = createEmailChannel({ sender, from: 'x@y.com' });

    await expect(channel.send('user@example.com', DIGEST)).rejects.toThrow(
      'resend is down',
    );
  });
});
