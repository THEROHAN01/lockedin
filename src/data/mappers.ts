import type { Roadmap as RoadmapRow, RoadmapItem as ItemRow } from '@prisma/client';
import { utcDateToLocalDate } from '@/domain/dates';
import type { Roadmap, RoadmapItem } from '@/domain/types';

/**
 * The boundary between Prisma rows and domain types.
 *
 * This exists so nothing outside src/data ever handles a generated type. The
 * domain must stay ignorant of the schema — including type-only imports, which
 * add no runtime coupling but tie the domain to the database all the same.
 * Enforced by eslint.config.mjs.
 */

export function toRoadmap(row: RoadmapRow): Roadmap {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    startDate: utcDateToLocalDate(row.startDate),
    endDate: utcDateToLocalDate(row.endDate),
    sendTimeLocal: row.sendTimeLocal,
    timezone: row.timezone,
    status: row.status,
  };
}

export function toRoadmapItem(row: ItemRow): RoadmapItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    difficulty: row.difficulty,
    position: row.position,
  };
}
