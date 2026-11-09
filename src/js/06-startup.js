/* ---------- pantallas de inicio ---------- */
function gate(html) {
  const g = $('#gate');
  g.innerHTML = `<div class="gbox">${html}<div class="gver">Versión ${APP_BUILD}</div></div>`;
  g.style.display = 'flex';
}
function hideGate() {
  $('#gate').style.display = 'none';
}
function demoBar() {
  const b = document.createElement('div');
  b.id = 'demoBar';
  b.innerHTML = `<b>Demo</b> · los datos se guardan solo en este navegador · contraseña de PM: <code data-notr>${DEMO_PW}</code> · <a href="#" id="demoReset">Reiniciar la demo</a>`;
  document.body.appendChild(b);
  $('#demoReset').onclick = async (e) => {
    e.preventDefault();
    try {
      const r = await navigator.storage.getDirectory();
      await r.removeEntry('ganttcrew-demo', { recursive: true });
    } catch (x) {}
    location.hash = '';
    location.reload();
  };
}
async function init() {
  readHash();
  render();
  if (DEMO === true && !window.__testDirP && navigator.storage?.getDirectory) {
    window.__testDirP = navigator.storage
      .getDirectory()
      .then((r) => r.getDirectoryHandle('ganttcrew-demo', { create: true }));
    demoBar();
  }
  if (!window.showDirectoryPicker && !window.__testDirP)
    return gate(
      `<h2>Abre la herramienta con Edge o Chrome</h2><p class="hint">Este navegador no permite a la página leer y guardar en la carpeta compartida. Abre <b>este mismo archivo</b> con <b>Microsoft Edge</b> o <b>Google Chrome</b> (clic derecho → Abrir con).</p>`,
    );
  if (window.__testDirP) {
    dirH = await window.__testDirP;
    return afterFolder();
  }
  const saved = await kvGet('dir');
  if (saved) {
    dirH = saved;
    let p = 'prompt';
    try {
      p = await saved.queryPermission({ mode: 'readwrite' });
    } catch (e) {}
    if (p === 'granted') return afterFolder();
    return (
      gate(
        `<h2>Control de proyectos</h2><p class="hint">Carpeta de datos: <b>${esc(saved.name)}</b></p><button class="btn pri" id="gGo" style="width:100%;padding:9px">Abrir</button><p class="hint" style="margin-top:12px">El navegador te pedirá permiso para usar la carpeta. <a href="#" id="gOther">Elegir otra carpeta</a></p>`,
      ),
      ($('#gGo').onclick = async () => {
        try {
          if ((await saved.requestPermission({ mode: 'readwrite' })) === 'granted') afterFolder();
        } catch (e) {
          pickFolder();
        }
      }),
      ($('#gOther').onclick = (e) => {
        e.preventDefault();
        pickFolder();
      })
    );
  }
  gate(
    `<h2>Control de proyectos</h2><p class="hint">Elige la carpeta <b>datos</b> que está junto a este archivo, dentro de la carpeta compartida de OneDrive. Solo se pide la primera vez.</p><button class="btn pri" id="gPick" style="width:100%;padding:9px">Elegir carpeta de datos</button>`,
  );
  $('#gPick').onclick = pickFolder;
}
async function pickFolder() {
  try {
    dirH = await window.showDirectoryPicker({ id: 'gantt-datos', mode: 'readwrite' });
  } catch (e) {
    return;
  }
  await kvSet('dir', dirH);
  afterFolder();
}
async function afterFolder() {
  try {
    await readDir();
  } catch (e) {
    return gate(
      `<h2>No se puede leer la carpeta</h2><p class="hint">${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Reintentar</button>`,
    );
  }
  if (!FILES[PMFILE]) return showNewTeam();
  rebuild();
  showWho();
}
function showNewTeam() {
  gate(`<h2>Carpeta vacía: crear el equipo</h2><p class="hint">En <b>${esc(dirH.name)}</b> todavía no hay datos. Si eres el project manager, crea el equipo aquí. Si no, pide al PM que lo cree y sincroniza la carpeta.</p>
  <form id="nf"><label>Tu nombre<input type="text" id="nN" required placeholder="p. ej. Ana"></label>
  <label>Contraseña de project manager<input type="password" id="nP" required minlength="8" autocomplete="new-password"></label>
  <label>Repítela<input type="password" id="nP2" required autocomplete="new-password"></label>
  <label style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="nS" checked style="width:auto"> Cargar los datos de ejemplo</label>
  <div class="hint" style="margin:-4px 0 10px">La contraseña protege tu papel de PM y cifra las evaluaciones. <b>Guárdala bien:</b> si la pierdes, las evaluaciones no se pueden recuperar.</div>
  <div id="nMsg" class="lmsg"></div><button class="btn pri" style="width:100%;padding:9px">Crear equipo</button></form>`);
  if (DEMO === true) {
    $('#nN').value = 'Ana';
    $('#nP').value = $('#nP2').value = DEMO_PW;
    setTimeout(() => $('#nf').requestSubmit(), 300);
  }
  $('#nf').onsubmit = async (e) => {
    e.preventDefault();
    const pw = $('#nP').value;
    if (pw.length < 8 || pw !== $('#nP2').value) {
      $('#nMsg').textContent = 'La contraseña debe tener 8 caracteres o más y coincidir.';
      return;
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pw, salt);
    const u = stamp(),
      R = (o) => ({ ...o, _u: u, _by: 'pm' });
    const recs = {
      projects: {},
      members: {},
      config: {},
      holidays: {},
      tasks: {},
      meetings: {},
      absences: {},
    };
    recs.members.pm = R({
      name: $('#nN').value.trim() || 'Project manager',
      role: 'Project manager',
      color: '#2f5bea',
      isPM: true,
      hoursPerDay: 8,
    });
    recs.config.settings = R({
      weights: { plazo: 30, calidad: 40, alcance: 20, retrabajo: 10 },
      centers: DEFAULT_CENTERS,
      calV: 2,
    });
    for (const h of DEFAULT_HOLIDAYS) recs.holidays[h.id] = R(clean(h));
    let ev = {};
    if ($('#nS').checked) {
      const SAMPLE = sampleData(LANG);
      for (const c of ['projects', 'members', 'tasks', 'meetings', 'absences'])
        for (const r of SAMPLE[c] || []) recs[c][r.id] = R(r.doc);
      ev = SAMPLE.evals || {};
    }
    const doc = {
      app: APPID,
      version: 1,
      owner: 'pm',
      crypto: { salt: b64(salt), check: await enc(key, 'gantt-ok') },
      records: recs,
    };
    const h = await dirH.getFileHandle(PMFILE, { create: true });
    const w = await h.createWritable();
    await w.write(JSON.stringify(doc));
    await w.close();
    EVKEY = key;
    EVDATA = ev;
    await writeEvals();
    await readDir();
    ME.memberId = 'pm';
    ME.owner = true;
    try {
      localStorage.setItem(meKey(), 'pm');
    } catch (e) {}
    await loadEvals();
    await loadPriv();
    rebuild();
    startApp();
  };
}
function showWho() {
  const ms = members();
  let last = null;
  try {
    last = localStorage.getItem(meKey());
  } catch (e) {}
  if (last && S.members[last] && !S.members[last].isPM) {
    ME.memberId = last;
    ME.owner = false;
    return startApp();
  }
  gate(
    `<h2>¿Quién eres?</h2><p class="hint">Elige tu nombre. El project manager necesita su contraseña.</p><div style="display:flex;flex-direction:column;gap:6px;margin:12px 0">${ms.map((m) => `<button class="btn" data-me="${m.id}" style="text-align:left;display:flex;gap:8px;align-items:center">${who(m.id)}<span class="mut">${esc(m.role || '')}</span>${m.isPM ? '<span class="tag lv3">PM</span>' : ''}</button>`).join('')}</div><div id="wPw" style="display:none"><label>Contraseña de PM<input type="password" id="wP" autocomplete="current-password"></label><div id="wMsg" class="lmsg"></div><button class="btn pri" id="wGo" style="width:100%;padding:9px">Entrar</button></div><p class="hint">¿No apareces? Pide al PM que te añada al equipo.</p>`,
  );
  $('#gate')
    .querySelectorAll('[data-me]')
    .forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.me;
          if (!S.members[id]?.isPM) {
            ME.memberId = id;
            ME.owner = false;
            try {
              localStorage.setItem(meKey(), id);
            } catch (e) {}
            return startApp();
          }
          $('#wPw').style.display = '';
          $('#wP').focus();
          const go = async () => {
            $('#wGo').disabled = true;
            const ok = await unlockPM($('#wP').value);
            $('#wGo').disabled = false;
            if (!ok) {
              $('#wMsg').textContent = 'Contraseña incorrecta.';
              return;
            }
            ME.memberId = id;
            ME.owner = true;
            try {
              localStorage.setItem(meKey(), id);
            } catch (e) {}
            startApp();
          };
          $('#wGo').onclick = go;
          $('#wP').onkeydown = (e) => {
            if (e.key === 'Enter') go();
          };
        }),
    );
}
function startApp() {
  MINE = null;
  hideGate();
  started = true;
  mode = 'live';
  rebuild();
  banner();
  render();
  setTimeout(
    () => {
      try {
        alertToast();
        renderBell();
      } catch (e) {}
    },
    ME.owner ? 4500 : 800,
  );
  if (ME.owner) {
    migratePauses()
      .catch((e) => console.warn(e))
      .then(migrateCalendar)
      .then(() => {
        const g = holidayGaps();
        if (g.length)
          toast(
            'Faltan festivos oficiales (' +
              g
                .map((x) => x.y)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ') +
              '). Revísalo en la pestaña Ausencias.',
          );
      });
  }
}
async function migratePauses() {
  const tItems = {},
    pItems = [];
  const T = (id) => tItems[id] || (tItems[id] = { ...S.tasks[id] });
  for (const p of arr('projects')) {
    if (p.status === 'paused' && Array.isArray(p.pausedTasks)) {
      const from = p.pausedAt || todayS(),
        grp = 'pg-' + newId(),
        ids = [];
      for (const id of p.pausedTasks) {
        const t = S.tasks[id];
        if (!t || t.status === 'done' || openEv(t)) continue;
        const x = T(id);
        x.hist = [...hist(x), { k: 'pause', from, to: '', why: '', grp }];
        ids.push(id);
      }
      const o = { ...p };
      delete o.id;
      o.hist = [
        ...(o.hist || []),
        ...(o.pauses || []).map((x) => ({ k: 'pause', from: x.from, to: x.to, why: '', tasks: [] })),
        { k: 'pause', from, to: '', why: '', grp, tasks: ids },
      ];
      delete o.pausedTasks;
      delete o.pausedAt;
      delete o.pauses;
      pItems.push([p.id, o]);
    } else if (p.status === 'cancelled' && p.cancelledAt && !(p.hist || []).length) {
      const from = p.cancelledAt,
        grp = 'pg-' + newId(),
        ids = [];
      for (const t of arr('tasks').filter((t) => t.projectId === p.id && t.status !== 'done' && !openEv(t))) {
        const x = T(t.id);
        x.hist = [...hist(x), { k: 'cancel', from, to: '', why: p.cancelReason || '', grp }];
        ids.push(t.id);
      }
      const o = { ...p };
      delete o.id;
      o.hist = [
        ...(o.pauses || []).map((x) => ({ k: 'pause', from: x.from, to: x.to, why: '', tasks: [] })),
        { k: 'cancel', from, to: '', why: p.cancelReason || '', grp, tasks: ids },
      ];
      delete o.pauses;
      delete o.cancelledAt;
      delete o.cancelReason;
      pItems.push([p.id, o]);
    } else if ((p.pauses || []).length && !(p.hist || []).length) {
      const o = { ...p };
      delete o.id;
      o.hist = o.pauses.map((x) => ({ k: 'pause', from: x.from, to: x.to, why: '', tasks: [] }));
      delete o.pauses;
      pItems.push([p.id, o]);
    }
  }
  const ti = Object.entries(tItems).map(([id, x]) => {
    delete x.id;
    return [id, x];
  });
  if (ti.length) await saveMany('tasks', ti);
  if (pItems.length) await saveMany('projects', pItems);
}
async function migrateCalendar() {
  const st = S.config.settings || {};
  if (st.calV >= 2) return;
  const byId = {};
  for (const h of DEFAULT_HOLIDAYS) byId[h.id] = h;
  const items = [];
  for (const [id, h] of Object.entries(S.holidays)) {
    const d = byId[id];
    if (d && (h.scope !== d.scope || (d.municipality && h.municipality !== d.municipality)))
      items.push([id, { ...h, scope: d.scope, municipality: d.municipality || h.municipality || '' }]);
  }
  if (items.length) await saveMany('holidays', items);
  await save('config', 'settings', { ...(S.config.settings || {}), centers: centers(), calV: 2 });
  if (items.length)
    toast(`Calendario actualizado: ${items.length} festivos reclasificados (nacional / autonómico / local).`);
}

