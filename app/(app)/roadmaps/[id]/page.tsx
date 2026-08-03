import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserId } from '@/http/session';
import { getProgressFor, listItemsWithCompletionFor } from '@/usecases/progress';
import { getRoadmapFor } from '@/usecases/roadmaps';
import {
  markCompleteAction,
  sendNowAction,
  updateDatesAction,
  uploadCsvAction,
} from '../../actions';
import { SubmitButton } from '../../../submit-button';

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
    <main className="lk-container" style={{ paddingBlock: 40, maxWidth: 760 }}>
      <Link href="/roadmaps" className="lk-label">
        ← All roadmaps
      </Link>
      <h2 style={{ marginTop: 12 }}>{roadmap.name}</h2>
      <p className="lk-label">
        {roadmap.status} · {roadmap.startDate} → {roadmap.endDate} ·{' '}
        {roadmap.sendTimeLocal} {roadmap.timezone}
      </p>

      {error ? (
        <p role="alert" className="lk-card" style={{ fontWeight: 'bold' }}>
          {error}
        </p>
      ) : null}
      {sweep ? (
        <p className="lk-card">
          <span className="lk-label">Sweep result</span>
          <br />
          {sweep}
        </p>
      ) : null}

      <hr />

      {progress ? (
        <section>
          <h3>Progress</h3>
          <p>
            {progress.completedCount} of {progress.totalCount} solved · day{' '}
            {progress.daysElapsed} of {progress.totalDays}
          </p>
          <div className="lk-progress">
            <div
              className="lk-progress-fill"
              style={{ ['--bar-pct' as string]: `${percent}%` }}
            />
          </div>
        </section>
      ) : null}

      <hr />

      <section>
        <h3>Problems</h3>
        {items === null || items.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>
            No problems yet. Paste some CSV below.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderLeft: `3px solid var(--difficulty-${item.difficulty.toLowerCase()})`,
                  paddingLeft: 12,
                }}
              >
                <span
                  className={`lk-dot ${item.completed ? 'lk-dot-done' : 'lk-dot-pending'}`}
                  aria-hidden
                />
                <span style={{ flex: 1 }}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                  <span className="lk-label" style={{ display: 'block' }}>
                    #{item.position} · {item.difficulty}
                  </span>
                </span>
                {item.completed ? (
                  <span className="lk-label">Done</span>
                ) : (
                  <form action={markCompleteAction}>
                    <input type="hidden" name="roadmapId" value={roadmap.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitButton pendingLabel="Saving">Mark solved</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr />

      <section>
        <h3>Upload problems</h3>
        <p className="lk-label">title,url,difficulty — one per line. Header optional.</p>
        <form action={uploadCsvAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <textarea
            className="lk-input"
            name="csv"
            rows={6}
            required
            defaultValue={'Two Sum,https://leetcode.com/problems/two-sum,EASY'}
          />
          <SubmitButton
            className="lk-btn lk-btn-primary"
            pendingLabel="Appending"
            style={{ justifySelf: 'start' }}
          >
            Append
          </SubmitButton>
        </form>
      </section>

      <hr />

      <section>
        <h3>Reschedule</h3>
        <p className="lk-label">
          Nothing is precomputed, so changing these changes tomorrow&apos;s email.
        </p>
        <form action={updateDatesAction} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <label>
            <span className="lk-label">Start date</span>
            <input className="lk-input" type="date" name="startDate" defaultValue={roadmap.startDate} required />
          </label>
          <label>
            <span className="lk-label">End date</span>
            <input className="lk-input" type="date" name="endDate" defaultValue={roadmap.endDate} required />
          </label>
          <label>
            <span className="lk-label">Daily send time</span>
            <input className="lk-input" type="time" name="sendTimeLocal" defaultValue={roadmap.sendTimeLocal} required />
          </label>
          <SubmitButton pendingLabel="Saving" style={{ justifySelf: 'start' }}>
            Save
          </SubmitButton>
        </form>
      </section>

      {process.env.NODE_ENV === 'production' ? null : (
        <>
          <hr />
          <section>
            <h3>Send now</h3>
            <p className="lk-label">
              Development only. Runs the real sweep over{' '}
              <strong>every active roadmap</strong>, not just this one, including
              the send log — so a second press does nothing until tomorrow.
            </p>
            <form action={sendNowAction}>
              <input type="hidden" name="roadmapId" value={roadmap.id} />
              <SubmitButton pendingLabel="Sweeping">Run sweep</SubmitButton>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
