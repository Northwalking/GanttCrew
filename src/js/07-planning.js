/* ---------- dependencias ---------- */
const preds = (t) => (t.deps || []).map(tk).filter(Boolean);
const blockers = (t) => preds(t).filter((p) => p.status !== 'done' && inact(p) !== 'cancelled');
const depBlocked = (t) => t.status !== 'done' && !inact(t) && !t.forceStart && blockers(t).length > 0;
const successors = (id) => arr('tasks').filter((t) => (t.deps || []).includes(id));
const blocking = (t) => (t.status === 'done' ? [] : successors(t.id).filter((s) => s.status !== 'done'));
function dateConflict(t) {
  const ps = preds(t);
  if (!ps.length || !t.start) return null;
  const mx = Math.max(...ps.map((p) => dn(p.end)));
  return dn(t.start) <= mx ? iso(mx + 1) : null;
}
function reaches(from, target, seen = new Set()) {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (S.tasks[from]?.deps || []).some((d) => reaches(d, target, seen));
}

/* ---------- fecha de finalización prevista ---------- */
// Simulación día a día desde hoy. Para cada persona: horas disponibles del día (jornada × disponibilidad,
// 0 en fines de semana, festivos de su centro y ausencias completas) menos sus reuniones. Ese tiempo se
// reparte entre sus tareas activas: primero las de prioridad alta, luego media y baja; dentro de cada
// prioridad, en proporción a la dedicación. Una tarea nunca avanza más rápido que su dedicación.
// Una tarea con dependencias empieza el día siguiente a la fecha PREVISTA de fin de la anterior.
const PRI = { alta: 0, media: 1, baja: 2 };
function estHours(t) {
  if (+t.estimatedHours > 0) return +t.estimatedHours;
  const s = dn(t.start),
    e = dn(t.end);
  if (s == null || e == null || !t.assigneeId) return 0;
  let n = 0;
  for (let d = s; d <= e; d++) if (isRegM(t.assigneeId, d)) n++;
  return ((capOf(t.assigneeId) * (t.dedication ?? 100)) / 100) * Math.max(1, n);
}
function remHours(t) {
  if (t.status === 'done') return 0;
  if (t.remainingHours != null && t.remainingHours !== '') return Math.max(0, +t.remainingHours);
  return estHours(t) * (1 - (t.progress || 0) / 100);
}
let _fc = null;
function forecasts(override) {
  if (_fc && !override) return _fc;
  const T = todayN(),
    HZ = T + 730,
    res = {};
  const all = arr('tasks').map((t) => (override && t.id === override.id ? { ...override } : t));
  if (override && !all.some((t) => t.id === override.id)) all.push({ ...override });
  const st = {};
  for (const t of all) {
    if (t.status === 'done') {
      res[t.id] = { end: dn(t.realEnd) ?? dn(t.end), done: true };
      continue;
    }
    {
      const ia = inact(t);
      if (ia) {
        res[t.id] = {
          end: null,
          inactive: ia,
          why: ia === 'paused' ? 'tarea en pausa' : 'proyecto cancelado',
        };
        continue;
      }
    }
    if (!t.assigneeId || dn(t.start) == null || dn(t.end) == null) {
      res[t.id] = { end: null, why: 'sin responsable o sin fechas' };
      continue;
    }
    const rem = remHours(t);
    const pv = !!(t.priv || S.projects[t.projectId]?.priv);
    st[t.id] = {
      t,
      mid: pv ? '__priv' : t.assigneeId,
      rem,
      pace: ((pv ? privH() : capOf(t.assigneeId)) * (t.dedication ?? 100)) / 100,
      pri: PRI[t.priority] ?? 1,
      ps: Math.max(dn(t.start), T),
      first: null,
      hol: 0,
      abs: 0,
      ovl: 0,
      meet: 0,
      wait: 0,
    };
    if (rem <= 1e-6) res[t.id] = { end: Math.max(T - 1, dn(t.start)), noRem: true };
  }
  const meetH = {};
  for (const m of arr('meetings')) {
    const d = dn(m.date);
    if (d == null || d < T || d > HZ || !m.duration) continue;
    for (const a of m.attendees || []) {
      if (!isWorkM(a, d)) continue;
      const k = a + '|' + d;
      meetH[k] = (meetH[k] || 0) + +m.duration / 60;
    }
  }
  const byMid = {};
  for (const x of Object.values(st)) if (!res[x.t.id]) (byMid[x.mid] = byMid[x.mid] || []).push(x);
  let pending = Object.values(byMid).reduce((a, l) => a + l.length, 0);
  const depsOk = (x, d) => {
    if (x.t.forceStart) return true;
    for (const p of x.t.deps || []) {
      const r = res[p];
      if (!r) {
        if (all.some((t) => t.id === p)) return false;
        continue;
      }
      if (r.inactive === 'cancelled') continue;
      if (r.end == null || r.end >= d) return false;
    }
    return true;
  };
  for (let d = T; d <= HZ && pending > 0; d++) {
    for (const [mid, list] of Object.entries(byMid)) {
      const PV = mid === '__priv';
      const cap = PV ? privH() : capOf(mid),
        EX = PV ? null : extraAt(mid, d),
        reg = PV ? true : isRegM(mid, d),
        work = reg || !!EX,
        av = PV ? cap : (reg ? cap * absAvail(absOn(mid, d)) : 0) + (EX ? EX.free : 0);
      let avail = Math.max(0, av - (meetH[mid + '|' + d] || 0));
      const act = [];
      for (const x of list) {
        if (res[x.t.id] || x.t.status === 'blocked' || d < x.ps) continue;
        if (!depsOk(x, d)) {
          if (isWork(d)) x.wait++;
          continue;
        }
        if (x.first == null) x.first = d;
        if (!PV && isWork(d)) {
          if (holOn(mid, d).length) x.hol++;
          else if (absOn(mid, d)) x.abs++;
          else if ((meetH[mid + '|' + d] || 0) > 0 && avail < x.pace) x.meet++;
        }
        act.push(x);
      }
      if (EX)
        for (const x of list) {
          const r = EX.byTask[x.t.id];
          if (!r || res[x.t.id] || x.t.status === 'blocked') continue;
          const hh = Math.min(r, x.rem);
          x.rem -= hh;
          if (x.rem <= 1e-6) {
            res[x.t.id] = { end: d };
            pending--;
          }
        }
      for (let i = act.length - 1; i >= 0; i--) if (res[act[i].t.id]) act.splice(i, 1);
      if (!act.length) continue;
      for (const p of [0, 1, 2]) {
        const g = act.filter((x) => x.pri === p);
        if (!g.length) continue;
        const dem = g.reduce((a, x) => a + x.pace, 0);
        const give = Math.min(avail, dem);
        for (const x of g) {
          const h = dem > 0 ? (give * x.pace) / dem : 0;
          if (work && (PV || (!holOn(mid, d).length && !absOn(mid, d))) && h < x.pace - 1e-6) x.ovl++;
          x.rem -= h;
          if (x.rem <= 1e-6) {
            res[x.t.id] = { end: d };
            pending--;
          }
        }
        avail -= give;
      }
    }
  }
  for (const x of Object.values(st)) {
    const r =
      res[x.t.id] ||
      (res[x.t.id] = {
        end: null,
        why:
          x.t.status === 'blocked' ? 'bloqueada' : 'más de 2 años o esperando a una tarea sin fecha prevista',
      });
    if (r.done || r.noRem) continue;
    const pe = dn(x.t.end),
      mid = x.mid;
    r.planned = pe;
    r.remaining = Math.round(x.rem > 0 ? x.rem : 0);
    r.hours = Math.round(remHours(x.t));
    if (r.end != null) {
      r.slip =
        mid === '__priv'
          ? r.end - pe
          : r.end > pe
            ? workDays(mid, pe + 1, r.end)
            : r.end < pe
              ? -workDays(mid, r.end + 1, pe)
              : 0;
    }
    const why = [];
    if (x.wait) why.push(`espera a dependencias (${x.wait} día${x.wait > 1 ? 's' : ''} lab.)`);
    if (x.hol) why.push(`${x.hol} festivo${x.hol > 1 ? 's' : ''}`);
    if (x.abs) why.push(`${x.abs} día${x.abs > 1 ? 's' : ''} de ausencia`);
    if (x.ovl) why.push(`sobrecarga o prioridad de otras tareas (${x.ovl} día${x.ovl > 1 ? 's' : ''})`);
    if (x.meet) why.push(`reuniones (${x.meet} día${x.meet > 1 ? 's' : ''})`);
    if (dn(x.t.start) < todayN() && (x.t.progress || 0) === 0) why.push('aún sin empezar');
    r.reasons = why;
  }
  if (!override) _fc = res;
  return res;
}
const fcOf = (t) => forecasts()[t.id] || {};
function fcTag(t) {
  const f = fcOf(t);
  if (t.status === 'done' || f.noRem) return '';
  if (f.inactive) return `<span class="tag mut">${f.inactive === 'paused' ? 'en pausa' : 'cancelada'}</span>`;
  if (f.end == null) return `<span class="tag mut" title="${esc(f.why || '')}">sin previsión</span>`;
  if (f.slip > 0)
    return `<span class="tag bad" title="${esc((f.reasons || []).join(' · '))}">${fmt(iso(f.end))} · +${f.slip} d</span>`;
  if (f.slip < 0)
    return `<span class="tag ok" title="Termina antes de lo planificado">${fmt(iso(f.end))} · ${f.slip} d</span>`;
  return `<span class="tag ok">${fmt(iso(f.end))}</span>`;
}

