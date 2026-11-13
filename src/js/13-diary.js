/* ---------- diario de trabajo (personal y cifrado) ----------
   Each person keeps a private work diary in datos/diario-<id>.json, encrypted with AES-GCM.
   - Project manager: the key is the one derived from the PM password.
   - Team members: a key derived from their own diary password (PBKDF2); nobody else, not even the
     PM, can read it. The key can be remembered in this browser (non-extractable CryptoKey in IndexedDB).
   The file is not part of the shared merge: only its owner reads and writes it. */
const DIARY_APP = 'gantt-diario';
const D = {
  st: 'init',
  who: null,
  days: {},
  key: null,
  salt: null,
  lm: 0,
  timer: null,
  q: Promise.resolve(),
  dirty: false,
};
const DUI = { day: null, mode: 'day', q: '', month: null };
const dFile = () => `diario-${ME.memberId}.json`;
const dfmt = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');
const dLines = (day) => (D.days[day]?.lines || []).filter((l) => !l.x);
const dDaysWith = () =>
  Object.keys(D.days)
    .filter((k) => dLines(k).length)
    .sort();

async function dRead() {
  try {
    const h = await dirH.getFileHandle(dFile());
    const f = await h.getFile();
    const j = JSON.parse(await f.text());
    return j.app === DIARY_APP ? { j, lm: f.lastModified } : null;
  } catch (e) {
    return null;
  }
}
// Opens the diary of the current user: decrypts it if the key is at hand, otherwise asks for the password
async function dOpen() {
  Object.assign(D, { st: 'loading', who: ME.memberId, days: {}, key: null, salt: null, lm: 0, dirty: false });
  const r = await dRead();
  if (!r) {
    // no diary yet: the PM's is created with the PM key, a member's with their own password
    if (ME.owner && EVKEY) Object.assign(D, { st: 'open', key: EVKEY });
    else D.st = ME.owner ? 'nokey' : 'new';
    return;
  }
  D.salt = r.j.salt || null;
  if (D.salt) {
    // protected with its own password (also a PM who already had a diary as a member)
    const key = await kvGet('dkey-' + ME.memberId);
    if (key && (await dDecrypt(key, r))) return;
    D.st = 'locked';
    return;
  }
  if (ME.owner && EVKEY && (await dDecrypt(EVKEY, r))) return;
  D.st = ME.owner ? 'nokey' : 'foreign';
}
async function dDecrypt(key, r) {
  try {
    if ((await dec(key, r.j.check)) !== 'diario-ok') return false;
    const d = (await dec(key, r.j.box)) || {};
    Object.assign(D, { st: 'open', key, days: d.days || {}, lm: r.lm });
    return true;
  } catch (e) {
    return false;
  }
}
async function dUnlock(pw, remember) {
  const r = await dRead();
  if (!r) {
    // first time: this password creates the diary
    D.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    D.key = await deriveKey(pw, ub64(D.salt));
    Object.assign(D, { st: 'open', days: {} });
    await dWrite();
  } else {
    D.salt = r.j.salt;
    const key = await deriveKey(pw, ub64(D.salt));
    if (!(await dDecrypt(key, r))) return false;
  }
  if (remember) await kvSet('dkey-' + ME.memberId, D.key);
  return true;
}
function dTouch(day) {
  const o = (D.days[day] = D.days[day] || { lines: [] });
  o.u = Date.now();
  D.dirty = true;
  clearTimeout(D.timer);
  D.timer = setTimeout(dWrite, 700);
}
// Writes the whole diary. If the file changed elsewhere (same person on another computer),
// each day keeps its most recently edited version.
function dWrite() {
  clearTimeout(D.timer);
  D.q = D.q
    .then(async () => {
      if (D.st !== 'open' || !D.key) return;
      const r = await dRead();
      if (r && r.lm !== D.lm) {
        try {
          const other = ((await dec(D.key, r.j.box)) || {}).days || {};
          for (const [k, v] of Object.entries(other))
            if (!D.days[k] || (v.u || 0) > (D.days[k].u || 0)) D.days[k] = v;
        } catch (e) {}
      }
      const text = JSON.stringify({
        app: DIARY_APP,
        version: 1,
        member: ME.memberId,
        salt: D.salt || undefined,
        check: await enc(D.key, 'diario-ok'),
        box: await enc(D.key, { days: D.days }),
        updatedAt: new Date().toISOString(),
      });
      const h = await dirH.getFileHandle(dFile(), { create: true });
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      D.lm = (await h.getFile()).lastModified;
      D.dirty = false;
    })
    .catch((e) => dbErr(e));
  return D.q;
}
window.addEventListener('beforeunload', () => {
  if (D.dirty) dWrite();
});

