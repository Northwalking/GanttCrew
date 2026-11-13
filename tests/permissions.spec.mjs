import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

test('a member reports progress on their task but cannot change its plan', async ({ page }) => {
  await newTeam(page);
  const id = await page.evaluate(() => {
    ME.owner = false;
    ME.memberId = 'm1';
    render();
    return arr('tasks').find((t) => t.assigneeId === 'm1' && t.status === 'doing').id;
  });
  // no way to create tasks
  await expect(page.locator('#addTask')).toHaveCount(0);
  const before = await page.evaluate((id) => ({ ...S.tasks[id] }), id);
  await page.evaluate((id) => openTask(id), id);
  for (const f of ['#tName', '#tS', '#tE', '#tDed', '#tEH', '#tDesc', '#tProj'])
    await expect(page.locator(f)).toBeDisabled();
  for (const f of ['#tSt', '#tP', '#tRH', '#tRS', '#tRE']) await expect(page.locator(f)).toBeEnabled();
  await expect(page.locator('#mDel')).toHaveCount(0);
  await expect(page.locator('[data-pza]')).toHaveCount(0);
  // even if the planning fields are forced in the page, saving keeps the PM's plan
  await page.evaluate(() => {
    for (const [i, v] of [
      ['tE', '2031-01-01'],
      ['tName', 'Cambiada'],
      ['tDed', '5'],
    ]) {
      document.querySelector('#' + i).disabled = false;
      document.querySelector('#' + i).value = v;
    }
    document.querySelector('#tRH').value = '7';
  });
  await page.click('#mSave');
  await page.waitForTimeout(400);
  const after = await page.evaluate((id) => ({ ...S.tasks[id] }), id);
  expect(after.name).toBe(before.name);
  expect(after.end).toBe(before.end);
  expect(after.dedication).toBe(before.dedication);
  expect(+after.remainingHours).toBe(7);
});
