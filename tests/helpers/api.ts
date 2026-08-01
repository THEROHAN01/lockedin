import type { TestSession } from './auth';

/**
 * Calls route handlers directly rather than over HTTP. They are plain functions
 * of a Request, so there is no server to start and nothing is mocked — the
 * handler, use case, repository, and real Postgres all run.
 */

export function request(
  method: string,
  options: { body?: unknown; session?: TestSession; path?: string } = {},
): Request {
  const headers = new Headers();
  if (options.session) headers.set('cookie', options.session.cookie);

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  return new Request(`http://localhost:3000${options.path ?? '/api/test'}`, {
    method,
    headers,
    body,
  });
}

/** Next 15 hands route handlers their params as a promise. */
export function params<T extends Record<string, string>>(
  values: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(values) };
}

export interface ErrorBody {
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> };
}

export async function jsonOf<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