/* ----- líneas ----- */
function dAdd(day, text, extra = {}) {
  text = String(text || '').trim();
  if (!text) return null;
  const o = (D.days[day] = D.days[day] || { lines: [] });
  const l = { id: newId(), t: text, ...extra };
  o.lines.push(l);
  dTouch(day);
  return l;
}
const dFind = (day, id) => (D.days[day]?.lines || []).find((l) => l.id === id);
const dPendOpen = () => {
  const out = [];
  for (const day of dDaysWith()) for (const l of dLines(day)) if (l.pend && !l.done) out.push({ day, l });
  return out;
};
// What the tool already knows about that day: your meetings, the tasks you had work planned on, absences
function dSuggest(day) {
  const mid = ME.memberId,
    d = dn(day),
    used = new Set(dLines(day).map((l) => l.src));
  const di = dayInfo(mid, d),
    out = [];
  for (const m of di.ms)
    out.push({
      src: 'm:' + m.id,
      ic: '🗓',
      pre: m.time || '',
      t: m.title || '(sin título)',
      p: m.projectId || '',
    });
  for (const { t } of di.ts)
    out.push({ src: 't:' + t.id, ic: '▸', pre: '', t: t.name, p: t.projectId, k: t.id });
  if (di.ab) out.push({ src: 'a:' + di.ab.id, ic: '⏸', pre: '', t: T(absLabel(di.ab)), p: '', noTr: false });
  return out.filter((s) => !used.has(s.src));
}

