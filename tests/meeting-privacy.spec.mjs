import { test, expect } from '@playwright/test';
import { newTeam, show } from './helpers.mjs';

// Only the people in a meeting (attendees and creator) see its details; the rest, the PM included,
// only see that they are in a meeting. The hours still count for everybody.
test('meeting details are only visible to its participants', async ({ page }) => {
  const errors = await newTeam(page);
  const r = await page.evaluate(async () => {
    // the next working day of both people (meetings on days off do not count)
    let n = todayN() + 1;
    while (!isRegM('m1', n) || !isRegM('m2', n)) n++;
    const d = iso(n);
    // a meeting between two members, without the PM
    const id = await save('meetings', null, {
      title: 'Charla secreta de Carlos',
      notes: 'notas privadas',
      type: 'cliente',
      projectId: arr('projects')[0].id,
      date: d,
      time: '10:00',
      duration: 60,
      attendees: ['m1', 'm2'],
      createdBy: 'm1',
    });
    const pmView = { v: mtgV(S.meetings[id]), edit: canEditMeeting({ id, ...S.meetings[id] }) };
    const pmHours = dayInfo('m1', dn(d)).mh;
    ME.owner = false;
    ME.memberId = 'm1';
    const carlos = { v: mtgV(S.meetings[id]), edit: canEditMeeting({ id, ...S.meetings[id] }) };
    ME.memberId = 'm3';
    const other = { v: mtgV(S.meetings[id]), edit: canEditMeeting({ id, ...S.meetings[id] }) };
    const ics = buildICS(null);
    return { id, pmView, pmHours, carlosHours: dayInfo('m1', dn(d)).mh, carlos, other, ics };
  });
  expect(r.pmView.v.masked).toBe(true);
  expect(r.pmView.v.title).toBe('Reunión');
  expect(r.pmView.edit).toBe(false);
  expect(r.carlos.v.title).toBe('Charla secreta de Carlos');
  expect(r.carlos.edit).toBe(true);
  expect(r.other.v.masked).toBe(true);
  expect(r.other.edit).toBe(false);
  expect(r.pmHours).toBe(r.carlosHours);
  expect(r.pmHours).toBeGreaterThan(0);
  expect(r.ics).not.toContain('Charla secreta');
  expect(r.ics).not.toContain('notas privadas');
  // as the third member, the list and the dialog show no details
  await show(page, 'reuniones');
  await page.evaluate(() => {
    UI.meetPeriod = 'future';
    render();
  });
  const html = await page.locator('#main').innerHTML();
  expect(html).not.toContain('Charla secreta');
  await page.evaluate((id) => openMeeting(id), r.id);
  await expect(page.locator('#dlg h2')).toContainText('🔒');
  await expect(page.locator('#dlg')).not.toContainText('notas privadas');
  expect(errors).toEqual([]);
});
