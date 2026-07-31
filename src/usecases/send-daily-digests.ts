import {
  daysInclusive,
  isSendDue,
  localDateFor,
  localTimeFor,
} from '@/domain/dates';
import { buildDigest } from '@/domain/digest';
import { computeProgress } from '@/domain/progress';
import { computeDailyQuota } from '@/domain/quota';
import { selectItemsForToday } from '@/domain/selection';
import type { LocalDate } from '@/domain/types';
import { countItems, listOutstandingItems } from '@/data/items';
import {
  type ActiveRoadmap,
  listActiveRoadmapsWithRecipient,
  setRoadmapStatus,
} from '@/data/roadmaps';
import { findSentKeys, recordSend, releaseSend, sentKey } from '@/data/send-log';
import type { NotificationChannel } from '@/notifications/channel';

/**
 * The daily sweep.
 *
 * Split in two because there are two reasons to change. This function owns the
 * sweep — fetch, decide who is due, isolate per-roadmap failures, aggregate a
 * result — and `sendDigestForRoadmap` owns one roadmap's pipeline. The
 * requirement that one failure must not abort the run is what forces the split:
 * the try/catch belongs around the pipeline, not inside it.
 *
 * `now` is a parameter, not a clock read, so every case is deterministic in tests.
 */

export interface SweepResult {
  sent: number;
  skipped: number;
  failed: number;
}

export async function sendDailyDigests(
  now: Date,
  channel: NotificationChannel,
): Promise<SweepResult> {
  const roadmaps = await listActiveRoadmapsWithRecipient();
  if (roadmaps.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const due = roadmaps
    .map((roadmap) => ({
      roadmap,
      localDate: localDateFor(now, roadmap.timezone),
      localTime: localTimeFor(now, roadmap.timezone),
    }))
    .filter(
      ({ roadmap, localDate, localTime }) =>
        isSendDue(localTime, roadmap.sendTimeLocal) &&
        // Nothing before the roadmap begins.
        daysInclusive(roadmap.startDate, localDate) >= 1,
    );

  if (due.length === 0) {
    return { sent: 0, skipped: roadmaps.length, failed: 0 };
  }

  // One query for the whole sweep. Due-ness stays true for the rest of the local
  // day by design, so this question is asked about every due roadmap on all 96
  // daily ticks — a point query per roadmap is what breaks first under load.
  const alreadySent = await findSentKeys(
    due.map(({ roadmap }) => roadmap.id),
    [...new Set(due.map(({ localDate }) => localDate))],
  );

  let sent = 0;
  let failed = 0;

  // Sequential on purpose. Bounded concurrency is the documented next step, once
  // a single window's due-and-unsent count approaches ~25 (ARCHITECTURE.md §6).
  for (const { roadmap, localDate } of due) {
    if (alreadySent.has(sentKey(roadmap.id, localDate))) continue;

    try {
      if (await sendDigestForRoadmap(roadmap, localDate, channel)) sent += 1;
    } catch {
      // Swallowed deliberately: the point of this catch is that one roadmap's
      // problem is not everyone else's. The claim has already been released.
      failed += 1;
    }
  }

  return { sent, skipped: roadmaps.length - sent - failed, failed };
}

/**
 * One roadmap's decision pipeline. Returns whether a digest actually went out.
 */
export async function sendDigestForRoadmap(
  roadmap: ActiveRoadmap,
  localDate: LocalDate,
  channel: NotificationChannel,
): Promise<boolean> {
  const outstanding = await listOutstandingItems(roadmap.id);

  if (outstanding.length === 0) {
    // Finishing the last item is what ends a roadmap; passing the end date is not.
    // A roadmap with no items at all is also caught here — nothing to nag about.
    if (await countItems(roadmap.id) > 0) {
      await setRoadmapStatus(roadmap.id, 'COMPLETED');
    }
    return false;
  }

  const quota = computeDailyQuota({
    remainingCount: outstanding.length,
    today: localDate,
    endDate: roadmap.endDate,
  });
  const chosen = selectItemsForToday(outstanding, quota);

  const totalCount = await countItems(roadmap.id);
  const digest = buildDigest({
    roadmapName: roadmap.name,
    items: chosen,
    progress: computeProgress({
      completedCount: totalCount - outstanding.length,
      totalCount,
      startDate: roadmap.startDate,
      endDate: roadmap.endDate,
      today: localDate,
    }),
    today: localDate,
  });

  // Claim before sending. Two overlapping invocations would otherwise both pass a
  // read-then-write check and both deliver; here only one wins the insert.
  const claimed = await recordSend(roadmap.id, localDate, chosen.length);
  if (!claimed) return false;

  try {
    await channel.send(roadmap.recipient, digest);
  } catch (error) {
    // Give the day back, or a transient delivery failure costs the user the whole
    // day instead of being retried on the next tick.
    await releaseSend(roadmap.id, localDate);
    throw error;
  }

  return true;
}
