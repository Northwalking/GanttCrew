/* ---------- utilidades ---------- */
// "HH:MM" <-> minutes of the day (meetings store start time + duration; the forms show an end time)
const hm2min = (s) => (/^\d{1,2}:\d{2}/.test(s || '') ? +s.split(':')[0] * 60 + +s.split(':')[1] : null);
const min2hm = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const endTime = (time, dur) =>
  hm2min(time) == null ? '' : min2hm(Math.min(1439, hm2min(time) + (+dur || 60)));
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const dn = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const iso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const todayN = () => {
  const t = new Date();
  return Math.round(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / DAY);
};
const todayS = () => iso(todayN());
const fmt = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) : '—');
const dow = (n) => (((n + 4) % 7) + 7) % 7;
const initials = (n) =>
  (
    String(n || '?')
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w))
      .slice(0, 2)
      .map((x) => x[0])
      .join('') || '?'
  ).toUpperCase();
const arr = (col) => Object.entries(S[col]).map(([id, v]) => ({ id, ...v }));
const members = () =>
  arr('members').sort((a, b) => (b.isPM ? 1 : 0) - (a.isPM ? 1 : 0) || String(a.name).localeCompare(b.name));
const projects = () => arr('projects').sort((a, b) => String(a.name).localeCompare(b.name));
const APP_BUILD = '__BUILD__';
const APP_NEWS = __NEWS__;
const mem = (id) => S.members[id];
const DEFAULT_PTYPES = [
  { id: 'interno', name: 'Proyecto interno', color: '#667085' },
  { id: 'europeo', name: 'Proyecto europeo', color: '#1570ef' },
  { id: 'nacional', name: 'Proyecto nacional', color: '#7a5af8' },
  { id: 'gt', name: 'Grupo de trabajo', color: '#dc6803' },
];
const ptypes = () => (Array.isArray(S.config.settings?.ptypes) ? S.config.settings.ptypes : DEFAULT_PTYPES);
const ptypeOf = (k) => ptypes().find((x) => x.id === k);
const ptypeLbl = (k) => ptypeOf(k)?.name || '';
const ptypeTag = (k) => {
  const t = ptypeOf(k);
  return t
    ? ` <span class="tag" style="background:${esc(t.color || '#667085')}1f;color:${esc(t.color || '#667085')}">${esc(t.name)}</span>`
    : '';
};
function projPeople(p) {
  if (!p) return [];
  const s = new Set([...(p.ownerId ? [p.ownerId] : []), ...(p.participants || [])]);
  return [...s].filter((id) => S.members[id]);
}
const CODE_STOP = new Set(
  'de del la las el los y e o u a al en para por con sin sobre entre hacia desde the of and for to in on with an'.split(
    ' ',
  ),
);
const CODE_GENERIC = new Set(
  'proyecto proyectos project grupo group trabajo working sistema sistemas system plataforma platform desarrollo development gestion management herramienta tool servicio servicios service modulo module programa nuevo nueva fase motor red tematica version piloto apoyo soporte'.split(
    ' ',
  ),
);
function autoCode(name, selfId) {
  const raw = String(name || '')
    .replace(/[·•|:,;()\[\]"'«»]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const plain = (w) =>
    w
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
  const low = (w) =>
    w
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const isKey = (w) => {
    const c = w.replace(/[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü-]/g, '');
    if (c.length < 2 || /^\d+$/.test(c)) return false;
    return (
      (/\d/.test(c) && /[A-Za-z]/.test(c)) ||
      (c === c.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{2}/.test(c)) ||
      /[a-z][A-Z]/.test(c)
    );
  };
  const tok = raw.map((w) => ({ w, key: isKey(w), k: plain(w), l: low(w) }));
  const okWord = (t) => !t.key && t.l.length > 2 && !/^\d+$/.test(t.l) && !CODE_STOP.has(t.l);
  const good = (t) => okWord(t) && !CODE_GENERIC.has(t.l);
  const keys = tok.filter((t) => t.key && t.k);
  let parts = [];
  if (keys.length) {
    const k0 = keys[0];
    parts.push(k0.k.slice(0, 8));
    if (keys[1]) parts.push(keys[1].k.slice(0, 6));
    else {
      const after = tok.slice(tok.indexOf(k0) + 1).filter(good);
      if (after[0]) parts.push(after[0].l.slice(0, 3).toUpperCase());
    }
  } else {
    let pool = tok.filter(good);
    if (!pool.length) pool = tok.filter(okWord);
    parts =
      pool.length === 1
        ? [pool[0].l.slice(0, 6).toUpperCase()]
        : pool.slice(0, 3).map((t) => t.l.slice(0, 3).toUpperCase());
  }
  let code = parts.join('-') || 'PRY';
  const used = new Set(
    arr('projects')
      .filter((p) => p.id !== selfId)
      .map((p) => String(p.code || '').toUpperCase()),
  );
  if (used.has(code)) {
    let i = 2;
    while (used.has(code + '-' + i)) i++;
    code += '-' + i;
  }
  return code;
}
const PSTATUS = [
  ['active', 'Activo'],
  ['paused', 'En pausa'],
  ['closed', 'Cerrado (terminado)'],
  ['cancelled', 'Cancelado'],
];
const pstatusLbl = (k) =>
  ({ active: 'Activo', paused: 'En pausa', closed: 'Cerrado', cancelled: 'Cancelado' })[k] || 'Activo';
const pstatusTag = (p) =>
  p.status === 'paused'
    ? ' <span class="tag warn">En pausa</span>'
    : p.status === 'cancelled'
      ? ' <span class="tag bad">Cancelado</span>'
      : '';
const HK = { pause: 'Pausa', cancel: 'Cancelación' };
const hist = (t) => (Array.isArray(t?.hist) ? t.hist : []);
const openEv = (t) => {
  const h = hist(t),
    l = h[h.length - 1];
  return l && !l.to ? l : null;
};
function inGap(t, d) {
  for (const e of hist(t)) {
    if (!e.to) continue;
    const a = dn(e.from),
      b = dn(e.to);
    if (d >= a && d < b) return true;
  }
  return false;
}
function addWork(mid, d, n) {
  let x = d;
  while (n > 0) {
    x++;
    if (isWorkM(mid, x)) n--;
  }
  return x;
}
function gapWork(mid, from, to) {
  const a = dn(from),
    b = dn(to);
  return a == null || b == null || b <= a ? 0 : workDays(mid, a, b - 1);
}
function inact(t) {
  if (!t || t.status === 'done') return null;
  const o = openEv(t);
  if (o) return o.k === 'pause' ? 'paused' : 'cancelled';
  if (hist(t).length) return null;
  const p = S.projects[t.projectId];
  if (!p) return null;
  if (p.status === 'cancelled' && !(p.hist || []).length) return 'cancelled';
  if (p.status === 'paused' && (p.pausedTasks || []).includes(t.id)) return 'paused';
  return null;
}
const projOpen = (p) => {
  const h = p?.hist || [],
    l = h[h.length - 1];
  return l && !l.to && (p.status === 'paused' || p.status === 'cancelled') ? l : null;
};
const projectsOf = (mid) => projects().filter((p) => projPeople(p).includes(mid));
const memColor = (id) => mem(id)?.color || '#98a2b3';
const pct = (v) => (v == null ? '—' : Math.round(v) + '%');
const tk = (id) => (S.tasks[id] ? { id, ...S.tasks[id] } : null);
const tlabel = (t) => `${t.name} (${mem(t.assigneeId)?.name || 'sin asignar'})`;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.style.display = 'none'), 3600);
}
function who(id, small) {
  const m = mem(id);
  if (!m) return '<span class="mut">Sin asignar</span>';
  return `<span class="who" title="${esc(m.name)}"><span class="av" style="background:${esc(m.color || '#98a2b3')}">${esc(initials(m.name))}</span>${small ? '' : esc(m.name)}</span>`;
}
