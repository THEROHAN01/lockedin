'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { Roadmap } from '@/domain/types';
import { setStatusAction } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * Archiving stops all nagging for a roadmap, so it gets a confirm step —
 * unlike unarchiving, which is always safe to do immediately.
 */
export function RoadmapCard({ roadmap }: { roadmap: Roadmap }) {
  const isArchived = roadmap.status === 'ARCHIVED';

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="grid gap-1">
          <Link href={`/roadmaps/${roadmap.id}`} className="font-medium hover:underline">
            {roadmap.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {roadmap.startDate} → {roadmap.endDate} · {roadmap.sendTimeLocal}{' '}
            {roadmap.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isArchived ? 'secondary' : 'default'}>
            {roadmap.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Roadmap actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isArchived ? (
                <form action={setStatusAction}>
                  <input type="hidden" name="roadmapId" value={roadmap.id} />
                  <input type="hidden" name="status" value="ACTIVE" />
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left">
                      Unarchive
                    </button>
                  </DropdownMenuItem>
                </form>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Archive
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive &ldquo;{roadmap.name}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This stops all daily emails for this roadmap. You can
                        unarchive it later from the same menu.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <form action={setStatusAction}>
                        <input type="hidden" name="roadmapId" value={roadmap.id} />
                        <input type="hidden" name="status" value="ARCHIVED" />
                        <AlertDialogAction type="submit">
                          Archive
                        </AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          {isArchived ? 'Not sending emails' : 'Nagging daily'}
        </div>
      </CardContent>
    </Card>
  );
}
