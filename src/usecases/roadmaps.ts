import { daysInclusive, localDateFor } from '@/domain/dates';
import { ValidationError } from '@/domain/errors';
import { computeProgress } from '@/domain/progress';
import type {
  LocalDate,
  LocalTime,
  Progress,
  Roadmap,
  RoadmapItem,
} from '@/domain/types';
import { appendItems, countItems, listItems } from '@/data/items';
import { countCompleted, listCompletedItemIds } from '@/data/progress';
import {
  createRoadmap,
  findOwnedRoadmap,
  listRoadmapsByUser,
  updateOwnedRoadmap,
} from '@/data/roadmaps';
import { csvUploadSource } from '@/sources/csv-source';

/**
 * Orchestration. Everything here is ownership-scoped: `null` means the roadmap
 * is missing *or* belongs to someone else, and callers answer 404 for both so the
 * API cannot be used to discover which ids exist.
 */

export interface NewRoadmapInput {
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  sendTimeLocal: LocalTime;
  timezone: string;
}

export type RoadmapPatchInput = Partial<NewRoadmapInput> & {
  status?: 'ACTIVE' | 'ARCHIVED';
};

export type ItemWithCompletion = RoadmapItem & { completed: boolean };

function assertDateRange(startDate: LocalDate, endDate: LocalDate): void {
  if (daysInclusive(startDate, endDate) < 1) {
    throw new ValidationError([
      { path: 'endDate', message: 'endDate must not precede startDate' },
    ]);
  }
}

export async function createRoadmapForUser(
  userId: string,
  input: NewRoadmapInput,
): Promise<Roadmap> {
  assertDateRange(input.startDate, input.endDate);
  return createRoadmap({ userId, ...input });
}

export async function listRoadmapsFor(userId: string): Promise<Roadmap[]> {
  return listRoadmapsByUser(userId);
}

export async function getRoadmapFor(
  userId: string,
  roadmapId: string,
): Promise<Roadmap | null> {
  return findOwnedRoadmap(roadmapId, userId);
}

/**
 * A patch may move only one end of the range, so the check runs against the
 * merged result rather than the request alone.
 */
export async function updateRoadmapFor(
  userId: string,
  roadmapId: string,
  patch: RoadmapPatchInput,
): Promise<Roadmap | null> {
  const existing = await findOwnedRoadmap(roadmapId, userId);
  if (existing === null) return null;

  assertDateRange(
    patch.startDate ?? existing.startDate,
    patch.endDate ?? existing.endDate,
  );

  return updateOwnedRoadmap(roadmapId, userId, patch);
}

export async function addItemsFromCsv(
  userId: string,
  roadmapId: string,
  csv: string,
): Promise<RoadmapItem[] | null> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return null;

  // Throws ValidationError listing every bad row; nothing is written unless the
  // whole file parses.
  const parsed = await csvUploadSource.read(csv);
  return appendItems(roadmapId, parsed);
}

/**
 * `completed` is derived here rather than stored on the item: completion is an
 * event, and `RoadmapItem` stays a description of the item itself.
 */
export async function listItemsWithCompletionFor(
  userId: string,
  roadmapId: string,
): Promise<ItemWithCompletion[] | null> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return null;

  const [items, completedIds] = await Promise.all([
    listItems(roadmapId),
    listCompletedItemIds(roadmapId),
  ]);
  const done = new Set(completedIds);

  return items.map((item) => ({ ...item, completed: done.has(item.id) }));
}

export async function getProgressFor(
  userId: string,
  roadmapId: string,
): Promise<Progress | null> {
  const roadmap = await findOwnedRoadmap(roadmapId, userId);
  if (roadmap === null) return null;

  const [totalCount, completedCount] = await Promise.all([
    countItems(roadmapId),
    countCompleted(roadmapId),
  ]);

  return computeProgress({
    completedCount,
    totalCount,
    startDate: roadmap.startDate,
    endDate: roadmap.endDate,
    // Reading the clock is this layer's job. The domain receives `today` as a
    // value, which is what keeps it testable without mocking.
    today: localDateFor(new Date(), roadmap.timezone),
  });
}
