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

const TB = (uid) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${uid}
SUMMARY:Briefing diario
DTSTART:20261102T083000
DTEND:20261102T084500
RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=40
END:VEVENT
BEGIN:VEVENT
UID:otra-1
SUMMARY:Reunión suelta
DTSTART:20261110T100000
DTEND:20261110T110000
END:VEVENT
END:VCALENDAR
`;

test('a recurring Thunderbird invitation can be hidden as a whole and shown again', async ({ page }) => {
  await newTeam(page);
  const n0 = await page.evaluate(async (text) => {
    const d = await window.__testDirP;
    const w = await (await d.getFileHandle(tbName('pm'), { create: true })).createWritable();
    await w.write(text);
    await w.close();
    await refresh(true);
    return arr('meetings').filter((m) => m.source === 'thunderbird').length;
  }, TB('serie-1'));
  expect(n0).toBe(41);
  const id = await page.evaluate(() => arr('meetings').find((m) => m.tbUid === 'serie-1').id);
  await page.evaluate((id) => openMeeting(id), id);
  await page.click('#tbAll');
  await page.click('#tbAll');
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    tb: arr('meetings')
      .filter((m) => m.source === 'thunderbird')
      .map((m) => m.title),
    blanks: arr('meetings').filter((m) => !m.date).length,
    hid: Object.keys(TBHID),
  }));
  expect(r).toEqual({ tb: ['Reunión suelta'], blanks: 0, hid: ['serie-1'] });
  // show it again from the Thunderbird card
  await page.evaluate(() => (location.hash = 'ajustes'));
  await page.click('[data-tbshow]');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => arr('meetings').filter((m) => m.source === 'thunderbird').length)).toBe(
    41,
  );
});

test('several meetings can be deleted at once', async ({ page }) => {
  await newTeam(page);
  await page.evaluate(() => {
    location.hash = 'reuniones';
    UI.meetPeriod = 'all';
    UI.meetSel = true;
    render();
  });
  const before = await page.evaluate(() => arr('meetings').length);
  await page.click('#mSelAll');
  const picked = await page.evaluate(() => UI.meetPick.size);
  expect(picked).toBeGreaterThan(3);
  await page.click('#mSelDel');
  await page.click('#mSelDel');
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    n: arr('meetings').length,
    series: Object.keys(SERIES).length,
  }));
  expect(after.n).toBe(before - picked);
  expect(after.series).toBe(1); // the series itself stays; only the selected occurrences are hidden
});
