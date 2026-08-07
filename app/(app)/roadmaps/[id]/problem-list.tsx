'use client';

import { useOptimistic, useTransition } from 'react';
import { Check } from 'lucide-react';
import type { Difficulty } from '@/domain/types';
import { markCompleteInPlace } from '../../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Item {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  position: number;
  completed: boolean;
}

const DIFFICULTY_VARIANT: Record<Difficulty, 'default' | 'secondary' | 'outline'> = {
  EASY: 'default',
  MEDIUM: 'secondary',
  HARD: 'outline',
};

/**
 * Mark-solved is the single most-clicked action in the product, so it gets
 * an optimistic update instead of waiting on the Server Action round trip.
 * On failure, useOptimistic's state reverts automatically once the real
 * items prop is unchanged and the transition settles — we surface the error
 * by leaving the item unmarked and relying on the (rare) failure being
 * visible on next interaction, matching the low-stakes nature of this action.
 */
export function ProblemList({
  roadmapId,
  items,
}: {
  roadmapId: string;
  items: Item[];
}) {
  const [optimisticItems, setOptimisticItem] = useOptimistic(
    items,
    (state, completedId: string) =>
      state.map((item) =>
        item.id === completedId ? { ...item, completed: true } : item,
      ),
  );
  const [, startTransition] = useTransition();

  function handleMarkSolved(itemId: string) {
    startTransition(async () => {
      setOptimisticItem(itemId);
      await markCompleteInPlace(roadmapId, itemId);
    });
  }

  if (optimisticItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No problems yet. Paste some CSV below.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {optimisticItems.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-md border border-border p-3"
        >
          <span
            aria-hidden
            className={
              item.completed
                ? 'flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
                : 'size-5 shrink-0 rounded-full border-2 border-dashed border-muted-foreground'
            }
          >
            {item.completed ? <Check className="size-3" /> : null}
          </span>
          <div className="grid flex-1 gap-0.5">
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {item.title}
            </a>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>#{item.position}</span>
              <Badge variant={DIFFICULTY_VARIANT[item.difficulty]} className="text-xs">
                {item.difficulty}
              </Badge>
            </div>
          </div>
          {item.completed ? (
            <span className="text-sm text-muted-foreground">Done</span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleMarkSolved(item.id)}>
              Mark solved
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
