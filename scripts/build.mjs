#!/usr/bin/env node
// Builds the single-file app: dist/GanttCrew.html (and dist/demo/index.html for GitHub Pages).
// No dependencies: only Node.js 18+.
//   node scripts/build.mjs                 -> stamp = current date and time (Europe/Madrid)
//   BUILD_STAMP="01/01/2027 10:00" node scripts/build.mjs   -> fixed stamp (reproducible builds)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

function stamp() {
  if (process.env.BUILD_STAMP) return process.env.BUILD_STAMP;
  const f = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => f.find((x) => x.type === t).value;
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
}

// English dictionary: one "español<TAB>English" pair per line; '#' starts a comment
function dictionary() {
  const en = {};
  for (const ln of rd('i18n/en.tsv').split('\n')) {
    if (!ln.trim() || ln.startsWith('#')) continue;
    const i = ln.indexOf('\t');
    if (i < 1) continue;
    const es = ln.slice(0, i),
      tx = ln.slice(i + 1);
    if (tx) en[es] = tx;
  }
  return en;
}

export function build({ demo = false } = {}) {
  const b = stamp();
  const files = readdirSync(join(root, 'src/js'))
    .filter((f) => f.endsWith('.js'))
    .sort();
  let js = files.map((f) => rd('src/js/' + f)).join('');
  js = js
    .replace('__I18N_EN__', () => JSON.stringify(dictionary()))
    .replace("'__BUILD__'", () => JSON.stringify(b))
    .replace('__NEWS__', () => JSON.stringify(JSON.parse(rd('news.json'))))
    .replace("'__DEMO__'", demo ? 'true' : 'false');
  const html = rd('src/index.html')
    .replace('__BUILD__', b)
    .replace('/*__STYLES__*/\n', () => rd('src/styles.css'))
    .replace('/*__SCRIPT__*/\n', () => js);
  return { html, stamp: b };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(root, 'dist');
  mkdirSync(join(out, 'demo'), { recursive: true });
  const app = build();
  writeFileSync(join(out, 'GanttCrew.html'), app.html);
  writeFileSync(join(out, 'demo', 'index.html'), build({ demo: true }).html);
  const n = Object.keys(dictionary()).length;
  console.log(`GanttCrew ${app.stamp} · ${n} English entries · dist/GanttCrew.html, dist/demo/index.html`);
}
