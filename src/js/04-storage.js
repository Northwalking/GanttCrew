/* ---------- identidad y permisos ---------- */
// Sin servidor: cada persona escribe SOLO en su propio archivo de la carpeta compartida y la
// aplicación fusiona todos al leer. Las reglas de abajo deciden qué cambios de cada archivo se
// aceptan. Las evaluaciones van cifradas con la contraseña del project manager.
const myMemberId = () => ME.memberId;
const canEditTask = (t) => ME.owner || (!!ME.memberId && t?.assigneeId === ME.memberId);
// Planning (creating tasks, planned dates, dedication, dependencies, pauses) is the PM's job;
// members report on their own tasks: status, progress, hours remaining, actual dates.
const canPlan = () => ME.owner;
const canCreateTask = () => canPlan();
const PLAN_FIELDS = [
  'name',
  'projectId',
  'assigneeId',
  'origin',
  'priority',
  'detectedBy',
  'detectedOn',
  'description',
  'deps',
  'start',
  'end',
  'dedication',
  'estimatedHours',
  'forceStart',
  'hist',
];
const canEditMeeting = (m) => ME.owner || (!!ME.memberId && (!m || m.createdBy === ME.memberId));
function meBox() {
  const b = $('#me');
  if (!b) return;
  if (!started) {
    b.innerHTML = '';
    return;
  }
  const ago = lastSync ? Math.round((Date.now() - lastSync) / 1000) : null;
  b.innerHTML = `${who(ME.memberId)}${ME.owner ? ' <span class="tag lv3">PM</span>' : ''}<span class="mut" title="Carpeta: ${esc(dirH?.name || '')}" style="font-size:11.5px">${ago == null ? '' : ago < 60 ? 'leído hace ' + ago + ' s' : 'leído hace ' + Math.round(ago / 60) + ' min'}</span><button class="btn sm bell" id="bellBtn"></button><button class="btn sm" id="syncBtn" title="Volver a leer la carpeta">↻</button><button class="btn sm" id="outBtn" title="Cambiar de usuario">Cambiar</button>`;
  $('#syncBtn').onclick = () => refresh(true);
  $('#bellBtn').onclick = openAlerts;
  try {
    renderBell();
  } catch (e) {}
  $('#outBtn').onclick = () => {
    try {
      localStorage.removeItem(meKey());
    } catch (e) {}
    location.reload();
  };
}

/* ---------- archivos de la carpeta compartida ---------- */
const APPID = 'gantt-equipo',
  PMFILE = 'equipo-pm.json',
  EVFILE = 'evaluaciones-cifradas.json',
  PRFILE = 'privado-pm.json';
const SINGLE = ['projects', 'members', 'config', 'holidays']; // solo el PM
const COLSALL = ['projects', 'members', 'config', 'holidays', 'tasks', 'meetings', 'absences', 'extras'];
let PRDATA = { projects: {}, tasks: {}, settings: {} },
  dirH = null,
  FILES = {},
  MINE = null,
  lastSync = 0,
  EVKEY = null,
  EVDATA = {},
  writeQ = Promise.resolve(),
  badFiles = [];
const myFileName = () => (ME.owner ? PMFILE : `miembro-${ME.memberId}.json`);
// 'pm' marks the project manager's file (a role, not a person). A former PM whose member id is
// literally "pm" writes their member file as "member:pm", so it is never taken for the PM file.
const writerId = () => (ME.owner ? 'pm' : ME.memberId === 'pm' ? 'member:pm' : ME.memberId);
const meKey = () => 'gantt.me.' + (dirH?.name || '');
function newId() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function clean(d) {
  const o = { ...d };
  delete o.id;
  delete o._u;
  delete o._by;
  delete o._del;
  return o;
}
function dbErr(e) {
  toast(
    'No se pudo guardar en la carpeta: ' +
      (e?.message || e) +
      '. Comprueba que OneDrive está sincronizando y vuelve a intentarlo.',
  );
}

