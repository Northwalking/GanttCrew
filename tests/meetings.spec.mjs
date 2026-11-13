import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

test('a meeting is entered with start and end time; the length follows the start time', async ({ page }) => {
  const errors = await newTeam(page);
  await page.evaluate(() => openMeeting(null));
  await page.fill('#mT', 'Revisión');
  await page.fill('#mH', '11:00');
  await page.fill('#mF', '12:30');
  await page.locator('#mF').dispatchEvent('change');
  await page.fill('#mH', '15:00');
  await page.locator('#mH').dispatchEvent('change');
  await expect(page.locator('#mF')).toHaveValue('16:30');
  await page.click('#mSave');
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => arr('meetings').find((x) => x.title === 'Revisión'));
  expect(m.time).toBe('15:00');
  expect(m.duration).toBe(90);
  expect(errors).toEqual([]);
});

test('an end time before the start time is rejected', async ({ page }) => {
  await newTeam(page);
  await page.evaluate(() => openMeeting(null));
  await page.fill('#mT', 'Imposible');
  await page.fill('#mH', '11:00');
  await page.fill('#mF', '10:00');
  await page.click('#mSave');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => arr('meetings').some((x) => x.title === 'Imposible'))).toBe(false);
});
