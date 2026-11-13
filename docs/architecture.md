# Architecture

A short map of the code for contributors. The user-facing guides are [guide.en.md](guide.en.md) and
[guia.es.md](guia.es.md).

## Build

`scripts/build.mjs` concatenates `src/js/*.js` in name order into one `<script>`, inlines `src/styles.css`
into `src/index.html` and writes:

- `dist/GanttCrew.html` — the tool (shared-folder mode);
- `dist/demo/index.html` — the same tool with `DEMO = true` (GitHub Pages).

It also embeds the build stamp (`__BUILD__`, date and time in Europe/Madrid, or `BUILD_STAMP`), the release
notes (`news.json`) and the English dictionary (`i18n/en.tsv`). All modules share one global scope: there is
no bundler and no runtime dependency. The only external resource is pdf.js, loaded from a CDN only when
someone imports a holidays PDF.

## Modules (`src/js`)

| File | Contents |
|---|---|
| `00-i18n.js` | Language engine: `LANG`, `T()`, DOM translation (MutationObserver), ES/EN switch |
| `01-state.js` | Global state `S` (projects, members, tasks, meetings, absences, holidays, extras, config), labels |
| `02-sample-data.js` | Default holidays (Madrid) and the bilingual sample company *Astrorel* (dates relative to today) |
| `03-utils.js` | Dates (`dn`/`iso` day numbers), HTML escaping, small helpers, project types |
| `04-storage.js` | Identity and permissions, reading/merging the folder, writing your own file, AES-GCM encryption |
| `05-calendar-sync.js` | Thunderbird invitations, recurring meetings, `.ics` import/export, 20 s polling |
| `06-startup.js` | Start screens (folder, new team, who are you), demo mode, backups |
| `07-planning.js` | Dependencies, **forecast simulation**, absences/holidays per person, workload |
| `08-gantt.js` | Timeline helpers and the Gantt view |
| `09-views.js` | Calendar, team timeline, Tasks, Meetings, Performance and Absences views |
| `10-holiday-import.js` | Importer of the official holidays gazette (BOCM, Community of Madrid) |
| `11-settings.js` | *Projects & team* view |
| `12-dialogs.js` | All forms: task, project, meeting, absence, holiday, member, pause/resume… |
| `13-diary.js` | Personal work diary: per-person encrypted file, day/month/pending views, Word import/export |
| `13-alerts.js` | Date alerts and the 🔔 bell |
| `14-team-admin.js` | PM password change and handover of the PM role |
| `14-export-image.js` | Export the Gantt as PNG (SVG `foreignObject` rasterisation) |
| `15-main.js` | Bar dragging, `render()` and `init()` |

## Data

The data folder (`datos/`) holds JSON files:

| File | Written by | Contents |
|---|---|---|
| `equipo-pm.json` | project manager | projects, members, settings, holidays, PM's own records |
| `miembro-<id>.json` | each member | that member's tasks, absences, meetings and extra days |
| `evaluaciones-cifradas.json` | project manager | quality evaluations, encrypted |
| `privado-pm.json` | project manager | private projects and their tasks, encrypted |
| `diario-<id>.json` | each person | that person's work diary, encrypted with their own key (not merged, not readable by others) |
| `thunderbird-<name>.ics` | Thunderbird | accepted invitations (read only by the tool) |
| `calendario-<name>.ics`, `calendario-equipo.ics` | the tool | calendars to subscribe to (read only) |

Every record carries `_u` (update time) and `_by` (author). When reading, the newest version of each record
wins among the authors allowed to write it (`ownerField`: tasks → `assigneeId`, absences → `memberId`,
meetings → `createdBy`, extras → `memberId`; the PM can write everything). Deletions are tombstones.
A member may carry `leftOn` (last day in the team). The PM is the member flagged `isPM`; the PM file is
marked `owner: "pm"` (a role, not a person), and a former PM whose member id is `pm` writes as `member:pm`.
The internal format id is `gantt-equipo` and file names are kept in Spanish for compatibility.

Encryption: PBKDF2 (SHA-256) derives an AES-GCM key from the PM password with a random salt stored in
`equipo-pm.json`, together with an encrypted check value.

## Forecast

`forecasts()` simulates each person day by day from today: capacity = hours per day on their working days
(minus holidays, absences and meetings; plus extra days); open tasks get hours in proportion to their
dedication, high priority first, respecting dependencies. Paused or cancelled tasks are skipped. Private
tasks use a virtual resource with the PM's private calendar (N hours, every day).

## Translations

The source is in Spanish. In English, `00-i18n.js` translates every text node and the `title` /
`placeholder` attributes as they appear, using `i18n/en.tsv`:

- `español<TAB>English` — exact text, or a fragment inside a longer text if the key has a space or
  punctuation;
- a leading `=` — whole-text match only (single words always behave like this, so names are not touched);
- `#` — a number, e.g. `Modificar # reunión(es)	Modify # meeting(s)`.

Month and weekday names use `LA()` arrays that switch with the language, and dates use `LOC()`. Mark an
element with `data-notr` to keep it untranslated. `tests/i18n.spec.mjs` fails if a visible Spanish text is
left in English mode.

## Demo mode

With `DEMO = true` the folder is replaced by the browser's private storage (Origin Private File System),
the team is created automatically with the sample data and a banner shows the PM password (`demo-1234`) and
a reset link.
