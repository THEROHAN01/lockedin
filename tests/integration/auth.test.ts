import { describe, expect, it } from 'vitest';
import { prisma } from '../helpers/db';
import {
  TEST_PASSWORD,
  cookieHeaderFrom,
  signUpAndSession,
} from '../helpers/auth';
import { auth } from '@/auth';

describe('sign-up', () => {
  it('creates a user in our own database, not a third-party silo', async () => {
    // The point of ADR-004: identity is joinable with roadmap and progress data.
    const session = await signUpAndSession('alice@example.com');

    const user = await prisma.user.findUnique({
      where: { email: 'alice@example.com' },
    });
    expect(user?.id).toBe(session.userId);
  });

  it('yields a session cookie usable offline, with no inbox round trip', async () => {
    const session = await signUpAndSession();
    expect(session.cookie).not.toBe('');

    const resolved = await auth.api.getSession({
      headers: new Headers({ cookie: session.cookie }),
    });
    expect(resolved?.user.id).toBe(session.userId);
  });

  it('refuses a duplicate email', async () => {
    await signUpAndSession('taken@example.com');
    await expect(signUpAndSession('taken@example.com')).rejects.toThrow();
  });
});

describe('sign-in', () => {
  it('accepts the correct password', async () => {
    const { email } = await signUpAndSession();

    const response = await auth.api.signInEmail({
      body: { email, password: TEST_PASSWORD },
      asResponse: true,
    });

    expect(response.ok).toBe(true);
    const resolved = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeaderFrom(response) }),
    });
    expect(resolved?.user.email).toBe(email);
  });

  it('rejects the wrong password', async () => {
    const { email } = await signUpAndSession();

    await expect(
      auth.api.signInEmail({
        body: { email, password: 'not-the-password' },
        asResponse: false,
      }),
    ).rejects.toThrow();
  });

  it('rejects an unknown email', async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: 'nobody@example.com', password: TEST_PASSWORD },
        asResponse: false,
      }),
    ).rejects.toThrow();
  });
});

describe('session resolution', () => {
  it('returns nothing without a cookie', async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it('returns nothing for a forged cookie', async () => {
    const resolved = await auth.api.getSession({
      headers: new Headers({ cookie: 'better-auth.session_token=made-up' }),
    });
    expect(resolved).toBeNull();
  });

  it('keeps two users distinct', async () => {
    const a = await signUpAndSession();
    const b = await signUpAndSession();
    expect(a.userId).not.toBe(b.userId);

    const resolvedA = await auth.api.getSession({
      headers: new Headers({ cookie: a.cookie }),
    });
    expect(resolvedA?.user.id).toBe(a.userId);
  });
});
