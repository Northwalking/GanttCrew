import { test, expect } from '@playwright/test';
import { newTeam, show } from './helpers.mjs';

const OLD = 'clave-segura-1';
const names = (page) =>
  page.evaluate(async () => {
    const out = [];
    for await (const [n] of (await window.__testDirP).entries()) out.push(n);
    return out.sort();
  });

test('changing the PM password re-encrypts evaluations, private projects and the diary', async ({ page }) => {
  const errors = await newTeam(page);
  await page.evaluate(async () => {
    await save('projects', 'pv1', {
      name: 'Privado',
      code: 'PV',
      priv: true,
      start: todayS(),
      end: iso(todayN() + 30),
      ownerId: 'pm',
      status: 'active',
    });
    await dOpen();
    dAdd(todayS(), 'nota del PM');
    await dWrite();
  });
  await show(page, 'ajustes');
  await page.click('#pmPw');
  await page.fill('#cO', OLD);
  await page.fill('#cN', 'otra-clave-nueva');
  await page.fill('#cN2', 'otra-clave-nueva');
  await page.click('#mSave');
  await page.waitForTimeout(800);
  const r = await page.evaluate(async (OLD) => {
    const oldOk = await pmPasswordOk(OLD),
      newOk = await pmPasswordOk('otra-clave-nueva');
    EVKEY = null;
    EVDATA = {};
    const unlocked = await unlockPM('otra-clave-nueva');
    D.st = 'init';
    await dOpen();
    return {
      oldOk,
      newOk,
      unlocked,
      evals: Object.keys(EVDATA).length,
      priv: Object.keys(PRDATA.projects),
      diary: dLines(todayS()).map((l) => l.t),
    };
  }, OLD);
  expect(r).toEqual({
    oldOk: false,
    newOk: true,
    unlocked: true,
    evals: 3,
    priv: ['pv1'],
    diary: ['nota del PM'],
  });
  expect(errors).toEqual([]);
});

test('handing over the team lead: the new PM continues, the old one keeps only the diary', async ({
  page,
}) => {
  await newTeam(page);
  await page.evaluate(async () => {
    await save('projects', 'pv1', {
      name: 'Privado',
      code: 'PV',
      priv: true,
      start: todayS(),
      end: iso(todayN() + 30),
      ownerId: 'pm',
      status: 'active',
    });
    await dOpen();
    dAdd(todayS(), 'nota de Ana');
    await dWrite();
  });
  expect(await names(page)).toContain('privado-pm.json');
  await show(page, 'ajustes');
  await page.click('#pmHo');
  await page.selectOption('#hoM', 'm2');
  await page.fill('#hoP', 'clave-de-lucia-1');
  await page.fill('#hoP2', 'clave-de-lucia-1');
  await page.fill('#hoDp', 'diario-de-ana-1');
  await page.fill('#hoO', OLD);
  await page.check('#hoOk');
  await page.click('#mSave');
  // the page reloads on its own and asks who you are
  await page.waitForSelector('#gate [data-me]', { timeout: 15000 });
  const files = await names(page);
  expect(files).not.toContain('privado-pm.json');
  expect(files).toContain('diario-pm.json');
  // Lucía signs in as PM with her password
  await page.click('#gate [data-me="m2"]');
  await page.fill('#wP', OLD);
  await page.click('#wGo');
  await expect(page.locator('#wMsg')).not.toBeEmpty();
  await page.fill('#wP', 'clave-de-lucia-1');
  await page.click('#wGo');
  await page.waitForFunction(() => typeof started !== 'undefined' && started && ME.owner);
  const r = await page.evaluate(() => ({
    me: ME.memberId,
    roles: [S.members.pm.isPM, S.members.m2.isPM],
    evals: Object.keys(S.evals).length,
    tasks: arr('tasks').length,
    priv: arr('projects').filter((p) => p.priv).length,
    owners: [...new Set(arr('projects').map((p) => p.ownerId))],
    anaTasks: arr('tasks').filter((t) => t.assigneeId === 'pm').length,
  }));
  expect(r).toEqual({
    me: 'm2',
    roles: [false, true],
    evals: 3,
    tasks: 12,
    priv: 0,
    owners: ['m2'],
    anaTasks: 2,
  });
  // Ana, now a member, opens her diary with her own password and can still report on her tasks
  const a = await page.evaluate(async () => {
    ME.owner = false;
    ME.memberId = 'pm';
    MINE = null;
    EVKEY = null;
    D.st = 'init';
    await dOpen();
    const locked = D.st;
    const ok = await dUnlock('diario-de-ana-1', false);
    const t = arr('tasks').find((x) => x.assigneeId === 'pm' && x.status !== 'done');
    const o = { ...t, progress: 35 };
    delete o.id;
    await saveTask(t.id, o);
    return {
      locked,
      ok,
      lines: dLines(todayS()).map((l) => l.t),
      progress: S.tasks[t.id].progress,
      file: myFileName(),
      writer: writerId(),
    };
  });
  expect(a).toEqual({
    locked: 'locked',
    ok: true,
    lines: ['nota de Ana'],
    progress: 35,
    file: 'miembro-pm.json',
    writer: 'member:pm',
  });
  // and her member file is not mistaken for the PM file
  const stillPm = await page.evaluate(async () => {
    await refresh(true);
    return [S.members.pm.isPM, S.members.m2.isPM];
  });
  expect(stillPm).toEqual([false, true]);
});
