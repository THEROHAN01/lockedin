'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { APIError } from 'better-auth/api';
import { auth } from '@/auth';

/**
 * `redirect()` signals by throwing, so it must never sit inside the try — a catch
 * would swallow it and the navigation would silently not happen.
 */

function reasonFor(error: unknown): string {
  if (error instanceof APIError) return error.message;
  return 'Something went wrong. Try again.';
}

export async function signUpAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim() || email;

  let failure: string | null = null;
  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
  } catch (error) {
    failure = reasonFor(error);
  }

  if (failure) redirect(`/sign-up?error=${encodeURIComponent(failure)}`);
  redirect('/roadmaps');
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  let failure: string | null = null;
  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch (error) {
    failure = reasonFor(error);
  }

  if (failure) redirect(`/sign-in?error=${encodeURIComponent(failure)}`);
  redirect('/roadmaps');
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect('/sign-in');
}
