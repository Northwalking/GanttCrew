/* ---------- avisos de fechas ---------- */
const AL_T = 5,
  AL_P = 10;
function addWorkG(d, n) {
  let x = d;
  while (n > 0) {
    x++;
    if (isWork(x) && !holAll(x).length) n--;
  }
  return x;
}
function projEndRisk(t) {
  const p = S.projects[t.projectId];
  const pe = dn(p?.end);
  if (pe == null || t.status === 'done' || inact(t)) return null;
  const e = dn(t.end);
  const f = fcOf(t).end;
  const last = Math.max(e ?? -Infinity, f ?? -Infinity);
  return last > pe ? { last, pe, byPlan: e > pe } : null;
}
function alerts() {
  const T = todayN(),
    me = myMemberId(),
    out = [];
  const mine = (t) => ME.owner || t.assigneeId === me;
  for (const t of arr('tasks')) {
    if (!mine(t) || t.status === 'done' || inact(t) || !t.end) continue;
    const p = S.projects[t.projectId];
    if (p && (p.status === 'closed' || p.status === 'cancelled')) continue;
    const e = dn(t.end),
      pv = !!t.priv,
      lim = pv ? T + AL_T + 2 : t.assigneeId ? addWork(t.assigneeId, T, AL_T) : addWorkG(T, AL_T);
    const base = { kind: 'task', id: t.id, name: t.name, proj: p?.code || p?.name || '', who: t.assigneeId };
    if (ME.owner && ownerLeft(t))
      out.push({
        ...base,
        key: 'lf:' + t.id + ':' + S.members[t.assigneeId].leftOn,
        sev: 'bad',
        txt: `Responsable de baja desde el ${fmt(S.members[t.assigneeId].leftOn)}: traspasa la tarea`,
      });
    else if (e < T)
      out.push({
        ...base,
        key: 'od:' + t.id + ':' + t.end,
        sev: 'bad',
        txt: `Vencida desde el ${fmt(t.end)} (${t.assigneeId && !pv ? workDays(t.assigneeId, e + 1, T) : T - e} días) · ${t.progress || 0} %`,
      });
    else if (e <= lim)
      out.push({
        ...base,
        key: 'so:' + t.id + ':' + t.end,
        sev: 'warn',
        txt:
          e === T
            ? 'Vence hoy · ' + (t.progress || 0) + ' %'
            : `Vence el ${fmt(t.end)} (en ${t.assigneeId && !pv ? workDays(t.assigneeId, T + 1, e) : e - T} días) · ${t.progress || 0} %`,
      });
    const f = fcOf(t);
    if (e >= T && f.end != null && f.slip > 0)
      out.push({
        ...base,
        key: 'sl:' + t.id + ':' + iso(f.end),
        sev: 'warn',
        txt: `Retraso previsto +${f.slip} días: prevista ${fmt(iso(f.end))} (plan ${fmt(t.end)})`,
      });
    const r = projEndRisk(t);
    if (r)
      out.push({
        ...base,
        key: 'op:' + t.id + ':' + iso(r.last) + ':' + iso(r.pe),
        sev: 'bad',
        txt: `Fuera del plazo del proyecto: ${r.byPlan ? 'acaba' : 'prevista'} el ${fmt(iso(r.last))} y el proyecto termina el ${fmt(iso(r.pe))}`,
      });
  }
  for (const p of projects()) {
    if (!(ME.owner || p.ownerId === me)) continue;
    if (p.status && p.status !== 'active') continue;
    const pe = dn(p.end);
    if (pe == null) continue;
    const open = arr('tasks').filter((t) => t.projectId === p.id && t.status !== 'done' && !inact(t));
    if (!open.length) continue;
    const base = { kind: 'proj', id: p.id, name: p.name, proj: p.code || '' };
    if (pe < T)
      out.push({
        ...base,
        key: 'pod:' + p.id + ':' + p.end,
        sev: 'bad',
        txt: `Fin objetivo superado (${fmt(p.end)}) con ${open.length} tarea(s) abierta(s)`,
      });
    else if (pe <= addWorkG(T, AL_P))
      out.push({
        ...base,
        key: 'pso:' + p.id + ':' + p.end,
        sev: 'warn',
        txt: `Fin objetivo el ${fmt(p.end)} · ${open.length} tarea(s) abierta(s)`,
      });
    let last = -Infinity,
      lt = null;
    for (const t of open) {
      const v = Math.max(dn(t.end) ?? -Infinity, fcOf(t).end ?? -Infinity);
      if (v > last) {
        last = v;
        lt = t;
      }
    }
    if (pe >= T && last > pe)
      out.push({
        ...base,
        key: 'prk:' + p.id + ':' + iso(last) + ':' + p.end,
        sev: 'bad',
        txt: `No se cumplirá el fin objetivo (${fmt(p.end)}): «${lt.name}» acaba o está prevista el ${fmt(iso(last))}`,
      });
  }
  const rank = { bad: 0, warn: 1 };
  return out.sort(
    (a, b) => rank[a.sev] - rank[b.sev] || (a.kind === b.kind ? 0 : a.kind === 'proj' ? -1 : 1),
  );
}
const seenKey = () => 'gantt.alSeen.' + (ME.memberId || 'pm');
function alSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]'));
  } catch (e) {
    return new Set();
  }
}
function renderBell() {
  const b = $('#bellBtn');
  if (!b) return;
  const A = alerts(),
    seen = alSeen(),
    nw = A.filter((a) => !seen.has(a.key)).length;
  b.innerHTML = `🔔${A.length ? `<span class="bellN ${nw ? 'new' : ''}">${A.length}</span>` : ''}`;
  b.title = A.length
    ? `${A.length} aviso(s) de fechas${nw ? ' · ' + nw + ' nuevo(s)' : ''}`
    : 'Sin avisos de fechas';
}
function openAlerts() {
  const A = alerts();
  const seen = alSeen();
  const grp = [];
  for (const a of A) {
    const g = grp.find((x) => x.kind === a.kind && x.id === a.id);
    if (g) {
      g.txts.push(a.txt);
      if (a.sev === 'bad') g.sev = 'bad';
      if (!seen.has(a.key)) g.nw = true;
    } else grp.push({ ...a, txts: [a.txt], nw: !seen.has(a.key) });
  }
  const item = (a) =>
    `<div class="alrow ${a.sev}" ${a.kind === 'task' ? `data-altask="${a.id}"` : `data-alproj="${a.id}"`}><div style="display:flex;gap:8px;align-items:center"><span class="tag ${a.sev}">${a.sev === 'bad' ? '!' : '⏰'}</span><b>${esc(a.name)}</b>${a.proj ? `<span class="mut">· ${esc(a.proj)}</span>` : ''}${a.kind === 'task' && ME.owner && a.who ? `<span class="sp"></span>${who(a.who, true)}` : ''}${a.nw ? '<span class="tag lv3" style="margin-left:4px">nuevo</span>' : ''}</div>${a.txts.map((x) => `<div class="mut" style="font-size:12px;margin-top:3px;padding-left:30px">${esc(x)}</div>`).join('')}</div>`;
  const P = grp.filter((a) => a.kind === 'proj'),
    Tk = grp.filter((a) => a.kind === 'task');
  const body = `<div class="full">${A.length ? '' : '<p class="hint">No hay avisos: ninguna tarea vence en los próximos 5 días laborables ni está vencida o con retraso previsto, y ningún proyecto está en riesgo.</p>'}
    ${P.length ? `<div class="alh">Proyectos (${P.length})</div>${P.map(item).join('')}` : ''}${Tk.length ? `<div class="alh">Tareas (${Tk.length})</div>${Tk.map(item).join('')}` : ''}
    <p class="hint" style="margin-top:10px">${ME.owner ? 'Ves los avisos de todo el equipo.' : 'Ves los avisos de tus tareas y de los proyectos de los que eres responsable.'} Avisa de tareas que vencen en los próximos 5 días laborables, vencidas, con retraso previsto o que acaban después del fin objetivo de su proyecto; y de proyectos cuyo fin objetivo llega en 10 días laborables, ya pasó o no se cumplirá.</p></div>`;
  openDlg('🔔 Avisos de fechas', body, null, null, true);
  if ($('#mCancel')) $('#mCancel').textContent = 'Cerrar';
  try {
    localStorage.setItem(seenKey(), JSON.stringify(A.map((a) => a.key)));
  } catch (e) {}
  renderBell();
  document.querySelectorAll('[data-altask]').forEach(
    (r) =>
      (r.onclick = () => {
        closeDlg();
        openTask(r.dataset.altask);
      }),
  );
  document.querySelectorAll('[data-alproj]').forEach(
    (r) =>
      (r.onclick = () => {
        if (!ME.owner) return;
        closeDlg();
        openProject(r.dataset.alproj);
      }),
  );
}
function alertToast() {
  const A = alerts(),
    seen = alSeen(),
    nw = A.filter((a) => !seen.has(a.key));
  if (nw.length) {
    const b = nw.filter((a) => a.sev === 'bad').length;
    toast(
      `🔔 ${nw.length} aviso(s) nuevo(s) de fechas${b ? ` (${b} importante(s))` : ''}. Pulsa la campana para verlos.`,
    );
  }
}
