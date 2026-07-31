import { localDateToUtcDate } from '@/domain/dates';
import type { LocalDate, LocalTime, Roadmap, RoadmapStatus } from '@/domain/types';
import { toRoadmap } from './mappers';
import { prisma } from './prisma';

export interface NewRoadmap {
  userId: string;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  sendTimeLocal: LocalTime;
  timezone: string;
}

export interface RoadmapPatch {
  name?: string;
  startDate?: LocalDate;
  endDate?: LocalDate;
  sendTimeLocal?: LocalTime;
  timezone?: string;
  /** COMPLETED is server-derived and must not be set from a request. */
  status?: Extract<RoadmapStatus, 'ACTIVE' | 'ARCHIVED'>;
}

export async function createRoadmap(input: NewRoadmap): Promise<Roadmap> {
  const row = await prisma.roadmap.create({
    data: {
      userId: input.userId,
      name: input.name,
      startDate: localDateToUtcDate(input.startDate),
      endDate: localDateToUtcDate(input.endDate),
      sendTimeLocal: input.sendTimeLocal,
      timezone: input.timezone,
    },
  });
  return toRoadmap(row);
}

/**
 * The ownership-checked read, and the only way a request should reach a roadmap.
 *
 * Returns null both when the roadmap does not exist and when it belongs to
 * someone else — the caller answers 404 for both. Distinguishing them would need
 * a second unfiltered query and would confirm the id exists to a stranger.
 */
export async function findOwnedRoadmap(
  id: string,
  userId: string,
): Promise<Roadmap | null> {
  const row = await prisma.roadmap.findFirst({ where: { id, userId } });
  return row === null ? null : toRoadmap(row);
}

export async function listRoadmapsByUser(userId: string): Promise<Roadmap[]> {
  const rows = await prisma.roadmap.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toRoadmap);
}

/** Returns null if the roadmap is missing or not the caller's. */
export async function updateOwnedRoadmap(
  id: string,
  userId: string,
  patch: RoadmapPatch,
): Promise<Roadmap | null> {
  // updateMany rather than update: Prisma requires a unique `where` for update,
  // which cannot include userId, so the ownership filter would be lost.
  const result = await prisma.roadmap.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.startDate !== undefined && {
        startDate: localDateToUtcDate(patch.startDate),
      }),
      ...(patch.endDate !== undefined && {
        endDate: localDateToUtcDate(patch.endDate),
      }),
      ...(patch.sendTimeLocal !== undefined && {
        sendTimeLocal: patch.sendTimeLocal,
      }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.status !== undefined && { status: patch.status }),
    },
  });

  if (result.count === 0) return null;
  return findOwnedRoadmap(id, userId);
}

/**
 * Everything the cron sweep considers. Spans users deliberately — the sweep is
 * global, and ARCHIVED or COMPLETED roadmaps are excluded here rather than
 * filtered later.
 */
export async function listActiveRoadmaps(): Promise<Roadmap[]> {
  const rows = await prisma.roadmap.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toRoadmap);
}

/**
 * A system-initiated status change, with no ownership check: used when the sweep
 * finds every item done. Requests go through updateOwnedRoadmap instead.
 */
export async function setRoadmapStatus(
  id: string,
  status: RoadmapStatus,
): Promise<void> {
  await prisma.roadmap.update({ where: { id }, data: { status } });
}
