import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@app/(auth)/actions';

/**
 * Shared top nav for every authenticated page. Server Component — the only
 * client pieces are ThemeToggle and the sign-out button's pending state,
 * which SubmitButton (rebuilt in Task 5) already handles.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-[var(--header-bg)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-(--container-max) items-center justify-between px-6">
          <Link href="/roadmaps" className="font-display text-lg font-semibold tracking-tight">
            LockedIn
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
