import Link from 'next/link';
import { signUpAction } from '../actions';
import { SubmitButton } from '../../submit-button';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="lk-container" style={{ maxWidth: 420, paddingBlock: 64 }}>
      <span className="lk-label">LockedIn</span>
      <h2>Sign up</h2>

      {error ? (
        <p role="alert" style={{ color: 'var(--ink)', fontWeight: 'bold' }}>
          {error}
        </p>
      ) : null}

      <form action={signUpAction} style={{ display: 'grid', gap: 14 }}>
        <label>
          <span className="lk-label">Name</span>
          <input className="lk-input" type="text" name="name" autoComplete="name" />
        </label>
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
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <SubmitButton className="lk-btn lk-btn-primary" pendingLabel="Creating account">
          Create account
        </SubmitButton>
      </form>

      <p style={{ marginTop: 24 }}>
        Already have one? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
