import { expect } from '@playwright/test';

// Opens the tool on a fresh, empty data folder (the browser's private storage stands in for the
// shared OneDrive folder) and creates a team with the sample data.
export async function newTeam(page, { lang = 'es', sample = true } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ([l, dir]) => {
      localStorage.setItem('gantt.lang', l);
      window.__testDirP = navigator.storage
        .getDirectory()
        .then((r) => r.getDirectoryHandle(dir, { create: true }));
    },
    [lang, 'test-' + Math.random().toString(36).slice(2)],
  );
  await page.goto('/GanttCrew.html');
  await page.fill('#nN', 'Ana');
  await page.fill('#nP', 'clave-segura-1');
  await page.fill('#nP2', 'clave-segura-1');
  if (!sample) await page.uncheck('#nS');
  await page.click('#nf button');
  await expect(page.locator('#nav')).toBeVisible();
  await page.waitForFunction(() => typeof started !== 'undefined' && started);
  return errors;
}

export const VIEWS = ['gantt', 'equipo', 'tareas', 'reuniones', 'cumplimiento', 'ausencias', 'ajustes'];

export async function show(page, view) {
  await page.evaluate((v) => {
    location.hash = v;
  }, view);
  await page.waitForTimeout(300);
}
