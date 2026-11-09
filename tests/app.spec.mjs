import { test, expect } from '@playwright/test';
import { newTeam, show, VIEWS } from './helpers.mjs';

test('creates a team with the sample data and renders every view', async ({ page }) => {
  const errors = await newTeam(page);
  const n = await page.evaluate(() => ({
    p: projects().length,
    t: arr('tasks').length,
    m: members().length,
  }));
  expect(n).toEqual({ p: 3, t: 12, m: 4 });
  for (const v of VIEWS) {
    await show(page, v);
    await expect(page.locator('#main')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('an intern who works Monday, Wednesday and Friday is only planned on those days', async ({ page }) => {
  await newTeam(page);
  const days = await page.evaluate(() => {
    const iv = members().find((m) => m.name === 'Iván').id;
    const out = new Set();
    for (let d = todayN(); d < todayN() + 60; d++) if (isWorkM(iv, d)) out.add(dow(d));
    return [...out].sort();
  });
  expect(days).toEqual([1, 3, 5]);
});

test('forecast end of a task: 24 h for the intern at 4 h/day takes six of his working days', async ({
  page,
}) => {
  await newTeam(page, { sample: false });
  const r = await page.evaluate(async () => {
    await save('members', 'm9', {
      name: 'Iván',
      role: 'Becario',
      color: '#0e9384',
      isPM: false,
      hoursPerDay: 4,
      workDays: [1, 3, 5],
    });
    await save('projects', 'p9', {
      name: 'Prueba',
      code: 'TEST',
      color: '#2f5bea',
      start: todayS(),
      end: iso(todayN() + 90),
      ownerId: 'pm',
      status: 'active',
    });
    let s = todayN();
    while (dow(s) !== 1 || holAll(s).length) s++;
    await saveTask('t9', {
      projectId: 'p9',
      name: 'Pantallas',
      assigneeId: 'm9',
      start: iso(s),
      end: iso(s + 13),
      estHours: 24,
      dedication: 100,
      progress: 0,
      status: 'pending',
      origin: 'plan',
      priority: 'alta',
      deps: [],
    });
    const f = fcOf(tk('t9'));
    let n = 0;
    for (let d = s; d <= f.end; d++) if (isWorkM('m9', d)) n++;
    return { workingDays: n, endDow: dow(f.end) };
  });
  expect(r.workingDays).toBe(6);
  expect([1, 3, 5]).toContain(r.endDow);
});

test('pausing a task and resuming it shifts its planned end by the paused working days', async ({ page }) => {
  await newTeam(page);
  const r = await page.evaluate(async () => {
    const id = arr('tasks').find((t) => t.status === 'pending' && t.assigneeId === 'm2').id;
    const t = { ...S.tasks[id] };
    delete t.id;
    const from = t.start,
      to = iso(dn(t.start) + 14);
    const shift = gapWork(t.assigneeId, from, to);
    const endAfter = iso(addWork(t.assigneeId, dn(t.end), shift));
    t.hist = [{ k: 'pause', from, to, why: 'test', endBefore: t.end, endAfter }];
    t.end = endAfter;
    await saveTask(id, t);
    return { shift, inact: !!inact(tk(id)), end: tk(id).end, endAfter };
  });
  expect(r.shift).toBeGreaterThan(0);
  expect(r.inact).toBe(false);
  expect(r.end).toBe(r.endAfter);
});

test('private projects never reach the shared files', async ({ page }) => {
  await newTeam(page);
  await show(page, 'ajustes');
  await page.click('#addProj');
  await page.fill('#pN', 'Proyecto secreto');
  await page.check('#pPriv');
  await page.click('#mSave');
  await page.waitForTimeout(500);
  const files = await page.evaluate(async () => {
    const d = await window.__testDirP,
      out = {};
    for await (const [n, h] of d.entries())
      if (h.kind === 'file') out[n] = (await (await h.getFile()).text()).includes('Proyecto secreto');
    return out;
  });
  expect(Object.values(files).some(Boolean)).toBe(false);
  expect(Object.keys(files)).toContain('privado-pm.json');
});

test('date alerts: the PM sees the whole team, a member only their own tasks', async ({ page }) => {
  await newTeam(page);
  const r = await page.evaluate(() => {
    const all = alerts().length;
    ME.owner = false;
    ME.memberId = 'm2';
    const mine = alerts().filter((a) => a.kind === 'task');
    return { all, ok: mine.every((a) => tk(a.id).assigneeId === 'm2'), n: mine.length };
  });
  expect(r.all).toBeGreaterThan(0);
  expect(r.ok).toBe(true);
});
