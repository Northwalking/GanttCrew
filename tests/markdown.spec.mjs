import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

test('notes accept basic Markdown and never let HTML through', async ({ page }) => {
  await newTeam(page);
  const h = await page.evaluate(() =>
    mdHtml(
      'Acuerdo **importante** y *matiz*\n- uno\n- dos <img src=x onerror=alert(1)>\n1. primero\nVer https://example.org/doc.',
    ),
  );
  expect(h).toContain('<b>importante</b>');
  expect(h).toContain('<i>matiz</i>');
  expect(h).toContain('<ul><li>uno</li><li>dos &lt;img');
  expect(h).toContain('<ol><li>primero</li></ol>');
  expect(h).toContain('<a href="https://example.org/doc" target="_blank"');
  expect(h).not.toContain('<img');
  // arithmetic is not emphasis
  expect(await page.evaluate(() => mdHtml('2 * 3 * 4 = 24'))).toBe('2 * 3 * 4 = 24');
});

test('the task description shows the formatted text and switches to editing on click', async ({ page }) => {
  await newTeam(page);
  await page.evaluate(() => openTask(arr('tasks')[0].id));
  await page.fill('#tDesc', 'Criterio: **cero errores**\n- prueba A\n- prueba B');
  await page.locator('#tName').focus();
  const pv = page.locator('#tDesc').locator('xpath=preceding-sibling::div[1]');
  await expect(pv.locator('b')).toHaveText('cero errores');
  await expect(pv.locator('li')).toHaveCount(2);
  await expect(page.locator('#tDesc')).toBeHidden();
  await pv.click();
  await expect(page.locator('#tDesc')).toBeFocused();
});

test('the Word export keeps bold text and sub-points, and the import reads them back', async ({ page }) => {
  await newTeam(page);
  await page.evaluate(() => (location.hash = 'diario'));
  await page.waitForSelector('#dNew');
  const r = await page.evaluate(async () => {
    dAdd('2026-06-11', 'Revisión del **informe final** con *matices*\n- anexo A\n- anexo B');
    const blob = dDocx(dDaysWith(), 'Diario');
    const xml = await docxText(await blob.arrayBuffer());
    return { xml, back: dParse(docxParas(xml)) };
  });
  expect(r.xml).toContain('<w:b/>');
  expect(r.xml).toContain('<w:i/>');
  expect(r.xml).toContain('<w:ilvl w:val="1"/>');
  expect(r.back[0].day).toBe('2026-06-11');
  expect(r.back[0].lines[0].t).toBe('Revisión del **informe final** con *matices*');
  expect(r.back[0].lines.map((l) => l.t).slice(1)).toEqual(['anexo A', 'anexo B']);
});
