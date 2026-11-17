import { test, expect } from '@playwright/test';
import { newTeam, show, VIEWS } from './helpers.mjs';

test('collaborators share a task: their load, the forecast and their alert', async ({ page }) => {
  const errors = await newTeam(page);
  const id = await page.evaluate(() => {
    const t = arr('tasks').find((x) => x.assigneeId === 'm1' && x.status !== 'done' && !x.deps?.length);
    return t.id;
  });
  await page.evaluate((id) => openTask(id), id);
  await page.selectOption('#tAddCol', 'm2');
  await page.fill('[data-cd="m2"]', '50');
  await page.click('#mSave');
  await expect(page.locator('#modal')).not.toHaveClass(/show/);
  const r = await page.evaluate((id) => {
    const t = S.tasks[id];
    const s = dn(t.start) > todayN() ? dn(t.start) : todayN();
    const withC = forecasts()[id].end;
    const without = forecasts({ ...t, id, collab: [] })[id].end;
    const L = (o) => loadDays('m2', s, s + 13, o).h.reduce((a, b) => a + b, 0);
    return {
      collab: t.collab,
      colOn: Object.keys(t.colOn || {}),
      withC,
      without,
      helperLoad: L({}) - L({ exclude: id }),
      inTask: inTask({ ...t, id }, 'm2'),
      names: teamNames(t),
    };
  }, id);
  expect(r.collab).toEqual([{ id: 'm2', ded: 50 }]);
  expect(r.colOn).toEqual(['m2']);
  expect(r.inTask).toBe(true);
  expect(r.helperLoad).toBeGreaterThan(0);
  expect(r.withC).toBeLessThanOrEqual(r.without);
  expect(r.names).toContain(' + ');
  // the collaborator is told
  const al = await page.evaluate(() => {
    ME.owner = false;
    ME.memberId = 'm2';
    return alerts()
      .filter((a) => a.key.startsWith('co:'))
      .map((a) => a.txt);
  });
  expect(al.length).toBe(1);
  // every view and the Excel export still work
  await page.evaluate(() => {
    ME.owner = true;
    ME.memberId = 'pm';
  });
  for (const v of VIEWS) await show(page, v);
  const xl = await page.evaluate(
    () => ganttWorkbook({ from: todayS(), to: iso(todayN() + 90), unit: 'week' }).tasks,
  );
  expect(xl).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
