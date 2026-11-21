import { test, expect } from '@playwright/test';
import { newTeam, show } from './helpers.mjs';

test('several meetings on the same day show as one marker with their number and a list', async ({ page }) => {
  const errors = await newTeam(page);
  const d = await page.evaluate(async () => {
    let n = todayN() + 1;
    while (!isRegM('m1', n)) n++;
    const d = iso(n);
    for (const [t, h] of [
      ['Briefing diario', '09:00'],
      ['Revisión técnica', '11:00'],
      ['Seguimiento cliente', '16:00'],
    ])
      await save('meetings', null, {
        title: t,
        date: d,
        time: h,
        duration: 30,
        attendees: ['m1'],
        createdBy: 'pm',
      });
    return d;
  });
  await show(page, 'gantt');
  await page.evaluate(() => {
    UI.groupBy = 'person';
    render();
  });
  const multi = page.locator('.mtg.multi').first();
  await expect(multi).toHaveAttribute('title', /Briefing diario/);
  await expect(multi).toHaveAttribute('title', /Revisión técnica/);
  await multi.click({ force: true });
  await expect(page.locator('#dlg [data-ml]')).toHaveCount(
    await page.evaluate(
      (d) => arr('meetings').filter((x) => x.date === d && (x.attendees || []).includes('m1')).length,
      d,
    ),
  );
  expect(errors).toEqual([]);
});
