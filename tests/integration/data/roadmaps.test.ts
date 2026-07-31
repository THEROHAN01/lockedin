import { describe, expect, it } from 'vitest';
import { makeRoadmap, makeUser } from '../../helpers/factories';
import {
  createRoadmap,
  findOwnedRoadmap,
  listActiveRoadmaps,
  listRoadmapsByUser,
  setRoadmapStatus,
  updateOwnedRoadmap,
} from '@/data/roadmaps';

describe('createRoadmap', () => {
  it('round-trips as domain types, not database rows', async () => {
    const user = await makeUser();
    const roadmap = await createRoadmap({
      userId: user.id,
      name: 'Blind 75',
      startDate: '2026-01-01',
      endDate: '2026-01-30',
      sendTimeLocal: '07:00',
      timezone: 'Asia/Kolkata',
    });

    // Dates come back as LocalDate strings. If these were Date objects the
    // domain would be handling instants, which is the bug this guards.
    expect(roadmap).toMatchObject({
      userId: user.id,
      name: 'Blind 75',
      startDate: '2026-01-01',
      endDate: '2026-01-30',
      sendTimeLocal: '07:00',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    });
    expect(typeof roadmap.startDate).toBe('string');
  });

  it('starts life ACTIVE', async () => {
    const user = await makeUser();
    const roadmap = await makeRoadmap(user.id);
    expect(roadmap.status).toBe('ACTIVE');
  });
});

describe('findOwnedRoadmap', () => {
  it('finds the owner’s own roadmap', async () => {
    const user = await makeUser();
    const created = await makeRoadmap(user.id);
    const found = await findOwnedRoadmap(created.id, user.id);
    expect(found?.id).toBe(created.id);
  });

  it('returns null for another user’s roadmap', async () => {
    // The API turns this null into a 404, never a 403: a 403 would confirm the
    // id exists and make the API an id oracle.
    const owner = await makeUser();
    const stranger = await makeUser();
    const created = await makeRoadmap(owner.id);

    expect(await findOwnedRoadmap(created.id, stranger.id)).toBeNull();
  });

  it('returns null for an id that does not exist', async () => {
    const user = await makeUser();
    expect(await findOwnedRoadmap('nope', user.id)).toBeNull();
  });
});

describe('listRoadmapsByUser', () => {
  it('returns only the caller’s roadmaps', async () => {
    const mine = await makeUser();
    const theirs = await makeUser();
    await makeRoadmap(mine.id, { name: 'Mine A' });
    await makeRoadmap(mine.id, { name: 'Mine B' });
    await makeRoadmap(theirs.id, { name: 'Theirs' });

    const list = await listRoadmapsByUser(mine.id);
    expect(list.map((r) => r.name).sort()).toEqual(['Mine A', 'Mine B']);
  });
});

describe('updateOwnedRoadmap', () => {
  it('changes dates after creation, which is the whole point of computing at send time', async () => {
    const user = await makeUser();
    const created = await makeRoadmap(user.id);

    const updated = await updateOwnedRoadmap(created.id, user.id, {
      endDate: '2026-03-15',
    });

    expect(updated?.endDate).toBe('2026-03-15');
    expect(updated?.startDate).toBe('2026-01-01');
  });

  it('changes only the fields given', async () => {
    const user = await makeUser();
    const created = await makeRoadmap(user.id);

    const updated = await updateOwnedRoadmap(created.id, user.id, {
      name: 'Renamed',
    });

    expect(updated).toMatchObject({
      name: 'Renamed',
      sendTimeLocal: '07:00',
      timezone: 'Asia/Kolkata',
    });
  });

  it('archives via status, because archive is a field and not an endpoint', async () => {
    const user = await makeUser();
    const created = await makeRoadmap(user.id);

    const archived = await updateOwnedRoadmap(created.id, user.id, {
      status: 'ARCHIVED',
    });
    expect(archived?.status).toBe('ARCHIVED');

    const revived = await updateOwnedRoadmap(created.id, user.id, {
      status: 'ACTIVE',
    });
    expect(revived?.status).toBe('ACTIVE');
  });

  it('refuses to touch another user’s roadmap', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const created = await makeRoadmap(owner.id);

    expect(
      await updateOwnedRoadmap(created.id, stranger.id, { name: 'Hijacked' }),
    ).toBeNull();

    const untouched = await findOwnedRoadmap(created.id, owner.id);
    expect(untouched?.name).toBe('Blind 75');
  });
});

describe('listActiveRoadmaps', () => {
  it('is what the cron sweep iterates', async () => {
    const user = await makeUser();
    const active = await makeRoadmap(user.id, { name: 'Active' });
    const archived = await makeRoadmap(user.id, { name: 'Archived' });
    const done = await makeRoadmap(user.id, { name: 'Done' });

    await setRoadmapStatus(archived.id, 'ARCHIVED');
    await setRoadmapStatus(done.id, 'COMPLETED');

    const sweep = await listActiveRoadmaps();
    expect(sweep.map((r) => r.id)).toEqual([active.id]);
  });

  it('spans users, since the sweep is global', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeRoadmap(a.id);
    await makeRoadmap(b.id);

    expect(await listActiveRoadmaps()).toHaveLength(2);
  });
});