/* ---------- copia de seguridad (solo PM) ---------- */
function exportBackup() {
  const out = { app: APPID, kind: 'backup', exportedAt: new Date().toISOString(), tables: {} };
  for (const c of COLSALL)
    out.tables[c] = Object.entries(S[c])
      .filter(([, doc]) => !doc.priv)
      .map(([id, doc]) => ({ id, doc }));
  if (EVKEY) out.private = PRDATA;
  out.tables.evals = Object.entries(S.evals).map(([id, doc]) => ({ id, doc }));
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `copia-gantt-${todayS()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  toast('Copia descargada. Guárdala fuera de la carpeta de datos.');
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!j.tables) throw new Error('El archivo no es una copia de esta herramienta.');
    const doc = myRecords();
    const u = stamp();
    for (const c of COLSALL) {
      doc.records[c] = doc.records[c] || {};
      for (const r of j.tables[c] || []) doc.records[c][r.id] = { ...r.doc, _u: u, _by: 'pm' };
    }
    for (const c of COLSALL)
      for (const [id, r] of Object.entries(doc.records[c])) if (r.priv) delete doc.records[c][id];
    await writeMine();
    if (j.private && EVKEY) {
      PRDATA = {
        projects: { ...PRDATA.projects, ...(j.private.projects || {}) },
        tasks: { ...PRDATA.tasks, ...(j.private.tasks || {}) },
        settings: { ...PRDATA.settings, ...(j.private.settings || {}) },
      };
      await writePriv();
    }
    if (j.tables.evals) {
      for (const r of j.tables.evals) EVDATA[r.id] = r.doc;
      await writeEvals();
    }
    rebuild();
    render();
    toast('Copia restaurada.');
  } catch (e) {
    toast('No se pudo restaurar: ' + (e.message || e));
  }
}
