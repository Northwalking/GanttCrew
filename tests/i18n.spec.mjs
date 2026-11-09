import { test, expect } from '@playwright/test';
import { newTeam, show, VIEWS } from './helpers.mjs';

// Fails when a visible Spanish text is left untranslated with the English interface.
// If you add a text to the code, add its translation to i18n/en.tsv.
const SPANISH =
  /[áéíóúñ¿¡]|\b(de|del|la|las|los|y|con|para|por|sin|que|tarea|tareas|proyecto|proyectos|reunión|reuniones|hoy|día|días|semana|mes|año|horas|fecha|inicio|equipo|ausencia|festivo|guardar|cancelar|cerrar|nuevo|nueva|editar|pausa|avance|prevista|previsto|carga|todos|todas|solo|hay|está|esta|marca|elige|pulsa|cada|persona)\b/i;
// user data and proper names are not translated
const ALLOWED = /Iván|Lucía|Almudena|Español|Comunidad de Madrid|BOCM|de enero|datos|\.ics|\.json/;

async function leftovers(page) {
  return page.evaluate(
    ([sp, ok]) => {
      const SP = new RegExp(sp, 'i'),
        OK = new RegExp(ok);
      const out = new Set(),
        w = document.createTreeWalker(document.body, 5);
      let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) {
          const t = n.nodeValue.trim(),
            el = n.parentElement;
          if (
            t &&
            SP.test(t) &&
            !OK.test(t) &&
            !el.closest('script,style,textarea,[data-notr]') &&
            el.offsetParent !== null
          )
            out.add(t);
        } else
          for (const a of ['title', 'placeholder']) {
            const v = n.getAttribute(a);
            if (v && SP.test(v) && !OK.test(v) && !n.closest('[data-notr]')) out.add('@' + v);
          }
      }
      return [...out];
    },
    [SPANISH.source, ALLOWED.source],
  );
}

test('the English interface has no Spanish leftovers', async ({ page }) => {
  const errors = await newTeam(page, { lang: 'en' });
  const found = new Set();
  for (const v of VIEWS) {
    await show(page, v);
    (await leftovers(page)).forEach((t) => found.add(`${v}: ${t}`));
  }
  await show(page, 'gantt');
  await page.evaluate(() => {
    UI.groupBy = 'person';
    render();
  });
  (await leftovers(page)).forEach((t) => found.add(`gantt by person: ${t}`));
  const dialogs = {
    task: () => openTask(arr('tasks').find((t) => t.status !== 'done').id),
    newTask: () => openTask(null),
    project: () => openProject(arr('projects')[0].id),
    meeting: () => openMeeting(null),
    absence: () => openAbsence(null),
    extra: () => openExtra(null),
    exportImage: () => openExportGantt(),
    alerts: () => openAlerts(),
    member: () => openMember(arr('members')[0].id),
    holiday: () => openHoliday(null),
  };
  for (const [name, fn] of Object.entries(dialogs)) {
    await page.evaluate(fn);
    await page.waitForTimeout(300);
    (await leftovers(page)).forEach((t) => found.add(`${name}: ${t}`));
    await page.evaluate(() => document.querySelector('#modal').classList.remove('show'));
  }
  expect([...found]).toEqual([]);
  expect(errors).toEqual([]);
});

test('switching ES ⇄ EN is immediate and reversible', async ({ page }) => {
  await newTeam(page, { lang: 'es' });
  await expect(page.locator('#nav')).toContainText('Calendario');
  await page.click('#langSw [data-lang="en"]');
  await expect(page.locator('#nav')).toContainText('Calendar');
  await expect(page.locator('#nav')).not.toContainText('Calendario');
  await page.click('#langSw [data-lang="es"]');
  await expect(page.locator('#nav')).toContainText('Calendario');
});

test('sample data follows the language chosen when the team is created', async ({ page }) => {
  await newTeam(page, { lang: 'en' });
  const names = await page.evaluate(() =>
    projects()
      .map((p) => p.name)
      .sort(),
  );
  expect(names).toEqual(['Booking app', 'Cloud migration', 'Customer portal']);
});
