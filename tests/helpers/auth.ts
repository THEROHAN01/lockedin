import './db';
import { auth } from '@/auth';

/**
 * Signs up a real user and returns a usable session cookie.
 *
 * The reason email+password was chosen over magic links or OAuth (see src/auth.ts):
 * this runs with no inbox to intercept and no provider to stub, so authentication
 * never becomes a reason a test cannot be written.
 */

export const TEST_PASSWORD = 'correct-horse-battery-staple';

let sequence = 0;

/** Collapses a Set-Cookie header into the `name=value; name=value` form a request sends back. */
export function cookieHeaderFrom(response: Response): string {
  const raw = response.headers.getSetCookie();
  return raw.map((entry) => entry.split(';')[0]).join('; ');
}

export interface TestSession {
  userId: string;
  email: string;
  cookie: string;
}

export async function signUpAndSession(email?: string): Promise<TestSession> {
  sequence += 1;
  const address = email ?? `signup${sequence}@example.com`;

  const response = await auth.api.signUpEmail({
    body: { email: address, password: TEST_PASSWORD, name: `User ${sequence}` },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`sign-up failed: ${response.status} ${await response.text()}`);
  }

  const cookie = cookieHeaderFrom(response);
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });

  if (!session) throw new Error('sign-up produced no usable session');

  return { userId: session.user.id, email: address, cookie };
}

/** Builds request headers carrying a session, for calling route handlers directly. */
export function authedHeaders(
  session: TestSession,
  extra: Record<string, string> = {},
): Headers {
  return new Headers({ cookie: session.cookie, ...extra });
}
