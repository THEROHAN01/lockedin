import type { ValidationDetail } from '@/errors';

/**
 * One response shape for the whole API, so six handlers do not invent six
 * spellings of "not found". See docs/ARCHITECTURE.md §7.
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'MALFORMED_JSON'
  | 'VALIDATION_FAILED';

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: readonly ValidationDetail[],
): Response {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function ok(body: unknown): Response {
  return Response.json(body);
}

export function created(body: unknown): Response {
  return Response.json(body, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function unauthenticated(): Response {
  return errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}

/**
 * Also the answer for a resource that exists but is not the caller's. A 403 there
 * would confirm the id is real, which turns the API into an id oracle.
 */
export function notFound(): Response {
  return errorResponse(404, 'NOT_FOUND', 'Not found.');
}

export function malformedJson(): Response {
  return errorResponse(400, 'MALFORMED_JSON', 'Request body is not valid JSON.');
}

export function validationFailed(
  details: readonly ValidationDetail[],
): Response {
  return errorResponse(
    422,
    'VALIDATION_FAILED',
    `${details.length} problem(s) with the request.`,
    details,
  );
}
