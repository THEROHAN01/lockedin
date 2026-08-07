import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { requireUserId } from '@/http/session';
import { getProgressFor, listItemsWithCompletionFor } from '@/usecases/progress';
import { getRoadmapFor } from '@/usecases/roadmaps';
import {
  sendNowAction,
  updateDatesAction,
  uploadCsvAction,
} from '../../actions';
import { SubmitButton } from '../../../submit-button';
import { ProblemList } from './problem-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export default async function RoadmapDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sweep?: string }>;
}) {
  const userId = await requireUserId();
  const [{ id }, { error, sweep }] = await Promise.all([params, searchParams]);

  const roadmap = await getRoadmapFor(userId, id);
  if (roadmap === null) notFound();

  const [items, progress] = await Promise.all([
    listItemsWithCompletionFor(userId, id),
    getProgressFor(userId, id),
  ]);

  const percent =
    progress && progress.totalCount > 0
      ? Math.round((progress.completedCount / progress.totalCount) * 100)
      : 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-6 py-10">
      <div>
        <Link
          href="/roadmaps"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All roadmaps
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{roadmap.name}</h1>
          <Badge variant={roadmap.status === 'ARCHIVED' ? 'secondary' : 'default'}>
            {roadmap.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {roadmap.startDate} → {roadmap.endDate} · {roadmap.sendTimeLocal}{' '}
          {roadmap.timezone}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {sweep ? (
        <Alert>
          <AlertDescription>
            <span className="font-medium">Sweep result:</span> {sweep}
          </AlertDescription>
        </Alert>
      ) : null}

      {progress ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
            <CardDescription>
              {progress.completedCount} of {progress.totalCount} solved · day{' '}
              {progress.daysElapsed} of {progress.totalDays}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={percent} />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Problems</h2>
        <ProblemList roadmapId={roadmap.id} items={items ?? []} />
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Upload problems</h2>
          <p className="text-sm text-muted-foreground">
            title,url,difficulty — one per line. Header optional.
          </p>
        </div>
        <form action={uploadCsvAction} className="grid gap-3">
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <Textarea
            name="csv"
            rows={6}
            required
            defaultValue={'Two Sum,https://leetcode.com/problems/two-sum,EASY'}
          />
          <SubmitButton pendingLabel="Appending" className="justify-self-start">
            Append
          </SubmitButton>
        </form>
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reschedule</h2>
          <p className="text-sm text-muted-foreground">
            Nothing is precomputed, so changing these changes tomorrow&apos;s email.
          </p>
        </div>
        <form action={updateDatesAction} className="grid max-w-sm gap-4">
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <div className="grid gap-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={roadmap.startDate}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={roadmap.endDate}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sendTimeLocal">Daily send time</Label>
            <Input
              id="sendTimeLocal"
              type="time"
              name="sendTimeLocal"
              defaultValue={roadmap.sendTimeLocal}
              required
            />
          </div>
          <SubmitButton pendingLabel="Saving" className="justify-self-start">
            Save
          </SubmitButton>
        </form>
      </section>

      {process.env.NODE_ENV === 'production' ? null : (
        <>
          <Separator />
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Send now</h2>
              <p className="text-sm text-muted-foreground">
                Development only. Runs the real sweep over{' '}
                <strong>every active roadmap</strong>, not just this one,
                including the send log — so a second press does nothing
                until tomorrow.
              </p>
            </div>
            <form action={sendNowAction}>
              <input type="hidden" name="roadmapId" value={roadmap.id} />
              <SubmitButton pendingLabel="Sweeping" variant="outline">
                Run sweep
              </SubmitButton>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
