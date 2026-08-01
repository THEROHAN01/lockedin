/**
 * "These inputs are invalid, and here is why for each one."
 *
 * Lives at the src root rather than inside `src/domain/`. It is genuinely shared
 * — a CSV source, a use case and a request validator all produce this same
 * answer, and none of them depends on the others — but it is not part of the
 * pacing engine, and nothing inside `src/domain/` consumes it. Keeping it out
 * means `src/domain/` stays exactly what ARCHITECTURE.md says it is, with no
 * exception for a reader to carve out.
 */

export interface ValidationDetail {
  /**
   * A field name (`endDate`), a dotted JSON path, or `row.N` for a line of an
   * upload. That range is why this is not an HTTP concern.
   */
  path: string;
  message: string;
}

export class ValidationError extends Error {
  readonly details: readonly ValidationDetail[];

  constructor(details: readonly ValidationDetail[]) {
    super(`${details.length} validation problem(s)`);
    this.name = 'ValidationError';
    this.details = details;
  }
}
