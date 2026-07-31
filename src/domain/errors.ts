/**
 * "These inputs are invalid, and here is why for each one."
 *
 * Declared in the domain because it is neither an HTTP nor a persistence
 * concern: a CSV source, a use case, and a request validator all produce the
 * same kind of answer. Every layer may depend on the domain, so this is the one
 * place all three can share without an upward dependency.
 */

export interface ValidationDetail {
  /** Field path, or `row.N` for a line of an upload. */
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
