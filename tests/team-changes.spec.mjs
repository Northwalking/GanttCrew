import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

const setLeave = (page, mid, offset) =>
  page.evaluate(
    async ([mid, offset]) => {
      const m = { ...S.members[mid], leftOn: iso(todayN() + offset) };
      delete m.id;
      await save('members', mid, m);
      return m.leftOn;
    },
    [mid, offset],
  );

test('a member with a leave date keeps the history but gets no new work after it', async ({ page }) => {
  const errors = await newTeam(page);
  const left = await setLeave(page, 'm1', 10);
  const r = await page.evaluate((left) => {
    const d = dn(left);
    let after = 0;
    for (let x = d + 1; x < d + 30; x++) if (isWorkM('m1', x)) after++;
    const series = arr('meetings').filter((m) => m.seriesId || m.sid || /^rs-/.test(m.id));
    const future = series.filter((m) => m.date > left),
      past = series.filter((m) => m.date <= left);
    return {
      after,
      stillListedToday: activeMembers().some((m) => m.id === 'm1'),
      listedAfter: activeMembers(iso(d + 1)).some((m) => m.id === 'm1'),
      inFuture: future.some((m) => (m.attendees || []).includes('m1')),
      inPast: past.some((m) => (m.attendees || []).includes('m1')),
      openFlagged: arr('tasks').filter((t) => t.assigneeId === 'm1' && ownerLeft(t)).length,
      alerts: alerts().filter((a) => /^lf:/.test(a.key)).length,
      doneKept: arr('tasks').some((t) => t.assigneeId === 'm1' && t.status === 'done'),
    };
  }, left);
  expect(r.after).toBe(0);
  expect(r.stillListedToday).toBe(true);
  expect(r.listedAfter).toBe(false);
  expect(r.inFuture).toBe(false);
  expect(r.inPast).toBe(true);
  expect(r.openFlagged).toBeGreaterThan(0);
  expect(r.alerts).toBe(r.openFlagged);
  expect(r.doneKept).toBe(true);
  expect(errors).toEqual([]);
});

test('someone who already left is not offered at sign-in or for new tasks', async ({ page }) => {
  await newTeam(page);
  await setLeave(page, 'm3', -3);
  await page.evaluate(() => openTask(null));
  const opts = await page.locator('#tAs option').allTextContents();
  expect(opts).toContain('Carlos');
  expect(opts).not.toContain('Iván');
});

test('handing a task over keeps the first part and links the continuation', async ({ page }) => {
  const errors = await newTeam(page);
  // t2 "API de reservas" (Carlos, in progress); t4 depends on it
  const before = await page.evaluate(() => ({
    ...S.tasks.t2,
    rem: remHours(tk('t2')),
    est: estHours(tk('t2')),
  }));
  await page.evaluate(() => openHandover('t2'));
  await page.selectOption('#hM', 'm2');
  const day = await page.evaluate(() => todayS());
  await page.fill('#hD', day);
  await page.locator('#hD').dispatchEvent('change');
  const start = await page.inputValue('#hS');
  expect(start > day).toBe(true);
  await page.click('#mSave');
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const a = S.tasks.t2,
      b = arr('tasks').find((t) => t.contOf === 't2');
    return { a, b, t4deps: S.tasks.t4.deps };
  });
  expect(r.a.status).toBe('done');
  expect(r.a.assigneeId).toBe('m1');
  expect(r.a.start).toBe(before.start);
  expect(r.a.realEnd).toBe(day);
  expect(r.a.handover).toMatchObject({ member: 'm2', on: day, progress: before.progress, to: r.b.id });
  expect(r.b).toMatchObject({ assigneeId: 'm2', name: before.name, start, deps: ['t2'], status: 'pending' });
  expect(r.b.end >= start).toBe(true);
  expect(+r.b.estimatedHours).toBeCloseTo(Math.round(before.rem * 10) / 10, 1);
  expect(+r.a.estimatedHours + +r.b.estimatedHours).toBeCloseTo(before.est, 0);
  expect(r.t4deps).toEqual([r.b.id]);
  expect(errors).toEqual([]);
});
