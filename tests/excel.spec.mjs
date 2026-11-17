import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { newTeam, show } from './helpers.mjs';

test('the Gantt is exported to a real Excel workbook, without private projects', async ({ page }) => {
  const errors = await newTeam(page);
  await page.evaluate(() =>
    save('projects', 'pv1', {
      name: 'Privado secreto',
      code: 'PV',
      priv: true,
      start: todayS(),
      end: iso(todayN() + 30),
      ownerId: 'pm',
      status: 'active',
    }),
  );
  await show(page, 'gantt');
  await page.click('#expXls');
  await expect(page.locator('#eI')).toContainText('columnas');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#mSave')]);
  expect(dl.suggestedFilename()).toMatch(/^Gantt .*\.xlsx$/);
  if (process.env.XLSX_OUT)
    writeFileSync(process.env.XLSX_OUT, await (await import('node:fs/promises')).readFile(await dl.path()));
  // read the workbook back with the tool's own zip reader
  const r = await page.evaluate(() => {
    const w = ganttWorkbook({
      pid: '',
      from: arr('tasks')
        .map((t) => t.start)
        .sort()[0],
      to: arr('tasks')
        .map((t) => t.end)
        .sort()
        .pop(),
      unit: 'week',
      done: true,
    });
    return w.blob.text().then((txt) => ({
      tasks: w.tasks,
      cols: w.columns,
      priv: txt.includes('Privado secreto'),
      carlos: txt.includes('Carlos'),
      sheets: (txt.match(/<sheet name=/g) || []).length,
    }));
  });
  expect(r.tasks).toBe(12);
  expect(r.cols).toBeGreaterThan(8);
  expect(r).toMatchObject({ priv: false, carlos: true, sheets: 2 });
  expect(errors).toEqual([]);
});
