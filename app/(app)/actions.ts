'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { aiProviderFromEnv } from '@/ai/from-env';
import { ValidationError } from '@/errors';
import { requireUserId } from '@/http/session';
import { emailChannelFromEnv } from '@/notifications/from-env';
import { markComplete } from '@/usecases/progress';
import {
  addItemsFromCsv,
  createRoadmapForUser,
  updateRoadmapFor,
} from '@/usecases/roadmaps';
import { sendDailyDigests } from '@/usecases/send-daily-digests';

/**
 * Server Actions for the harness UI. Thin: they read the form, call the same use
 * cases the API routes call, and report failure through a query parameter so no
 * client-side state is needed.
 *
 * `redirect()` throws to signal, so it always sits outside the try.
 */

function reasonFor(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export async function createRoadmapAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  let failure: string | null = null;
  try {
    await createRoadmapForUser(userId, {
      name: String(formData.get('name') ?? '').trim(),
      startDate: String(formData.get('startDate') ?? ''),
      endDate: String(formData.get('endDate') ?? ''),
      sendTimeLocal: String(formData.get('sendTimeLocal') ?? ''),
      timezone: String(formData.get('timezone') ?? 'UTC'),
    });
  } catch (error) {
    failure = reasonFor(error);
  }

  if (failure) redirect(`/roadmaps?error=${encodeURIComponent(failure)}`);
  revalidatePath('/roadmaps');
  redirect('/roadmaps');
}

export async function uploadCsvAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const roadmapId = String(formData.get('roadmapId') ?? '');

  let failure: string | null = null;
  try {
    const result = await addItemsFromCsv(
      userId,
      roadmapId,
      String(formData.get('csv') ?? ''),
    );
    if (result === null) failure = 'Roadmap not found.';
  } catch (error) {
    failure = reasonFor(error);
  }

  if (failure) {
    redirect(`/roadmaps/${roadmapId}?error=${encodeURIComponent(failure)}`);
  }
  revalidatePath(`/roadmaps/${roadmapId}`);
  redirect(`/roadmaps/${roadmapId}`);
}

export async function markCompleteAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const roadmapId = String(formData.get('roadmapId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');

  await markComplete(userId, roadmapId, itemId);

  revalidatePath(`/roadmaps/${roadmapId}`);
  redirect(`/roadmaps/${roadmapId}`);
}

export async function markCompleteInPlace(
  roadmapId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  'use server';
  const userId = await requireUserId();

  try {
    await markComplete(userId, roadmapId, itemId);
  } catch (error) {
    return { ok: false, error: reasonFor(error) };
  }

  revalidatePath(`/roadmaps/${roadmapId}`);
  return { ok: true };
}

export async function updateDatesAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const roadmapId = String(formData.get('roadmapId') ?? '');

  let failure: string | null = null;
  try {
    await updateRoadmapFor(userId, roadmapId, {
      startDate: String(formData.get('startDate') ?? ''),
      endDate: String(formData.get('endDate') ?? ''),
      sendTimeLocal: String(formData.get('sendTimeLocal') ?? ''),
    });
  } catch (error) {
    failure = reasonFor(error);
  }

  if (failure) {
    redirect(`/roadmaps/${roadmapId}?error=${encodeURIComponent(failure)}`);
  }
  revalidatePath(`/roadmaps/${roadmapId}`);
  redirect(`/roadmaps/${roadmapId}`);
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const roadmapId = String(formData.get('roadmapId') ?? '');
  const status = String(formData.get('status') ?? '');

  if (status === 'ACTIVE' || status === 'ARCHIVED') {
    await updateRoadmapFor(userId, roadmapId, { status });
  }

  revalidatePath('/roadmaps');
  redirect('/roadmaps');
}

/**
 * Runs the sweep now so a real email lands in a real inbox while developing.
 * Absent in production. Sweeps EVERY active roadmap, not just this one — it is
 * the real sweep, and the roadmapId is only used to redirect back here.
 */
export async function sendNowAction(formData: FormData): Promise<void> {
  await requireUserId();
  const roadmapId = String(formData.get('roadmapId') ?? '');

  if (process.env.NODE_ENV === 'production') {
    redirect(`/roadmaps/${roadmapId}`);
  }

  let outcome: string;
  try {
    const result = await sendDailyDigests(
      new Date(),
      emailChannelFromEnv(),
      aiProviderFromEnv(),
    );
    outcome = `sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}`;
  } catch (error) {
    outcome = reasonFor(error);
  }

  redirect(`/roadmaps/${roadmapId}?sweep=${encodeURIComponent(outcome)}`);
}
