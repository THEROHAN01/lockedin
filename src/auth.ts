import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/data/prisma';

/**
 * Auth per ADR-004: Better Auth on the same Postgres database as roadmap and
 * progress data, so user identity is joinable rather than sitting in a
 * third-party silo.
 *
 * Email and password only. Chosen for testability more than product fit — it is
 * the one method an integration test can drive with no inbox interception and no
 * provider stub, which matters when every API test needs a session. Adding OAuth
 * or magic links later needs no schema change.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.`);
  }
  return value;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: required('BETTER_AUTH_SECRET'),
  baseURL: required('BETTER_AUTH_URL'),
  emailAndPassword: {
    enabled: true,
    // No verification email in the MVP: the only transactional email that ships
    // is the daily digest (ROADMAP feature 5).
    requireEmailVerification: false,
  },
});
