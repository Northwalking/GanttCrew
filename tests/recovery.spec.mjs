import { test, expect } from '@playwright/test';
import { newTeam, show } from './helpers.mjs';

const OLD = 'clave-segura-1';

test('the PM recovers a forgotten password with the recovery code', async ({ page }) => {
  const errors = await newTeam(page);
  const code = await page.evaluate(() => window.__recCode);
  expect(code).toMatch(/^([0-9A-Z]{5}-){3}[0-9A-Z]{5}$/);
  const before = await page.evaluate(() => Object.keys(S.evals).length);
  expect(before).toBeGreaterThan(0);
  // the code is not in the folder
  const raw = await page.evaluate(async () => {
    const d = await window.__testDirP;
    return await (await (await d.getFileHandle('equipo-pm.json')).getFile()).text();
  });
  expect(raw).not.toContain(code);
  expect(raw).not.toContain(code.replace(/-/g, ''));
  await page.reload();
  await page.waitForSelector('#gate [data-me]', { timeout: 15000 });
  await page.click('#gate [data-me="pm"]');
  await page.click('#wFg');
  await page.fill('#wN', 'clave-nueva-123');
  await page.fill('#wN2', 'clave-nueva-123');
  await page.fill('#wRc', 'AAAAA-AAAAA-AAAAA-AAAAA');
  await page.click('#wRgo');
  await expect(page.locator('#wMsg')).toContainText('no es correcto');
  // typed loosely: lower case and without dashes
  await page.fill('#wRc', code.toLowerCase().replace(/-/g, ' '));
  await page.click('#wRgo');
  await expect(page.locator('#rcV')).toBeVisible();
  const code2 = await page.locator('#rcV').textContent();
  expect(code2).not.toBe(code);
  await page.click('#mSave');
  await expect(page.locator('#rcV')).toBeVisible(); // not closed until the box is ticked
  await page.check('#rcOk');
  await page.click('#mSave');
  const r = await page.evaluate(
    async (c) => ({
      owner: ME.owner,
      evals: Object.keys(S.evals).length,
      oldPw: await pmPasswordOk('clave-segura-1'),
      newPw: await pmPasswordOk('clave-nueva-123'),
      oldCode: await recOpen(c, pmRec()),
    }),
    code,
  );
  expect(r).toEqual({ owner: true, evals: before, oldPw: false, newPw: true, oldCode: null });
  expect(errors).toEqual([]);
});

test('changing the PM password issues a new code; a handover leaves none for the new PM', async ({
  page,
}) => {
  await newTeam(page);
  const code = await page.evaluate(() => window.__recCode);
  await show(page, 'ajustes');
  await page.click('#pmPw');
  await page.fill('#cO', OLD);
  await page.fill('#cN', 'otra-clave-123');
  await page.fill('#cN2', 'otra-clave-123');
  await page.click('#mSave');
  await expect(page.locator('#rcV')).toBeVisible();
  const code2 = await page.locator('#rcV').textContent();
  const r = await page.evaluate(
    async ([a, b]) => [await recOpen(a, pmRec()), await recOpen(b, pmRec())],
    [code, code2],
  );
  expect(r).toEqual([null, 'otra-clave-123']);
  const n = await page.evaluate(async () => {
    await setPmPassword('clave-de-otro-1', null, false);
    return pmRec();
  });
  expect(n).toBeNull();
});

test("a member recovers the diary with the diary's code; the PM's code does not open it", async ({
  page,
}) => {
  const errors = await newTeam(page);
  const pmCode = await page.evaluate(() => window.__recCode);
  await page.evaluate(() => {
    ME.owner = false;
    ME.memberId = 'm1';
  });
  await show(page, 'diario');
  await page.fill('#dPw', 'mi-clave-privada');
  await page.fill('#dPw2', 'mi-clave-privada');
  await page.click('#dPwF button');
  await expect(page.locator('#rcV')).toBeVisible();
  const code = await page.locator('#rcV').textContent();
  await page.check('#rcOk');
  await page.click('#mSave');
  await page.fill('#dNew', 'Nota de Carlos');
  await page.press('#dNew', 'Enter');
  await page.evaluate(async () => {
    await dWrite();
    D.st = 'init';
    D.who = null;
    await dOpen();
    dRender();
  });
  await page.click('#dFg');
  await page.fill('#dRc', pmCode);
  await page.fill('#dPw', 'clave-nueva-diario');
  await page.fill('#dPw2', 'clave-nueva-diario');
  await page.click('#dPwF button.pri');
  await expect(page.locator('#dPwF')).toBeVisible();
  await page.fill('#dRc', code);
  await page.click('#dPwF button.pri');
  await expect(page.locator('#rcV')).toBeVisible();
  const r = await page.evaluate(async () => {
    const lines = dLines(todayS()).map((l) => l.t);
    D.st = 'init';
    D.who = null;
    await dOpen();
    return {
      lines,
      old: await dUnlock('mi-clave-privada', false),
      now: await dUnlock('clave-nueva-diario', false),
    };
  });
  expect(r).toEqual({ lines: ['Nota de Carlos'], old: false, now: true });
  expect(errors).toEqual([]);
});
