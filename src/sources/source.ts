import type { ParsedItem } from '@/domain/types';

/**
 * How a roadmap's items get populated.
 *
 * `ROADMAP.md` requires that "upload questions" not be wired so tightly into the
 * roadmap model that "AI generates the list instead" needs a schema rewrite. This
 * is that seam: one implementation today, and a future AI source produces the
 * same `ParsedItem[]` with the persistence path unchanged.
 *
 * Async even though CSV parsing is synchronous. An LLM-backed source is
 * inherently async, and declaring this sync because today's only implementation
 * is would mean changing the interface, both implementations, and every call site
 * later. One promise wrapper now avoids that.
 *
 * Failures are reported by throwing `ValidationError`, so per-row problems reach
 * the caller as a list rather than one at a time.
 */
export interface RoadmapSource {
  read(input: string): Promise<ParsedItem[]>;
}