/* ----- vista ----- */
function vDiario() {
  if (!ME.memberId) return '<div class="card"><div class="hint">Elige primero quién eres.</div></div>';
  if (D.who !== ME.memberId || D.st === 'init') {
    dOpen().then(() => UI.view === 'diario' && dRender());
    return dHead() + '<div class="card"><div class="hint">Abriendo tu diario…</div></div>';
  }
  if (D.st === 'loading')
    return dHead() + '<div class="card"><div class="hint">Abriendo tu diario…</div></div>';
  if (D.st === 'foreign')
    return (
      dHead() +
      '<div class="card"><div class="note warn">Este diario se cifró con una contraseña de project manager que ya no está en uso y no se puede abrir. Si es tuyo y no lo necesitas, pide al project manager que borre el archivo de la carpeta de datos para empezar uno nuevo.</div></div>'
    );
  if (D.st === 'nokey')
    return (
      dHead() +
      '<div class="card"><div class="note warn">Introduce la contraseña de PM para abrir tu diario.</div></div>'
    );
  if (D.st === 'new' || D.st === 'locked') {
    const nw = D.st === 'new';
    return (
      dHead() +
      `<div class="card" style="max-width:520px"><h3>${nw ? 'Crea la contraseña de tu diario' : 'Tu diario está protegido'}</h3>
      <p class="hint">${
        nw
          ? 'Tu diario se guarda cifrado con una contraseña que solo conoces tú. Nadie más puede leerlo: ni tus compañeros ni el project manager.'
          : 'Escribe la contraseña de tu diario para abrirlo.'
      }</p>
      <form id="dPwF" class="form" style="display:grid;gap:10px">
        <label>Contraseña del diario<input type="password" id="dPw" required minlength="8" autocomplete="${nw ? 'new-password' : 'current-password'}"></label>
        ${nw ? '<label>Repítela<input type="password" id="dPw2" required minlength="8" autocomplete="new-password"></label>' : ''}
        <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="dRem" style="width:auto"> Recordar en este navegador (no la marques en un ordenador compartido)</label>
        <div><button class="btn pri">${nw ? 'Crear mi diario' : 'Abrir'}</button></div>
        <div class="note ${nw ? 'warn' : 'info'}">${
          nw
            ? '<b>Guárdala bien:</b> si la olvidas, el diario no se puede recuperar. Nadie puede restablecerla.'
            : 'Si la has olvidado, el diario no se puede recuperar.'
        }</div>
      </form></div>`
    );
  }
  if (!DUI.day) DUI.day = todayS();
  if (!DUI.month) DUI.month = DUI.day.slice(0, 7);
  const pend = dPendOpen();
  let h =
    dHead() +
    `<div class="bar-tools"><div class="seg" id="dMode">${[
      ['day', 'Día'],
      ['month', 'Mes'],
      ['pend', `Pendientes${pend.length ? ' (' + pend.length + ')' : ''}`],
    ]
      .map(
        ([k, t]) =>
          `<button type="button" data-dm="${k}" class="${DUI.mode === k ? 'on' : ''}">${t}</button>`,
      )
      .join(
        '',
      )}</div><input type="search" id="dQ" placeholder="🔍 Buscar en el diario…" value="${esc(DUI.q)}" style="max-width:240px"><span class="sp"></span><button class="btn" id="dImp">Importar…</button><button class="btn" id="dExp">Descargar…</button></div>`;
  if (DUI.q.trim()) h += dvSearch();
  else if (DUI.mode === 'month') h += dvMonth();
  else if (DUI.mode === 'pend') h += dvPend(pend);
  else h += dvDay();
  return h;
}
function dHead() {
  return `<div class="calhead"><div><div class="eyebrow">Registro personal</div><h2>Diario de trabajo</h2><p class="hint">Lo que has hecho cada día. Solo tú puedes leerlo: se guarda cifrado y no lo ven ni tus compañeros ni el project manager.</p></div></div>`;
}
const dProjOpts = (sel) =>
  `<option value="">— Sin proyecto —</option>` +
  projects()
    .map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.code || p.name)}</option>`)
    .join('');
function dvDay() {
  const day = DUI.day,
    dt = new Date(day + 'T12:00:00'),
    sg = dSuggest(day),
    ls = dLines(day);
  const title = dt.toLocaleDateString(LOC(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  let h = `<div class="card"><div class="bar-tools" style="margin-bottom:10px"><button class="btn" id="dPrev" title="Día anterior">‹</button><input type="date" id="dDate" value="${day}" style="width:auto"><button class="btn" id="dNext" title="Día siguiente">›</button><button class="btn" id="dToday">Hoy</button><b style="font-size:15px;margin-left:6px">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</b></div>`;
  if (sg.length)
    h += `<div class="dsug"><span class="mut">De tu agenda de este día:</span> ${sg
      .map(
        (s, i) =>
          `<button type="button" class="dchip" data-ds="${i}" title="Añadir al diario">${s.ic} ${esc(s.pre)} <span data-notr>${esc(s.t)}</span> <b>+</b></button>`,
      )
      .join(
        '',
      )}${sg.length > 1 ? '<button type="button" class="btn sm" id="dSugAll">Añadir todo</button>' : ''}</div>`;
  h += `<div id="dList">${ls
    .map(
      (l) => `<div class="dline ${l.pend ? (l.done ? 'done' : 'pend') : ''}" data-dl="${l.id}">
      <textarea class="dtx" rows="1" aria-label="Texto">${esc(l.t)}</textarea>
      <select class="dpj" title="Proyecto">${dProjOpts(l.p)}</select>
      ${
        l.pend
          ? l.done
            ? `<span class="tag ok" title="Pulsa para volver a dejarlo pendiente" data-dundo>Terminado ${dfmt(l.done)}</span>`
            : `<span class="tag warn">Pendiente</span><button type="button" class="btn sm" data-ddone>Resolver</button>`
          : `<button type="button" class="btn sm ghost" data-dpend title="Marcar como pendiente de resolver">Pendiente</button>`
      }
      <button type="button" class="btn sm ghost" data-ddel title="Quitar esta línea">✕</button></div>`,
    )
    .join('')}</div>
    <div class="dline add"><input type="text" id="dNew" placeholder="Escribe lo que has hecho y pulsa Intro…" autocomplete="off"></div>
    ${ls.length ? '' : '<p class="hint">Aún no hay nada apuntado este día.</p>'}
    <p class="mdhint">Formato: **negrita**, *cursiva*. Pulsa una línea para editarla; con Mayús+Intro añades subpuntos que empiecen por «- ».</p></div>`;
  return h;
}
const dLineHtml = (day, l) =>
  `<li class="${l.pend && !l.done ? 'pend' : ''}"><div class="mdv in" data-notr>${mdHtml(l.t)}</div>${l.p && S.projects[l.p] ? ` <span class="tag mut" data-notr>${esc(S.projects[l.p].code || S.projects[l.p].name)}</span>` : ''}${l.pend ? (l.done ? ` <span class="tag ok">Terminado ${dfmt(l.done)}</span>` : ' <span class="tag warn">Pendiente</span>') : ''}</li>`;
const dDayHtml = (day, lines) =>
  `<div class="dday"><a href="#diario" data-dgo="${day}"><b>Día ${dfmt(day)}</b></a><ul>${lines.map((l) => dLineHtml(day, l)).join('')}</ul></div>`;
function dvMonth() {
  const [y, m] = DUI.month.split('-').map(Number);
  const days = dDaysWith().filter((k) => k.startsWith(DUI.month));
  return `<div class="card"><div class="bar-tools" style="margin-bottom:10px"><button class="btn" id="dMPrev">‹</button><b style="font-size:15px;text-transform:capitalize;min-width:150px;text-align:center">${MESL[m - 1]} ${y}</b><button class="btn" id="dMNext">›</button><span class="mut">${days.length} días con anotaciones</span></div>${
    days.length
      ? days.map((k) => dDayHtml(k, dLines(k))).join('')
      : '<p class="hint">No hay anotaciones este mes.</p>'
  }</div>`;
}
function dvSearch() {
  const q = DUI.q.trim().toLowerCase(),
    out = [];
  for (const day of dDaysWith().reverse()) {
    const ls = dLines(day).filter((l) => l.t.toLowerCase().includes(q) || dfmt(day).includes(q));
    if (ls.length) out.push(dDayHtml(day, ls));
  }
  return `<div class="card"><h3>Resultados</h3>${out.length ? out.join('') : '<p class="hint">No hay anotaciones con ese texto.</p>'}</div>`;
}
function dvPend(pend) {
  return `<div class="card"><h3>Pendientes abiertos</h3>${
    pend.length
      ? pend
          .map(
            ({ day, l }) =>
              `<div class="dline pend" data-dl="${l.id}" data-dday="${day}"><a href="#diario" data-dgo="${day}" class="mut" style="white-space:nowrap">${dfmt(day)}</a><div style="flex:1" class="mdv in" data-notr>${mdHtml(l.t)}</div><button type="button" class="btn sm" data-ddone>Resolver</button></div>`,
          )
          .join('')
      : '<p class="hint">No tienes pendientes abiertos. Marca una línea como «Pendiente» para seguirla aquí.</p>'
  }</div>`;
}
function dRender(focusNew) {
  if (UI.view !== 'diario') return;
  $('#main').innerHTML = vDiario();
  bindDiario();
  if (focusNew) $('#dNew')?.focus();
}
function dGo(day, mode) {
  DUI.day = day;
  DUI.month = day.slice(0, 7);
  if (mode) DUI.mode = mode;
  DUI.q = '';
  dRender();
}
function bindDiario() {
  const f = $('#dPwF');
  if (f) {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const pw = $('#dPw').value;
      if ($('#dPw2') && $('#dPw2').value !== pw) return toast('Las dos contraseñas no coinciden.');
      if (pw.length < 8) return toast('La contraseña debe tener 8 caracteres o más.');
      if (!(await dUnlock(pw, $('#dRem').checked))) return toast('Contraseña incorrecta.');
      dRender(true);
    };
    return;
  }
  const on = (sel, ev, fn) => document.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  on('#dMode [data-dm]', 'click', (e) => {
    DUI.mode = e.currentTarget.dataset.dm;
    DUI.q = '';
    dRender();
  });
  on('[data-dgo]', 'click', (e) => {
    e.preventDefault();
    dGo(e.currentTarget.dataset.dgo, 'day');
  });
  const q = $('#dQ');
  if (q)
    q.oninput = () => {
      DUI.q = q.value;
      const pos = q.selectionStart;
      dRender();
      const n = $('#dQ');
      n.focus();
      n.setSelectionRange(pos, pos);
    };
  if ($('#dImp')) $('#dImp').onclick = openDiaryImport;
  if ($('#dExp')) $('#dExp').onclick = openDiaryExport;
  const shift = (n) => dGo(iso(dn(DUI.day) + n));
  if ($('#dPrev')) $('#dPrev').onclick = () => shift(-1);
  if ($('#dNext')) $('#dNext').onclick = () => shift(1);
  if ($('#dToday')) $('#dToday').onclick = () => dGo(todayS());
  if ($('#dDate')) $('#dDate').onchange = (e) => e.target.value && dGo(e.target.value);
  const mshift = (n) => {
    const [y, m] = DUI.month.split('-').map(Number),
      d = new Date(y, m - 1 + n, 1);
    DUI.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    dRender();
  };
  if ($('#dMPrev')) $('#dMPrev').onclick = () => mshift(-1);
  if ($('#dMNext')) $('#dMNext').onclick = () => mshift(1);
  // suggestions
  const sg = DUI.mode === 'day' && !DUI.q.trim() ? dSuggest(DUI.day) : [];
  const take = (s) => dAdd(DUI.day, s.t, { src: s.src, p: s.p || undefined, k: s.k });
  on('[data-ds]', 'click', (e) => {
    take(sg[+e.currentTarget.dataset.ds]);
    dRender();
  });
  if ($('#dSugAll'))
    $('#dSugAll').onclick = () => {
      sg.forEach(take);
      dRender();
    };
  // lines
  const nw = $('#dNew');
  if (nw)
    nw.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (dAdd(DUI.day, nw.value)) dRender(true);
    };
  document.querySelectorAll('.dline[data-dl]').forEach((row) => {
    const day = row.dataset.dday || DUI.day,
      l = dFind(day, row.dataset.dl);
    if (!l) return;
    const set = (fn, redraw = true) => {
      fn();
      dTouch(day);
      if (redraw) dRender();
    };
    const tx = row.querySelector('.dtx');
    if (tx) {
      const fit = () => {
        tx.style.height = 'auto';
        tx.style.height = tx.scrollHeight + 2 + 'px';
      };
      mdField(tx, { hint: false });
      tx.addEventListener('focus', fit);
      tx.oninput = fit;
      tx.onchange = () =>
        set(() => {
          if (tx.value.trim()) l.t = tx.value.trim();
          else l.x = 1;
        }, !tx.value.trim());
      tx.onkeydown = (e) => {
        // Enter finishes the line; Shift+Enter adds a line inside it (e.g. sub-points with "- ")
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          tx.blur();
          $('#dNew')?.focus();
        }
      };
    }
    const pj = row.querySelector('.dpj');
    if (pj) pj.onchange = () => set(() => (l.p = pj.value || undefined), false);
    const b = (a, fn) => row.querySelector(`[${a}]`) && (row.querySelector(`[${a}]`).onclick = () => set(fn));
    b('data-dpend', () => {
      l.pend = true;
      l.done = '';
    });
    b('data-ddone', () => (l.done = todayS()));
    b('data-dundo', () => (l.done = ''));
    b('data-ddel', () => (l.x = 1));
  });
}

/* ----- descargar: Word (.docx) o texto ----- */
function dRangeDays(from, to) {
  return dDaysWith().filter((k) => (!from || k >= from) && (!to || k <= to));
}
const dSuffix = (l) =>
  !l.pend || /pendiente|terminado|pending|done on/i.test(l.t)
    ? ''
    : l.done
      ? ` → ${LAx('Terminado día', 'Done on')} ${dfmt(l.done)}`
      : ` → ${LAx('PENDIENTE', 'PENDING')}`;
function dText(days) {
  return days
    .map(
      (k) =>
        `${LAx('Día', 'Day')} ${dfmt(k)}\n` +
        dLines(k)
          .map((l) => '  - ' + l.t + dSuffix(l))
          .join('\n'),
    )
    .join('\n\n');
}
const xmlEsc = (s) =>
  String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
function dDocx(days, title) {
  const run = (r, o = {}) =>
    `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${r.b || o.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}<w:sz w:val="${o.sz || 22}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(r.t)}</w:t></w:r>`;
  // o.lvl: 0/1 = bullet of the native Word list; o.ind = continuation text under a bullet
  const p = (t, o = {}) =>
    `<w:p><w:pPr>${o.lvl != null ? `<w:numPr><w:ilvl w:val="${o.lvl}"/><w:numId w:val="1"/></w:numPr>` : ''}${o.sp ? `<w:spacing w:before="${o.sp}" w:after="60"/>` : '<w:spacing w:after="40"/>'}${o.ind ? '<w:ind w:left="720"/>' : ''}</w:pPr>${mdRuns(
      t,
    )
      .map((r) => run(r, o))
      .join('')}</w:p>`;
  let body = p(title, { b: 1, sz: 32 });
  for (const k of days) {
    body += p(`${LAx('Día', 'Day')} ${dfmt(k)}`, { b: 1, sp: 240 });
    for (const l of dLines(k)) {
      const bl = mdBlocks(l.t).filter((b) => b.k !== 'br');
      bl.forEach((b, i) => {
        const t = b.t + (i === 0 ? dSuffix(l) : '');
        if (i === 0) body += p(t, { lvl: 0 });
        else if (b.k === 'p') body += p(t, { ind: 1 });
        else body += p(t, { lvl: 1 });
      });
    }
  }
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const lvl = (n, ch, left) =>
    `<w:lvl w:ilvl="${n}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${ch}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:hint="default"/></w:rPr></w:lvl>`;
  return zipStore({
    '[Content_Types].xml': `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    '_rels/.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
    'word/numbering.xml': `${X}<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvl(0, '•', 720)}${lvl(1, '–', 1440)}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
    'word/document.xml': `${X}<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  });
}
// Minimal ZIP writer (stored, no compression): enough for a .docx
function zipStore(files) {
  const te = new TextEncoder(),
    tbl = new Uint32Array(256).map((_, n) => {
      for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
      return n >>> 0;
    });
  const crc = (u) => {
    let c = 0xffffffff;
    for (const b of u) c = tbl[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const parts = [],
    cen = [];
  let off = 0;
  const hdr = (sig, name, data, extra) => {
    const b = new DataView(new ArrayBuffer(extra ? 46 : 30));
    let i = 0;
    const u32 = (v) => (b.setUint32(i, v, true), (i += 4)),
      u16 = (v) => (b.setUint16(i, v, true), (i += 2));
    u32(sig);
    if (extra) u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(0);
    u16(0x21);
    u32(crc(data));
    u32(data.length);
    u32(data.length);
    u16(name.length);
    u16(0);
    if (extra) {
      u16(0);
      u16(0);
      u16(0);
      u32(0);
      u32(extra.off);
    }
    return new Uint8Array(b.buffer);
  };
  for (const [n, txt] of Object.entries(files)) {
    const name = te.encode(n),
      data = te.encode(txt);
    const lh = hdr(0x04034b50, name, data);
    parts.push(lh, name, data);
    cen.push(hdr(0x02014b50, name, data, { off }), name);
    off += lh.length + name.length + data.length;
  }
  const csz = cen.reduce((a, x) => a + x.length, 0),
    e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, cen.length / 2, true);
  e.setUint16(10, cen.length / 2, true);
  e.setUint32(12, csz, true);
  e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
function dDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function openDiaryExport() {
  const all = dDaysWith();
  if (!all.length) return toast('Tu diario está vacío.');
  const m0 = DUI.month || todayS().slice(0, 7);
  openDlg(
    'Descargar el diario',
    `<label>Desde<input type="date" id="xF" value="${all[0]}"></label><label>Hasta<input type="date" id="xT" value="${all[all.length - 1]}"></label>
     <label class="full">Formato<select id="xK"><option value="docx">Word (.docx)</option><option value="txt">Texto (.txt)</option></select></label>
     <div class="full"><button type="button" class="btn sm" id="xM">${LAx('Solo', 'Only')} ${MESL[+m0.slice(5) - 1]} ${m0.slice(0, 4)}</button> <button type="button" class="btn sm" id="xA">Todo el diario</button></div>
     <div class="full hint" id="xI"></div>
     <div class="full note warn">El archivo descargado <b>no está cifrado</b>: guárdalo en un sitio privado, no en la carpeta compartida.</div>`,
    async () => {
      const days = dRangeDays(val('xF'), val('xT'));
      if (!days.length) {
        toast('No hay anotaciones en ese periodo.');
        return false;
      }
      const name = `${LAx('Diario de trabajo', 'Work diary')} ${days[0]}_${days[days.length - 1]}`;
      if (val('xK') === 'txt')
        dDownload(new Blob([dText(days)], { type: 'text/plain;charset=utf-8' }), name + '.txt');
      else dDownload(dDocx(days, LAx('Diario de trabajo', 'Work diary')), name + '.docx');
      toast('Diario descargado.');
    },
  );
  $('#mSave').textContent = 'Descargar';
  const info = () => {
    const d = dRangeDays(val('xF'), val('xT'));
    $('#xI').textContent = `${d.length} días con anotaciones en ese periodo.`;
  };
  $('#xM').onclick = () => {
    const [y, m] = m0.split('-').map(Number);
    $('#xF').value = m0 + '-01';
    $('#xT').value = m0 + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
    info();
  };
  $('#xA').onclick = () => {
    $('#xF').value = all[0];
    $('#xT').value = all[all.length - 1];
    info();
  };
  ['xF', 'xT'].forEach((i) => ($('#' + i).onchange = info));
  info();
}

/* ----- importar: Word (.docx) o texto con entradas «Día dd/mm/aaaa» ----- */
async function docxText(buf) {
  const u = new Uint8Array(buf),
    v = new DataView(buf);
  let e = u.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip');
  let p = v.getUint32(e + 16, true);
  const n = v.getUint16(e + 10, true),
    td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nl));
    if (name === 'word/document.xml') {
      const meth = v.getUint16(p + 10, true),
        csz = v.getUint32(p + 20, true),
        lo = v.getUint32(p + 42, true);
      const st = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true),
        raw = u.subarray(st, st + csz);
      if (meth === 0) return td.decode(raw);
      const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(ds).text();
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('docx');
}
function docxParas(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml'),
    W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const el = (n, name) => [...n.childNodes].find((c) => c.namespaceURI === W && c.localName === name);
  const on = (rpr, name) => {
    const x = rpr && el(rpr, name);
    return !!x && !/^(0|false)$/.test(x.getAttributeNS(W, 'val') || '');
  };
  return [...doc.getElementsByTagNameNS(W, 'p')].map((p) => {
    const segs = [];
    for (const r of p.getElementsByTagNameNS(W, 'r')) {
      const rpr = el(r, 'rPr');
      let t = '';
      for (const c of r.childNodes) {
        if (c.namespaceURI !== W) continue;
        if (c.localName === 't') t += c.textContent;
        else if (c.localName === 'tab' || c.localName === 'br') t += ' ';
        else if (c.localName === 'sym') t += '→';
      }
      if (!t) continue;
      const f = (on(rpr, 'b') ? 'b' : '') + (on(rpr, 'i') ? 'i' : ''),
        last = segs[segs.length - 1];
      if (last && (last.f === f || !t.trim())) last.t += t;
      else segs.push({ t, f });
    }
    // a paragraph that is bold or italic as a whole is a heading or a style, not emphasis
    if (segs.length === 1) return segs[0].t;
    return segs
      .map((s) => {
        const m = s.t.match(/^(\s*)([\s\S]*?)(\s*)$/),
          k = s.f === 'bi' ? '***' : s.f === 'b' ? '**' : s.f === 'i' ? '*' : '';
        return k && m[2] ? m[1] + k + m[2] + k + m[3] : s.t;
      })
      .join('');
  });
}
// "Día 11/06/2026" (or "Day …", or a bare date) starts a day; the following paragraphs are its lines
function dParse(paras) {
  const RE = /^\s*(?:d[ií]a|day)?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*[:.]?\s*$/i,
    days = [];
  let cur = null;
  for (let s of paras) {
    s = s
      .replace(/[]/g, '→')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[-•·*]\s+/, '');
    if (!s) continue;
    const m = s.replace(/\*/g, '').match(RE);
    if (m) {
      const day = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      cur = dn(day) != null ? { day, lines: [] } : null;
      if (cur) days.push(cur);
      continue;
    }
    if (!cur) continue;
    const l = { t: s };
    const dn2 = s.match(/terminad[oa]\s+(?:el\s+)?(?:d[ií]a\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (dn2)
      Object.assign(l, {
        pend: true,
        done: `${dn2[3]}-${dn2[2].padStart(2, '0')}-${dn2[1].padStart(2, '0')}`,
      });
    else if (/\bPENDIENTE\b|\bPENDING\b/.test(s)) l.pend = true;
    cur.lines.push(l);
  }
  return days.filter((d) => d.lines.length);
}
function openDiaryImport() {
  let found = [];
  openDlg(
    'Importar un diario',
    `<div class="full hint">Elige un documento de <b>Word (.docx)</b> o de <b>texto (.txt)</b> en el que cada día empiece con una línea del tipo <b data-notr>«Día 11/06/2026»</b>. Las líneas siguientes se importan como anotaciones de ese día.</div>
     <label class="full">Archivo<input type="file" id="iF" accept=".docx,.txt,.md,text/plain"></label>
     <div class="full" id="iR"></div>`,
    async () => {
      if (!found.length) {
        toast('Elige primero un archivo con anotaciones.');
        return false;
      }
      let n = 0;
      for (const d of found) {
        const have = new Set(dLines(d.day).map((l) => l.t));
        for (const l of d.lines)
          if (!have.has(l.t)) {
            dAdd(d.day, l.t, { pend: l.pend, done: l.done });
            n++;
          }
      }
      await dWrite();
      toast(`${n} anotaciones importadas.`);
      dGo(found[found.length - 1].day, 'month');
    },
  );
  $('#mSave').textContent = 'Importar';
  $('#iF').onchange = async (e) => {
    const f = e.target.files[0];
    found = [];
    if (!f) return;
    try {
      const paras = /\.docx$/i.test(f.name)
        ? docxParas(await docxText(await f.arrayBuffer()))
        : (await f.text()).split(/\r?\n/);
      found = dParse(paras);
    } catch (x) {
      $('#iR').innerHTML = '<div class="note warn">No se pudo leer el archivo.</div>';
      return;
    }
    if (!found.length) {
      $('#iR').innerHTML =
        '<div class="note warn">No he encontrado ningún día en el archivo. Cada día debe empezar con una línea como <span data-notr>«Día 11/06/2026»</span>.</div>';
      return;
    }
    const nl = found.reduce((a, d) => a + d.lines.length, 0),
      np = found.reduce((a, d) => a + d.lines.filter((l) => l.pend && !l.done).length, 0),
      ds = found.map((d) => d.day).sort();
    $('#iR').innerHTML =
      `<div class="note info"><b>${found.length}</b> días y <b>${nl}</b> anotaciones (${dfmt(ds[0])} – ${dfmt(ds[ds.length - 1])}). <b>${np}</b> quedan marcadas como pendientes.<br>Las que ya estén en tu diario con el mismo texto no se duplican.</div>
      <div class="dprev">${found
        .slice(0, 3)
        .map((d) => dDayHtml(d.day, d.lines))
        .join('')}${found.length > 3 ? '<p class="hint">…</p>' : ''}</div>`;
  };
}
