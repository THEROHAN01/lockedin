import { AlertCircle } from 'lucide-react';
import { requireUserId } from '@/http/session';
import { listRoadmapsFor } from '@/usecases/roadmaps';
import { createRoadmapAction } from '../actions';
import { SubmitButton } from '../../submit-button';
import { StatusFilter } from './status-filter';
import { TimezoneField } from './timezone-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function RoadmapsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await requireUserId();
  const [{ error }, roadmaps] = await Promise.all([
    searchParams,
    listRoadmapsFor(userId),
  ]);

  return (
    <div className="mx-auto grid max-w-(--container-max) gap-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roadmaps</h1>
        <p className="text-sm text-muted-foreground">
          Every plan you&apos;re being nagged about.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {roadmaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Create a roadmap, upload some problems, and it will
          start nagging you.
        </p>
      ) : (
        <StatusFilter roadmaps={roadmaps} />
      )}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">New roadmap</CardTitle>
          <CardDescription>Name it, time-box it, pick a send time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createRoadmapAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Blind 75" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" name="startDate" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" name="endDate" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sendTimeLocal">Daily send time</Label>
              <Input
                id="sendTimeLocal"
                type="time"
                name="sendTimeLocal"
                required
                defaultValue="07:00"
              />
            </div>
            <TimezoneField />
            <SubmitButton pendingLabel="Creating" className="justify-self-start">
              Create
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
