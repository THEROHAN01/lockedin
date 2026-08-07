import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserId } from '@/http/session';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const userId = await currentUserId();
  if (userId !== null) redirect('/roadmaps');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="grid gap-4">
        <span className="text-sm font-medium text-muted-foreground">LockedIn</span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          A roadmap that nags you<br className="hidden sm:block" /> until you finish it.
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Upload your problem list, set a pace, and get one email a day until
          it&apos;s done.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
