import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

test('an absence by hours takes those hours off the working day and shows its time range', async ({
  page,
}) => {
  const errors = await newTeam(page);
  const day = await page.evaluate(() => {
    let d = todayN() + 30;
    while (!isRegM('m1', d) || absOn('m1', d)) d++;
    return iso(d);
  });
  await page.evaluate(() => openAbsence(null, { memberId: 'm1', type: 'permiso' }));
  await page.click('#aMode [data-am="hours"]');
  await page.fill('#aS', day);
  await page.fill('#aF', '10:00');
  await page.fill('#aU', '12:00');
  await page.click('#mSave');
  await page.waitForTimeout(400);
  const r = await page.evaluate((day) => {
    const a = absOn('m1', dn(day));
    return {
      from: a.fromTime,
      to: a.toTime,
      end: a.end,
      avail: absAvail(a),
      stored: a.availability,
      when: absWhen(a),
    };
  }, day);
  expect(r).toMatchObject({ from: '10:00', to: '12:00', end: day, avail: 0.75, stored: 75 });
  expect(r.when).toContain('10:00–12:00');
  expect(errors).toEqual([]);
});

test('an absence of whole days keeps working as before', async ({ page }) => {
  await newTeam(page);
  const a = await page.evaluate(() => arr('absences').find((x) => x.type === 'vac'));
  const r = await page.evaluate(
    (id) => ({ avail: absAvail(S.absences[id]), when: absWhen(S.absences[id]) }),
    a.id,
  );
  expect(r.avail).toBe(0);
  expect(r.when).not.toContain(':');
});
