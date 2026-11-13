import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { newTeam, show } from './helpers.mjs';

test('a personal copy can be restored into a new, empty folder to browse the history', async ({ page }) => {
  await newTeam(page);
  await page.evaluate(() =>
    save('projects', 'pv1', {
      name: 'Privado',
      code: 'PV',
      priv: true,
      start: todayS(),
      end: iso(todayN() + 30),
      ownerId: 'pm',
      status: 'active',
    }),
  );
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => exportBackup({ evals: false })),
  ]);
  const copy = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(copy.tables.evals).toBeUndefined();
  expect(Object.keys(copy.private.projects)).toEqual(['pv1']);
  // a brand-new folder with a new team and no sample data
  await page.evaluate(async (text) => {
    const root = await navigator.storage.getDirectory();
    window.__testDirP = root.getDirectoryHandle('personal-' + Date.now(), { create: true });
    window.__copy = text;
  }, JSON.stringify(copy));
  const r = await page.evaluate(async () => {
    // same steps the tool runs for an empty folder
    dirH = await window.__testDirP;
    for (const k of Object.keys(FILES)) delete FILES[k];
    const salt = crypto.getRandomValues(new Uint8Array(16));
    EVKEY = await deriveKey('clave-personal-1', salt);
    EVDATA = {};
    PRDATA = { projects: {}, tasks: {}, settings: {} };
    MINE = {
      app: APPID,
      version: 1,
      owner: 'pm',
      crypto: { salt: b64(salt), check: await enc(EVKEY, 'gantt-ok') },
      records: { members: { pm: { name: 'Ana', isPM: true, _u: stamp(), _by: 'pm' } } },
    };
    await writeMine();
    await importBackup(new File([window.__copy], 'copia.json'));
    return {
      tasks: arr('tasks').length,
      projects: arr('projects').length,
      priv: arr('projects').filter((p) => p.priv).length,
      members: members().length,
    };
  });
  expect(r).toEqual({ tasks: 12, projects: 4, priv: 1, members: 4 });
});