/* ---------- cumplimiento ---------- */
function rubric() {
  const r = S.config.settings?.rubric;
  return [0, 1, 2, 3, 4].map((i) => (r && r[i]) || RUBRIC[i]);
}
/* ---------- carga de trabajo ---------- */
const capOf = (mid) => +S.members[mid]?.hoursPerDay || 8;
const isWork = (d) => {
  const w = dow(d);
  return w !== 0 && w !== 6;
};
/* ---------- ausencias y festivos ---------- */
const ABS = {
  vac: { t: 'Vacaciones', a: 0, c: '#667085' },
  perm: { t: 'Ausencia con permiso', a: 0, c: '#667085' },
  baja: { t: 'Baja médica', a: 0, c: '#667085' },
  viaje: { t: 'Viaje de proyecto', a: 50, c: '#1570ef' },
  congreso: { t: 'Congreso / formación', a: 0, c: '#6941c6' },
  otra: { t: 'Otra ausencia', a: 0, c: '#667085' },
};
const HSCOPE = {
  nacional: 'Nacional',
  comunidad: 'Autonómico (Comunidad de Madrid)',
  local: 'Local (municipio)',
  empresa: 'Empresa / centro',
};
// Centros de trabajo: cada uno con su municipio (por ahora, todos en la Comunidad de Madrid).
const DEFAULT_CENTERS = [
  { id: 'madrid', name: 'Madrid capital', municipality: 'Madrid', region: 'Comunidad de Madrid' },
];
const centers = () => {
  const c = S.config?.settings?.centers;
  return Array.isArray(c) && c.length ? c : DEFAULT_CENTERS;
};
const norm = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
const centerOf = (mid) => {
  const cs = centers();
  return cs.find((c) => c.id === S.members[mid]?.centerId) || cs[0];
};
const holMuni = (h) => h.municipality || (h.scope === 'local' ? 'Madrid' : ''); // festivos antiguos sin municipio = Madrid
function holApplies(h, mid) {
  if ((h.memberIds || []).length) return !!mid && h.memberIds.includes(mid); // excepción por personas
  if (!mid) return true;
  const c = centerOf(mid);
  if (h.scope === 'local') return norm(holMuni(h)) === norm(c.municipality);
  if (h.scope === 'empresa' && (h.centerIds || []).length) return h.centerIds.includes(c.id);
  if (h.scope === 'comunidad') return !h.region || norm(h.region) === norm(c.region || 'Comunidad de Madrid');
  return true;
}
const holScopeLabel = (h) =>
  h.scope === 'local'
    ? `Local · ${holMuni(h)}`
    : h.scope === 'empresa' && (h.centerIds || []).length
      ? `Centro · ${(h.centerIds || []).map((i) => centers().find((c) => c.id === i)?.name || i).join(', ')}`
      : HSCOPE[h.scope] || h.scope || '';
