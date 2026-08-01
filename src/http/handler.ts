import type { ZodType } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '@/auth';
import { ValidationError } from '@/errors';
import {
  malformedJson,
  unauthenticated,
  validationFailed,
} from './respond';

/**
 * The bits every route handler needs: a signed-in user, a parsed body, and one
 * place that turns domain failures into the documented status codes.
 */

class MalformedJsonError extends Error {}

/**
 * Runs `handle` with the signed-in user's id, or answers 401.
 *
 * The catch is here rather than in each handler so the mapping from failure to
 * status code exists once. Anything not listed propagates and becomes a 500,
 * which is correct — an unrecognised failure is a bug, not a client error.
 */
export async function withUser(
  request: Request,
  handle: (userId: string) => Promise<Response>,
): Promise<Response> {
  try {
    // Inside the try so the comment above is actually true. A rejected session —
    // a malformed or post-rotation cookie — is a client sending bad credentials,
    // which is a 401, not a 500. Anything that is not an auth-level error is
    // infrastructure and must keep propagating, so a database outage does not
    // masquerade as "please sign in".
    let userId: string | undefined;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user.id;
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
    }

    if (!userId) return unauthenticated();

    return await handle(userId);
  } catch (error) {
    if (error instanceof ValidationError) return validationFailed(error.details);
    if (error instanceof MalformedJsonError) return malformedJson();
    throw error;
  }
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MalformedJsonError();
  }
}

/**
 * Validates an untrusted body at the boundary.
 *
 * This is not belt-and-braces over the TypeScript types. A type that excludes,
 * say, a server-derived status value is no defence at all against
 * `await request.json()` — the value arrives as `unknown` and any cast is a lie.
 * Runtime validation is the only thing standing there.
 */
export function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new ValidationError(
    result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(body)',
      message: issue.message,
    })),
  );
}
