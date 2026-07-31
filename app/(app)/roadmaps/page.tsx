import Link from 'next/link';
import { requireUserId } from '@/http/session';
import { listRoadmapsFor } from '@/usecases/roadmaps';
import { signOutAction } from '../../(auth)/actions';
import { createRoadmapAction, setStatusAction } from '../actions';
import { TimezoneField } from './timezone-field';

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
    <main className="lk-container" style={{ paddingBlock: 40, maxWidth: 760 }}>
      <header
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <span className="lk-label">LockedIn</span>
          <h2 style={{ marginBottom: 0 }}>Roadmaps</h2>
        </div>
        <form action={signOutAction}>
          <button className="lk-btn" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <hr />

      {error ? (
        <p role="alert" style={{ fontWeight: 'bold' }}>
          {error}
        </p>
      ) : null}

      {roadmaps.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)' }}>
          Nothing yet. Create a roadmap, upload some problems, and it will start
          nagging you.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
          {roadmaps.map((roadmap) => (
            <li key={roadmap.id} className="lk-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Link href={`/roadmaps/${roadmap.id}`} style={{ fontSize: '1.15rem' }}>
                  {roadmap.name}
                </Link>
                <span className="lk-label">{roadmap.status}</span>
              </div>
              <p className="lk-label" style={{ marginTop: 6 }}>
                {roadmap.startDate} → {roadmap.endDate} · {roadmap.sendTimeLocal}{' '}
                {roadmap.timezone}
              </p>
              <form action={setStatusAction}>
                <input type="hidden" name="roadmapId" value={roadmap.id} />
                <input
                  type="hidden"
                  name="status"
                  value={roadmap.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED'}
                />
                <button className="lk-btn" type="submit">
                  {roadmap.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h3>New roadmap</h3>
      <form action={createRoadmapAction} style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
        <label>
          <span className="lk-label">Name</span>
          <input className="lk-input" name="name" required placeholder="Blind 75" />
        </label>
        <label>
          <span className="lk-label">Start date</span>
          <input className="lk-input" type="date" name="startDate" required />
        </label>
        <label>
          <span className="lk-label">End date</span>
          <input className="lk-input" type="date" name="endDate" required />
        </label>
        <label>
          <span className="lk-label">Daily send time</span>
          <input className="lk-input" type="time" name="sendTimeLocal" required defaultValue="07:00" />
        </label>
        <TimezoneField />
        <button className="lk-btn lk-btn-primary" type="submit">
          Create
        </button>
      </form>
    </main>
  );
}