let _hol = null,
  _abs = null,
  _ext = null;
const resetCal = () => {
  _hol = null;
  _abs = null;
  _ext = null;
  _fc = null;
};
function holIdx() {
  if (_hol) return _hol;
  _hol = {};
  for (const h of arr('holidays')) {
    const d = dn(h.date);
    if (d != null) (_hol[d] = _hol[d] || []).push(h);
  }
  return _hol;
}
const holOn = (mid, d) => (holIdx()[d] || []).filter((h) => holApplies(h, mid));
const holAll = (d) => {
  const ms = Object.keys(S.members || {});
  return (holIdx()[d] || []).filter((h) =>
    ms.length ? ms.every((m) => holApplies(h, m)) : !(h.memberIds || []).length,
  );
};
function absIdx() {
  if (_abs) return _abs;
  _abs = {};
  for (const a of arr('absences')) {
    const s = dn(a.start),
      e = dn(a.end);
    if (s == null || e == null) continue;
    (_abs[a.memberId] = _abs[a.memberId] || []).push({ ...a, s, e });
  }
  return _abs;
}
const absOf = (mid) => absIdx()[mid] || [];
const absOn = (mid, d) => absOf(mid).find((a) => a.s <= d && a.e >= d);
// absence by hours (one day, fromTime–toTime): the hours away are taken off that person's working day
const absHours = (a) =>
  a && a.fromTime && a.toTime ? Math.max(0, hm2min(a.toTime) - hm2min(a.fromTime)) / 60 : 0;