// IndexedDB: recordar la carpeta elegida entre sesiones
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('gantt-equipo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) {
  try {
    const d = await idb();
    return await new Promise((r) => {
      const q = d.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => r(q.result);
      q.onerror = () => r(null);
    });
  } catch (e) {
    return null;
  }
}
async function kvSet(k, v) {
  try {
    const d = await idb();
    await new Promise((r) => {
      const t = d.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = r;
      t.onerror = r;
    });
  } catch (e) {}
}

async function readDir() {
  const seen = {};
  let changed = false;
  badFiles = [];
  for await (const [name, h] of dirH.entries()) {
    if (h.kind !== 'file') continue;
    const isTB = /^thunderbird-.*\.ics$/i.test(name);
    if (!isTB && !/\.json$/i.test(name)) continue;
    const f = await h.getFile();
    seen[name] = 1;
    const prev = FILES[name];
    if (prev && prev.lastModified === f.lastModified && prev.size === f.size) continue;
    if (isTB) {
      try {
        const t = await f.text();
        FILES[name] = { lastModified: f.lastModified, size: f.size, ics: t, events: parseICS(t) };
        changed = true;
      } catch (e) {
        badFiles.push(name);
      }
      continue;
    }
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== APPID) continue;
      FILES[name] = { lastModified: f.lastModified, size: f.size, data: j };
      changed = true;
    } catch (e) {
      badFiles.push(name);
    } // p. ej. OneDrive escribiéndolo justo ahora: se reintenta en la próxima lectura
  }
  for (const n of Object.keys(FILES))
    if (!seen[n]) {
      delete FILES[n];
      changed = true;
    }
  lastSync = Date.now();
  return changed;
}
// Fusión: para cada elemento gana la versión más reciente entre las que tienen derecho a escribirlo.
function rebuild() {
  const pm = Object.values(FILES)
    .filter((f) => f.data && f.data.owner === 'pm')
    .map((f) => f.data);
  const others = Object.values(FILES)
    .filter((f) => f.data && f.data.owner && f.data.owner !== 'pm')
    .map((f) => f.data);
  const newer = (a, b) => !b || a._u > b._u || (a._u === b._u && String(a._by) > String(b._by));
  const out = {};
  for (const c of COLSALL) out[c] = {};
  const pmRec = {};
  for (const c of COLSALL) {
    pmRec[c] = {};
    for (const f of pm)
      for (const [id, r] of Object.entries(f.records?.[c] || {}))
        if (newer(r, pmRec[c][id])) pmRec[c][id] = r;
  }
  const ownerField = { tasks: 'assigneeId', absences: 'memberId', meetings: 'createdBy', extras: 'memberId' };
  for (const c of COLSALL) {
    const best = { ...pmRec[c] };
    if (!SINGLE.includes(c))
      for (const f of others) {
        const w = String(f.owner).replace(/^member:/, '');
        for (const [id, r] of Object.entries(f.records?.[c] || {})) {
          const k = ownerField[c],
            p = pmRec[c][id];
          if (r[k] !== w) continue; // solo puede escribir lo suyo
          if (p && p[k] !== w) continue; // el PM lo asignó o reasignó a otra persona
          if (newer(r, best[id])) best[id] = r;
        }
      }
    for (const [id, r] of Object.entries(best)) if (!r._del) out[c][id] = clean(r);
  }
  mergeThunderbird(out.meetings);
  if (ME.owner && EVKEY && UI.showPriv !== false)
    for (const c of ['projects', 'tasks'])
      for (const [id, r] of Object.entries(PRDATA[c] || {}))
        if (!r._del) out[c][id] = { ...clean(r), priv: true };
  for (const c of COLSALL) S[c] = out[c];
  expandSeries(S.meetings);
  S.evals = EVDATA;
  resetCal();
  scheduleICS();
  const m = S.members[ME.memberId];
  if (started && !m) {
    toast('Tu ficha ya no está en el equipo.');
  }
}
function myRecords() {
  if (!MINE) {
    const f = FILES[myFileName()]?.data;
    MINE = f ? JSON.parse(JSON.stringify(f)) : { app: APPID, version: 1, owner: writerId(), records: {} };
    if (ME.owner && !MINE.crypto && FILES[PMFILE]?.data.crypto) MINE.crypto = FILES[PMFILE].data.crypto;
  }
  return MINE;
}
function writeMine() {
  const doc = myRecords();
  doc.updatedAt = new Date().toISOString();
  doc.owner = writerId();
  const text = JSON.stringify(doc);
  writeQ = writeQ
    .then(async () => {
      const h = await dirH.getFileHandle(myFileName(), { create: true });
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      const f = await h.getFile();
      FILES[myFileName()] = { lastModified: f.lastModified, size: f.size, data: JSON.parse(text) };
    })
    .catch((e) => dbErr(e));
  return writeQ;
}
function stamp() {
  return (
    new Date().toISOString().replace('Z', '') +
    String(Math.floor(Math.random() * 1000)).padStart(3, '0') +
    'Z'
  );
}
async function putRecord(col, id, data, del = false) {
  const c = col === 'settings' ? 'config' : col;
  const doc = myRecords();
  doc.records[c] = doc.records[c] || {};
  doc.records[c][id] = del
    ? { ...(S[c][id] || {}), _del: true, _u: stamp(), _by: writerId() }
    : { ...clean(data), _u: stamp(), _by: writerId() };
  await writeMine();
  rebuild();
  render();
}
async function saveMany(col, items) {
  // items: [[id,data]]
  if (ME.owner && (col === 'projects' || col === 'tasks')) {
    const pv = items.filter(
      ([id, d]) => isPrivRec(col, id) || (col === 'tasks' && S.projects[d.projectId]?.priv),
    );
    if (pv.length) {
      for (const [id, d] of pv) {
        const x = clean(d);
        delete x.priv;
        PRDATA[col][id] = { ...x, _u: stamp() };
      }
      await writePriv();
      items = items.filter((it) => !pv.includes(it));
      if (!items.length) {
        rebuild();
        render();
        return;
      }
    }
  }
  const c = col === 'settings' ? 'config' : col;
  const doc = myRecords();
  doc.records[c] = doc.records[c] || {};
  for (const [id, data] of items) doc.records[c][id] = { ...clean(data), _u: stamp(), _by: writerId() };
  await writeMine();
  rebuild();
  render();
}
async function savePrivRoute(col, id, data) {
  // true = gestionado aquí
  if (!ME.owner || (col !== 'projects' && col !== 'tasks')) return false;
  const wantPriv =
    col === 'projects'
      ? !!data.priv
      : !!(S.projects[data.projectId]?.priv || isPrivRec('projects', data.projectId));
  const wasPriv = isPrivRec(col, id);
  if (!wantPriv && !wasPriv) return false;
  if (wantPriv) {
    const d = clean(data);
    delete d.priv;
    PRDATA[col][id] = { ...d, _u: stamp() };
    if (!wasPriv && S[col][id]) await putRecord(col, id, null, true);
    await writePriv();
    rebuild();
    render();
    return true;
  }
  delete PRDATA[col][id];
  await writePriv();
  const d = { ...data };
  delete d.priv;
  await putRecord(col, id, d);
  return true;
}
async function save(col, id, data) {
  id = id || newId();
  if (await savePrivRoute(col, id, data || {})) return id;
  if (col === 'evals') {
    EVDATA = { ...EVDATA, [id]: clean(data) };
    await writeEvals();
    S.evals = EVDATA;
    render();
    return id;
  }
  if (col === 'meetings')
    data = { ...data, createdBy: S.meetings[id]?.createdBy || data.createdBy || ME.memberId };
  if (SINGLE.includes(col) && !ME.owner) {
    toast('Solo el project manager puede cambiar esto.');
    return null;
  }
  await putRecord(col, id, data);
  return id;
}
async function del(col, id) {
  if (ME.owner && (col === 'projects' || col === 'tasks') && isPrivRec(col, id)) {
    delete PRDATA[col][id];
    await writePriv();
    rebuild();
    render();
    return true;
  }
  if (col === 'evals') {
    const e = { ...EVDATA };
    delete e[id];
    EVDATA = e;
    await writeEvals();
    S.evals = EVDATA;
    render();
    return true;
  }
  await putRecord(col, id, null, true);
  return true;
}
const saveTask = (id, data) => save('tasks', id, data);
async function delTask(id) {
  if ((await del('tasks', id)) && ME.owner && S.evals[id]) await del('evals', id);
}

