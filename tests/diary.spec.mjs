import { test, expect } from '@playwright/test';
import { newTeam, show } from './helpers.mjs';

const fileText = (page, name) =>
  page.evaluate(async (n) => {
    try {
      const d = await window.__testDirP;
      return await (await (await d.getFileHandle(n)).getFile()).text();
    } catch (e) {
      return null;
    }
  }, name);

test('the PM diary is stored encrypted and offers the day agenda as suggestions', async ({ page }) => {
  const errors = await newTeam(page);
  await show(page, 'diario');
  await expect(page.locator('#dNew')).toBeVisible();
  await page.fill('#dNew', 'Revisión secreta del informe');
  await page.press('#dNew', 'Enter');
  await page.fill('#dNew', 'Llamar al proveedor');
  await page.press('#dNew', 'Enter');
  await expect(page.locator('.dline[data-dl]')).toHaveCount(2);
  await page.locator('.dline[data-dl]').nth(1).locator('[data-dpend]').click();
  await expect(page.locator('#dMode')).toContainText('Pendientes (1)');
  await page.evaluate(() => dWrite());
  const raw = await fileText(page, 'diario-pm.json');
  expect(raw).toContain('gantt-diario');
  expect(raw).not.toContain('secreta');
  expect(raw).not.toContain('proveedor');
  // a team meeting day offers its meetings
  const n = await page.evaluate(() => {
    const m = arr('meetings').find((x) => (x.attendees || []).includes('pm'));
    return dSuggest(m.date).length;
  });
  expect(n).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a member protects the diary with a password that nobody else has, not even the PM', async ({
  page,
}) => {
  await newTeam(page);
  // become Carlos (team member)
  await page.evaluate(() => {
    ME.owner = false;
    ME.memberId = 'm1';
  });
  await show(page, 'diario');
  await expect(page.locator('#dPw2')).toBeVisible();
  await page.fill('#dPw', 'mi-clave-privada');
  await page.fill('#dPw2', 'mi-clave-privada');
  await page.click('#dPwF button');
  await expect(page.locator('#dNew')).toBeVisible();
  await page.fill('#dNew', 'Nota personal de Carlos');
  await page.press('#dNew', 'Enter');
  await page.evaluate(() => dWrite());
  expect(await fileText(page, 'diario-m1.json')).not.toContain('Carlos');
  // the PM key does not open it, a wrong password neither; the right one does
  const r = await page.evaluate(async () => {
    const file = await dRead();
    const pm = await dDecrypt(EVKEY, file);
    D.st = 'init';
    D.who = null;
    await dOpen();
    const locked = D.st;
    const wrong = await dUnlock('otra-clave-123', false);
    const right = await dUnlock('mi-clave-privada', false);
    return { pm, locked, wrong, right, lines: dLines(todayS()).map((l) => l.t) };
  });
  expect(r).toEqual({
    pm: false,
    locked: 'locked',
    wrong: false,
    right: true,
    lines: ['Nota personal de Carlos'],
  });
});

test('the diary can be downloaded as Word and imported back', async ({ page }) => {
  await newTeam(page);
  await show(page, 'diario');
  const r = await page.evaluate(async () => {
    dAdd('2026-06-11', 'Reunión de arranque');
    dAdd('2026-06-12', 'Confirmar plantilla', { pend: true });
    dAdd('2026-06-12', 'Corregir informe', { pend: true, done: '2026-06-15' });
    const blob = dDocx(dDaysWith(), 'Diario');
    const paras = docxParas(await docxText(await blob.arrayBuffer()));
    return dParse(paras);
  });
  expect(r.map((d) => d.day)).toEqual(['2026-06-11', '2026-06-12']);
  expect(r[1].lines[0]).toMatchObject({ pend: true });
  expect(r[1].lines[0].done).toBeFalsy();
  expect(r[1].lines[1]).toMatchObject({ pend: true, done: '2026-06-15' });
});
