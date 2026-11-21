import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

test('the creator is recorded: About dialog, footer, metadata and exports', async ({ page }) => {
  const errors = await newTeam(page);
  await expect(page.locator('footer.appfoot')).toContainText('© 2026 Liang');
  await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Liang');
  await page.click('#aboutBtn');
  await expect(page.locator('#dlg')).toContainText('Liang');
  await expect(page.locator('#dlg')).toContainText('MIT');
  await page.evaluate(() => closeDlg());
  const r = await page.evaluate(async () => {
    const txt = async (b) => new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()));
    const xl = await txt(ganttWorkbook({ from: todayS(), to: iso(todayN() + 60), unit: 'week' }).blob);
    return {
      version: APP.version,
      ics: buildICS(null).includes('PRODID:-//Liang//GanttCrew'),
      xlApp: xl.includes('<Application>GanttCrew ' + APP.version + ' · Liang</Application>'),
      xlCore: xl.includes('docProps/core.xml'),
      xlSign: xl.includes('Generado con GanttCrew'),
    };
  });
  expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(r).toMatchObject({ ics: true, xlApp: true, xlCore: true, xlSign: true });
  expect(errors).toEqual([]);
});
