import Link from 'next/link';
import { signInAction } from '../actions';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="lk-container" style={{ maxWidth: 420, paddingBlock: 64 }}>
      <span className="lk-label">LockedIn</span>
      <h2>Sign in</h2>

      {error ? (
        <p role="alert" style={{ color: 'var(--ink)', fontWeight: 'bold' }}>
          {error}
        </p>
      ) : null}

      <form action={signInAction} style={{ display: 'grid', gap: 14 }}>
        <label>
          <span className="lk-label">Email</span>
          <input className="lk-input" type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          <span className="lk-label">Password</span>
          <input
            className="lk-input"
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="lk-btn lk-btn-primary" type="submit">
          Sign in
        </button>
      </form>

      <p style={{ marginTop: 24 }}>
        No account? <Link href="/sign-up">Sign up</Link>
      </p>
    </main>
  );
}