const absAvail = (a) =>
  !a
    ? 1
    : absHours(a)
      ? Math.max(0, 1 - absHours(a) / capOf(a.memberId))
      : Math.min(100, Math.max(0, +(a.availability ?? ABS[a.type]?.a ?? 0))) / 100;
// when it happens, as text: "13/11/2026 · 10:00–12:00" or "13/11/2026–17/11/2026"
const absWhen = (a) =>
  absHours(a)
    ? `${fmt(a.start)} · ${a.fromTime}–${a.toTime}`
    : a.start === a.end
      ? fmt(a.start)
      : `${fmt(a.start)}–${fmt(a.end)}`;
const absPrivate = (a) => a.type === 'baja' && !(ME.owner || a.memberId === ME.memberId);
const absLabel = (a) => (absPrivate(a) ? 'Ausente' : ABS[a.type]?.t || 'Ausencia');
const absOverlap = (mid, s, e) => absOf(mid).filter((a) => a.s <= e && a.e >= s);
const memDays = (mid) => {
  const w = S.members[mid]?.workDays;
  return Array.isArray(w) && w.length ? w : null;
};
const onSchedule = (mid, d) => {
  const lf = S.members[mid]?.leftOn;
  if (lf && d > dn(lf)) return false; // no longer in the team
  const w = memDays(mid);
  return !w || w.includes(dow(d));
};
const schedLbl = (mid) => {
  const w = memDays(mid);
  if (!w || [1, 2, 3, 4, 5].every((x) => w.includes(x))) return '';
  return [1, 2, 3, 4, 5]
    .filter((x) => w.includes(x))
    .map((x) => WDL[x - 1])
    .join('·');
};
function extIdx() {
  if (_ext) return _ext;
  _ext = {};
  for (const x of arr('extras')) {
    const d = dn(x.date);
    if (d == null || !(+x.hours > 0)) continue;
    const k = x.memberId + '|' + d;
    const e = _ext[k] || (_ext[k] = { h: 0, free: 0, byTask: {}, list: [] });
    e.h += +x.hours;
    e.list.push(x);
    if (x.taskId) e.byTask[x.taskId] = (e.byTask[x.taskId] || 0) + +x.hours;
    else e.free += +x.hours;
  }
  return _ext;
}
const extraAt = (mid, d) => extIdx()[mid + '|' + d] || null;
const isRegM = (mid, d) => isWork(d) && onSchedule(mid, d) && !holOn(mid, d).length;
const isWorkM = (mid, d) => isRegM(mid, d) || !!extraAt(mid, d);
function workDays(mid, s, e) {
  let c = 0;
  for (let d = s; d <= e; d++) if (isWorkM(mid, d)) c++;
  return c;
}
/* ---------- carga de trabajo ---------- */
// Horas previstas (tareas en días laborables del responsable + reuniones) frente a horas disponibles
// (jornada × disponibilidad: 0 en festivos, reducida en ausencias).
function addTaskLoad(h, s, e, t, cap) {
  if (inact(t) || t.priv || S.projects[t.projectId]?.priv) return;
  const a = dn(t.start),
    b = t.status === 'done' ? (dn(t.realEnd) ?? dn(t.end)) : dn(t.end);
  if (a == null || b == null) return;
  const ded = (t.dedication ?? 100) / 100;
  const gp = hist(t).length;
  for (let d = Math.max(a, s); d <= Math.min(b, e); d++) {
    if (gp && inGap(t, d)) continue;
    if (isRegM(t.assigneeId, d)) h[d - s] += cap * ded;
    const ex = extraAt(t.assigneeId, d);
    if (ex) h[d - s] += (ex.byTask[t.id] || 0) + (isRegM(t.assigneeId, d) ? 0 : ex.free * ded);
  }
}
function loadDays(mid, s, e, o = {}) {
  const cap = capOf(mid),
    n = e - s + 1,
    h = new Array(n).fill(0),
    c = new Array(n).fill(0);
  for (let d = s; d <= e; d++) {
    const ex = extraAt(mid, d);
    c[d - s] = (isRegM(mid, d) ? cap * absAvail(absOn(mid, d)) : 0) + (ex ? ex.h : 0);
  }
  for (const t of arr('tasks')) if (t.assigneeId === mid && t.id !== o.exclude) addTaskLoad(h, s, e, t, cap);
  if (o.extra && o.extra.assigneeId === mid) addTaskLoad(h, s, e, o.extra, cap);
  for (const m of arr('meetings'))
    if ((m.attendees || []).includes(mid)) {
      const d = dn(m.date);
      if (d >= s && d <= e && isWorkM(mid, d)) h[d - s] += (+m.duration || 0) / 60;
    }
  return { h, c, cap };
}
const pctOf = (H, C) => (C > 1e-9 ? (100 * H) / C : H > 0 ? Infinity : 0);
const fmtPct = (p) => (p === Infinity ? '∞' : Math.round(p) + '%');
const monday = (d) => d - ((dow(d) + 6) % 7);
function weekLoads(mid, from, n, o) {
  const s = monday(from),
    e = s + 7 * n - 1,
    L = loadDays(mid, s, e, o),
    out = [];
  for (let w = 0; w < n; w++) {
    let H = 0,
      C = 0,
      pk = 0,
      wd = 0,
      ab = 0;
    for (let i = 0; i < 5; i++) {
      const k = w * 7 + i;
      H += L.h[k];
      C += L.c[k];
      pk = Math.max(pk, pctOf(L.h[k], L.c[k]));
      if (isWorkM(mid, s + k)) {
        wd++;
        if (L.c[k] < L.cap - 1e-9) ab++;
      }
    }
    out.push({
      start: s + 7 * w,
      avg: pctOf(H, C),
      peak: pk,
      cap: C,
      hours: H,
      absentDays: ab,
      workDays: wd,
    });
  }
  return out;
}
function loadLevel(p) {
  if (p > 100) return { t: 'Sobrecarga', c: 'bad' };
  if (p >= 85) return { t: 'Al límite', c: 'warn' };
  if (p > 0) return { t: 'Disponible', c: 'ok' };
  return { t: 'Libre', c: 'mut' };
}
const loadBg = (p) => (p > 100 ? '#f04438' : p >= 85 ? '#f79009' : p > 0 ? '#32d583' : 'transparent');
function weekTag(x) {
  if (x.workDays === 0) return '<span class="tag mut" title="Semana sin días laborables">festivo</span>';
  if (x.cap < 1e-9 && x.hours < 1e-9)
    return '<span class="tag mut" title="Ausente toda la semana">ausente</span>';
  const l = loadLevel(x.avg);
  return `<span class="tag ${l.c}" title="Media ${fmtPct(x.avg)} · pico diario ${fmtPct(x.peak)}${x.absentDays ? ` · ${x.absentDays} día(s) de ausencia` : ''}">${fmtPct(x.avg)}${x.absentDays ? ' ·A' : ''}</span>`;
}
function weights() {
  return Object.assign(
    { plazo: 30, calidad: 40, alcance: 20, retrabajo: 10 },
    S.config.settings?.weights || {},
  );
}
function score(t, ev) {
  ev = ev || S.evals[t.id];
  if (!ev || !ev.quality) return null;
  const st = dn(t.start),
    en = dn(t.end),
    re = dn(t.realEnd) ?? en;
  const mid = t.assigneeId;
  const dur = Math.max(5, workDays(mid, st, en)),
    late = re > en ? workDays(mid, en + 1, re) : 0;
  const p = {
    plazo: Math.max(0, 100 - (100 * late) / dur),
    calidad: ev.quality * 20,
    alcance: Math.min(100, Math.max(0, Number(ev.scope ?? 100))),
    retrabajo: Math.max(0, 100 - 30 * (Number(ev.rework) || 0)),
  };
  const w = weights(),
    tw = +w.plazo + +w.calidad + +w.alcance + +w.retrabajo || 1;
  p.total =
    (p.plazo * w.plazo + p.calidad * w.calidad + p.alcance * w.alcance + p.retrabajo * w.retrabajo) / tw;
  p.late = late;
  return p;
}
function level(s) {
  if (s == null) return { t: 'Sin evaluar', c: 'lv0' };
  if (s >= 90) return { t: 'Excelente', c: 'lv4' };
  if (s >= 75) return { t: 'Bueno', c: 'lv3' };
  if (s >= 60) return { t: 'Aceptable', c: 'lv2' };
  return { t: 'Deficiente', c: 'lv1' };
}
// An open task whose owner has left the team, or leaves before its planned end
const ownerLeft = (t) => {
  const lf = S.members[t.assigneeId]?.leftOn;
  return !!lf && t.status !== 'done' && !inact(t) && (t.end > lf || todayS() > lf);
};
function health(t) {
  if (t.status === 'done') return null;
  {
    const ia = inact(t);
    if (ia) return ia === 'paused' ? { t: 'En pausa', c: 'mut' } : { t: 'Cancelada', c: 'mut' };
  }
  const T = todayN(),
    st = dn(t.start),
    en = dn(t.end);
  if (ownerLeft(t)) return { t: 'Responsable de baja', c: 'bad' };
  if (depBlocked(t)) return { t: 'Bloqueada por dependencia', c: 'bad' };
  if (t.status === 'blocked') return { t: 'Bloqueada', c: 'bad' };
  if (T > en) return { t: 'Vencida', c: 'bad' };
  {
    const f = fcOf(t);
    if (f.slip > 0) return { t: `Retraso previsto +${f.slip} d`, c: 'warn', fc: true };
  }
  if (T < st)
    return dateConflict(t) ? { t: 'Conflicto de fechas', c: 'warn' } : { t: 'No iniciada', c: 'mut' };
  const exp = Math.min(1, (T - st + 1) / (en - st + 1)) * 100;
  if ((t.progress || 0) < exp - 15) return { t: 'Retrasada', c: 'warn' };
  return { t: 'En plazo', c: 'ok' };
}
function statusCell(t) {
  if (t.status === 'done') {
    if (t.handover)
      return `<span class="tag mut">⇄ Traspasada a ${esc(S.members[t.handover.member]?.name || '—')}</span>`;
    if (!ME.owner) return '<span class="tag ok">Completada</span>';
    const s = score(t);
    const l = level(s?.total);
    return `<span class="tag ${l.c}">${s ? Math.round(s.total) + ' · ' : ''}${l.t}</span>`;
  }
  const h = health(t);
  return `<span class="tag ${h.c}">${h.t}</span>`;
}
const overloaded = () => activeMembers().filter((m) => weekLoads(m.id, todayN(), 4).some((w) => w.avg > 100));
const atRisk = (t) => {
  const h = health(t);
  return h && (h.c === 'bad' || h.c === 'warn');
};

