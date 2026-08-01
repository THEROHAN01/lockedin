import { daysInclusive } from '@/domain/dates';
import type { LocalDate, LocalTime, Roadmap, RoadmapItem } from '@/domain/types';
import { appendItems } from '@/data/items';
import {
  createRoadmap,
  findOwnedRoadmap,
  listRoadmapsByUser,
  updateOwnedRoadmap,
} from '@/data/roadmaps';
import { ValidationError } from '@/errors';
import { csvUploadSource } from '@/sources/csv-source';

/**
 * The Roadmap aggregate: its own CRUD, and populating it with items.
 *
 * Reading and writing progress lives in `progress.ts`, not here.
 *
 * Everything is ownership-scoped: `null` means the roadmap is missing *or*
 * belongs to someone else, and callers answer 404 for both so the API cannot be
 * used to discover which ids exist.
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
