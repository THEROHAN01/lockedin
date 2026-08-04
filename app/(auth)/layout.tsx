import '@/styles/base.css';

/**
 * Same purpose as app/(app)/layout.tsx: scope the blueprint layer to the
 * product routes so it stays out of the /docs CSS bundle.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
