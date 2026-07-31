import { prisma } from './db';
import { createRoadmap } from '@/data/roadmaps';
import type { Roadmap } from '@/domain/types';

let sequence = 0;

export async function makeUser(): Promise<{ id: string; email: string }> {
  sequence += 1;
  const email = `user${sequence}@example.com`;
  const user = await prisma.user.create({
    data: { name: `User ${sequence}`, email },
  });
  return { id: user.id, email: user.email };
}

export async function makeRoadmap(
  userId: string,
  overrides: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    sendTimeLocal: string;
    timezone: string;
  }> = {},
): Promise<Roadmap> {
  return createRoadmap({
    userId,
    name: overrides.name ?? 'Blind 75',
    startDate: overrides.startDate ?? '2026-01-01',
    endDate: overrides.endDate ?? '2026-01-30',
    sendTimeLocal: overrides.sendTimeLocal ?? '07:00',
    timezone: overrides.timezone ?? 'Asia/Kolkata',
  });
}

export const ITEMS = [
  { title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum', difficulty: 'EASY' },
  { title: 'Add Two Numbers', url: 'https://leetcode.com/problems/add', difficulty: 'MEDIUM' },
  { title: 'Median of Arrays', url: 'https://leetcode.com/problems/median', difficulty: 'HARD' },
] as const;