/* ---------- cifrado de evaluaciones (AES-GCM, clave derivada de la contraseña del PM) ---------- */
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    k,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function enc(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(obj)),
  );
  return { iv: b64(iv), ct: b64(ct) };
}
async function dec(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(box.iv) }, key, ub64(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function unlockPM(pw) {
  const c = FILES[PMFILE]?.data.crypto;
  if (!c) return false;
  const key = await deriveKey(pw, ub64(c.salt));
  try {
    const v = await dec(key, c.check);
    if (v !== 'gantt-ok') return false;
  } catch (e) {
    return false;
  }
  EVKEY = key;
  await loadEvals();
  await loadPriv();
  return true;
}
async function loadEvals() {
  EVDATA = {};
  const f = FILES[EVFILE]?.data;
  if (f && EVKEY) {
    try {
      EVDATA = (await dec(EVKEY, f.box)) || {};
    } catch (e) {
      toast('No se pudieron descifrar las evaluaciones.');
    }
  }
}
async function loadPriv() {
  PRDATA = { projects: {}, tasks: {}, settings: {} };
  const f = FILES[PRFILE]?.data;
  if (f && EVKEY) {
    try {
      const d = (await dec(EVKEY, f.box)) || {};
      PRDATA = { projects: d.projects || {}, tasks: d.tasks || {}, settings: d.settings || {} };
    } catch (e) {
      toast('No se pudieron descifrar los proyectos privados.');
    }
  }
}
async function writePriv() {
  if (!EVKEY) {
    toast('Introduce la contraseña de PM para guardar lo privado.');
    return;
  }
  const box = await enc(EVKEY, PRDATA);
  const text = JSON.stringify({
    app: APPID,
    version: 1,
    kind: 'private',
    box,
    updatedAt: new Date().toISOString(),
  });
  writeQ = writeQ
    .then(async () => {
      const h = await dirH.getFileHandle(PRFILE, { create: true });
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      const f = await h.getFile();
      FILES[PRFILE] = { lastModified: f.lastModified, size: f.size, data: JSON.parse(text) };
    })
    .catch((e) => dbErr(e));
  return writeQ;
}
const isPrivRec = (c, id) => !!(PRDATA[c] && PRDATA[c][id] && !PRDATA[c][id]._del);
const privH = () => +PRDATA.settings?.hoursPerDay || 2;
async function writeEvals() {
  if (!EVKEY) {
    toast('Introduce la contraseña de PM para guardar evaluaciones.');
    return;
  }
  const box = await enc(EVKEY, EVDATA);
  const text = JSON.stringify({
    app: APPID,
    version: 1,
    kind: 'evals',
    box,
    updatedAt: new Date().toISOString(),
  });
  writeQ = writeQ
    .then(async () => {
      const h = await dirH.getFileHandle(EVFILE, { create: true });
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      const f = await h.getFile();
      FILES[EVFILE] = { lastModified: f.lastModified, size: f.size, data: JSON.parse(text) };
    })
    .catch((e) => dbErr(e));
  return writeQ;
}