/* ---------- filtros ---------- */
function filtered() {
  const me = myMemberId();
  return arr('tasks').filter(
    (t) =>
      (UI.proj.size === 0 || UI.proj.has(t.projectId)) &&
      (!UI.member || (UI.member === '__me' ? t.assigneeId === me : t.assigneeId === UI.member)) &&
      (!UI.origin || t.origin === UI.origin) &&
      (UI.showDone || t.status !== 'done'),
  );
}
function filterBar(withOrigin = true) {
  let h = `<div class="bar-tools">`;
  h += projects()
    .map(
      (p) =>
        `<span class="chip ${UI.proj.has(p.id) ? 'on' : ''}" data-proj="${p.id}"><span class="dot" style="background:${esc(p.color || '#98a2b3')}"></span>${esc(p.code || p.name)}</span>`,
    )
    .join('');
  h += `<select id="fMember"><option value="">Todo el equipo</option>${myMemberId() ? `<option value="__me" ${UI.member === '__me' ? 'selected' : ''}>Solo mis tareas</option>` : ''}${members()
    .map((m) => `<option value="${m.id}" ${UI.member === m.id ? 'selected' : ''}>${esc(m.name)}</option>`)
    .join('')}</select>`;
  if (withOrigin)
    h += `<select id="fOrigin"><option value="">Cualquier origen</option>${Object.entries(ORIG)
      .map(([k, v]) => `<option value="${k}" ${UI.origin === k ? 'selected' : ''}>${v.t}</option>`)
      .join('')}</select>`;
  h += `<label class="chip ${UI.showDone ? 'on' : ''}" id="fDone">Mostrar completadas</label></div>`;
  return h;
}
function bindFilters() {
  document.querySelectorAll('[data-proj]').forEach(
    (el) =>
      (el.onclick = () => {
        const id = el.dataset.proj;
        UI.proj.has(id) ? UI.proj.delete(id) : UI.proj.add(id);
        render();
      }),
  );
  const fm = $('#fMember');
  if (fm)
    fm.onchange = () => {
      UI.member = fm.value;
      render();
    };
  const gp = $('#gProj');
  if (gp)
    gp.onchange = () => {
      UI.proj = new Set(gp.value ? [gp.value] : []);
      render();
    };
  const fo = $('#fOrigin');
  if (fo)
    fo.onchange = () => {
      UI.origin = fo.value;
      render();
    };
  const fd = $('#fDone');
  if (fd)
    fd.onclick = () => {
      UI.showDone = !UI.showDone;
      render();
    };
}
