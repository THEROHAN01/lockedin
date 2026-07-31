/**
 * Plain types for the pure domain layer.
 *
 * Nothing here is generated from or coupled to the database schema. Repositories
 * in src/data are responsible for mapping Prisma rows into these shapes before
 * anything reaches a domain function — see docs/ARCHITECTURE.md §2. That rule,
 * including type-only imports, is enforced by eslint.config.mjs.
 */

/** A calendar date in the roadmap's own time zone, formatted `YYYY-MM-DD`. */
export type LocalDate = string;

/** A 24-hour wall-clock time, formatted `HH:mm`. */
export type LocalTime = string;

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DIFFICULTIES: readonly Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

/**
 * One thing to work through. Deliberately generic — no LeetCode-specific
 * fields — so a future AI-generated roadmap or a non-LeetCode habit populates
 * the same shape (ROADMAP.md, architectural constraints).
 */
export interface RoadmapItem {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  position: number;
}

/** An item parsed from an upload but not yet persisted, so it has no id. */
export interface ParsedItem {
  title: string;
  url: string;
  difficulty: Difficulty;
}

/** Both halves of "how far along am I": problems and time. */
export interface Progress {
  completedCount: number;
  totalCount: number;
  daysElapsed: number;
  totalDays: number;
}

/**
 * What the daily email says. Declared here rather than beside the channel
 * interface because `buildDigest` produces it, and the domain cannot import
 * from an outer layer to name its own return type.
 */
export interface DigestItem {
  title: string;
  url: string;
  difficulty: Difficulty;
}

export interface DailyDigest {
  roadmapName: string;
  items: DigestItem[];
  progress: Progress;
  quote: string;
}
