import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Session access for Server Components and Server Actions, which read headers
 * from context rather than from a Request. Route handlers use `withUser` instead.
 */

export async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

/** Sends a signed-out visitor to sign in rather than rendering an empty page. */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (userId === null) redirect('/sign-in');
  return userId;
}
