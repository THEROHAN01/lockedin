'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { Roadmap } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { RoadmapCard } from './roadmap-card';

type Filter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

/**
 * Client-side filter over an already-fetched list — no refetch, no server
 * round trip. useDeferredValue keeps the filter buttons responsive even if
 * the list ever grows large enough that re-rendering it is not instant.
 */
export function StatusFilter({ roadmaps }: { roadmaps: Roadmap[] }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const deferredFilter = useDeferredValue(filter);

  const filtered = useMemo(() => {
    if (deferredFilter === 'ALL') return roadmaps;
    return roadmaps.filter((r) => r.status === deferredFilter);
  }, [roadmaps, deferredFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        {(['ALL', 'ACTIVE', 'ARCHIVED'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {value === 'ALL' ? 'All' : value === 'ACTIVE' ? 'Active' : 'Archived'}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roadmaps match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} />
          ))}
        </div>
      )}
    </div>
  );
}
