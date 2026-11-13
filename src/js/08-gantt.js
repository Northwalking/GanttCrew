/* ---------- línea de tiempo ---------- */
function lastPlanYear() {
  let y = 0;
  const up = (d) => {
    if (d) {
      const v = +String(d).slice(0, 4);
      if (v > y) y = v;
    }
  };
  for (const t of arr('tasks')) {
    up(t.end);
    up(t.realEnd);
    if (t.status !== 'done') {
      const f = fcOf(t);
      if (f.end != null) up(iso(f.end));
    }
  }
  for (const p of arr('projects')) if (p.status !== 'cancelled') up(p.end);
  return y;
}
function navYears() {
  const c = new Date().getFullYear();
  let a = c,
    b = c + 2;
  for (const t of arr('tasks')) {
    const y1 = +String(t.start || '').slice(0, 4);
    if (y1 && y1 < a) a = y1;
  }
  const ly = lastPlanYear();
  if (ly > b) b = ly;
  if (UI.year < a) a = UI.year;
  if (UI.year > b) b = UI.year;
  const out = [];
  for (let y = Math.max(a, c - 6); y <= Math.min(b, c + 15); y++) out.push(y);
  return out;
}
function setNav(y, m) {
  UI.year = y;
  UI.calMonth = y + '-' + String(m + 1).padStart(2, '0');
}
function scrollToMonth(m) {
  const gw = $('#gw');
  if (!gw) return;
  const R = range();
  const a = dn(UI.year + '-' + String(m + 1).padStart(2, '0') + '-01');
  gw.scrollLeft = Math.max(0, (a - R.s) * UI.ppd - 4);
}
function spanYears() {
  if (UI.span === 'auto') {
    const y = lastPlanYear();
    return Math.max(1, Math.min(10, (y || UI.year) - UI.year + 1));
  }
  return Math.max(1, +UI.span || 1);
}
function range() {
  const s = dn(UI.year + '-01-01'),
    e = dn(UI.year + 1 + '-01-01');
  return { s, days: e - s, years: 1 };
}
function navTools() {
  const ym =
    UI.calMonth && +UI.calMonth.slice(0, 4) === UI.year
      ? +UI.calMonth.slice(5, 7) - 1
      : UI.year === new Date().getFullYear()
        ? new Date().getMonth()
        : 0;
  return `<span class="mut" style="font-size:12px">Año</span><select id="nYear">${navYears()
    .map((y) => `<option ${y === UI.year ? 'selected' : ''}>${y}</option>`)
    .join(
      '',
    )}</select><span class="mut" style="font-size:12px">Ir al mes</span><select id="nMonth">${MESL2.map((n, i) => `<option value="${i}" ${i === ym ? 'selected' : ''}>${n[0].toUpperCase() + n.slice(1)}</option>`).join('')}</select><button class="btn" id="goToday">Ir a hoy</button><button class="btn" id="goJan">1 de enero</button>
    ${UI.view === 'gantt' ? `<div class="seg" title="Agrupar las tareas por proyecto o por persona (cronograma)"><button data-grp="project" class="${UI.groupBy !== 'person' ? 'on' : ''}">Por proyecto</button><button data-grp="person" class="${UI.groupBy === 'person' ? 'on' : ''}">Por persona</button></div>` : ''}
    <div class="seg" title="Ancho de cada día">${[
      [8, 'Trimestre'],
      [22, 'Mes'],
    ]
      .map(([v, l]) => `<button data-z="${v}" class="${UI.ppd === v ? 'on' : ''}">${l}</button>`)
      .join('')}</div>`;
}
function timeTools() {
  return `<div class="bar-tools">${navTools()}${ME.owner && EVKEY && Object.values(PRDATA.projects).some((x) => !x._del) ? `<button class="btn ${UI.showPriv === false ? '' : 'pri'}" id="tgPriv" title="Mostrar u ocultar tus proyectos privados (por ejemplo, al proyectar la pantalla)">🔒 Privados: ${UI.showPriv === false ? 'ocultos' : 'visibles'}</button>` : ''}<span class="sp"></span>
    ${UI.view === 'gantt' ? '<button class="btn" id="expImg" title="Exportar el Gantt de un proyecto o de una fase como imagen para Word">🖼 Exportar imagen</button>' : ''}
    ${ME.memberId ? '<button class="btn" id="addMeet">+ Reunión</button>' : ''}
    ${canCreateTask() ? '<button class="btn pri" id="addTask">+ Tarea</button>' : ''}</div>`;
}
function bindTimeTools() {
  const ny = $('#nYear');
  if (ny)
    ny.onchange = () => {
      const y = +ny.value;
      const m = +($('#nMonth')?.value || 0);
      setNav(y, m);
      render();
      scrollToMonth(m);
    };
  const nm = $('#nMonth');
  if (nm)
    nm.onchange = () => {
      const m = +nm.value;
      setNav(UI.year, m);
      UI.calDay = null;
      scrollToMonth(m);
    };
  if ($('#goJan'))
    $('#goJan').onclick = () => {
      setNav(UI.year, 0);
      if ($('#nMonth')) $('#nMonth').value = 0;
      scrollToMonth(0);
    };
  document.querySelectorAll('[data-grp]').forEach(
    (b) =>
      (b.onclick = () => {
        UI.groupBy = b.dataset.grp;
        try {
          localStorage.setItem('gantt.group', UI.groupBy);
        } catch (e) {}
        render();
      }),
  );
  document.querySelectorAll('[data-z]').forEach(
    (b) =>
      (b.onclick = () => {
        const gw = $('#gw');
        const c = gw ? (gw.scrollLeft + (gw.clientWidth - LBL) / 2) / UI.ppd : 0;
        UI.ppd = +b.dataset.z;
        try {
          localStorage.setItem('gantt.zoom', UI.ppd);
        } catch (e) {}
        render();
        const g = $('#gw');
        if (g) g.scrollLeft = c * UI.ppd - (g.clientWidth - LBL) / 2;
      }),
  );
  $('#goToday').onclick = () => {
    const d = new Date();
    setNav(d.getFullYear(), d.getMonth());
    UI.calDay = todayN();
    scrollToday();
    if ($('#nMonth')) $('#nMonth').value = d.getMonth();
  };
  if ($('#tgPriv'))
    $('#tgPriv').onclick = () => {
      UI.showPriv = UI.showPriv === false;
      try {
        localStorage.setItem('gantt.showPriv', UI.showPriv ? '1' : '0');
      } catch (e) {}
      rebuild();
      render();
    };
  if ($('#expImg')) $('#expImg').onclick = () => openExportGantt();
  const at = $('#addTask');
  if (at) at.onclick = () => openTask(null);
  const am = $('#addMeet');
  if (am) am.onclick = () => openMeeting(null);
  const gw = $('#gw');
  if (gw) {
    let tm;
    gw.addEventListener('scroll', () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const R = range();
        const d = Math.min(
          R.s + R.days - 1,
          Math.max(R.s, R.s + Math.round((gw.scrollLeft + (gw.clientWidth - LBL) / 3) / UI.ppd)),
        );
        const ymS = iso(d).slice(0, 7);
        if (UI.calMonth !== ymS) {
          UI.calMonth = ymS;
          const sel = $('#nMonth');
          if (sel) sel.value = +ymS.slice(5, 7) - 1;
        }
      }, 150);
    });
  }
  document.querySelectorAll('[data-gday]').forEach(
    (el) =>
      (el.onclick = () => {
        const d = +el.dataset.gday;
        UI.calDay = d;
        UI.calMonth = iso(d).slice(0, 7);
        UI.calMember = '';
        UI.calMode = 'mes';
        location.hash = 'equipo';
      }),
  );
}
function scrollToday() {
  const gw = $('#gw');
  if (!gw) return;
  const R = range();
  const T = todayN();
  if (T < R.s || T >= R.s + R.days) {
    UI.year = new Date().getFullYear();
    render();
    return scrollToday();
  }
  gw.scrollLeft = Math.max(0, (T - R.s) * UI.ppd - (gw.clientWidth - LBL) / 3);
}
function monthsIn(R) {
  const out = [];
  let y = +iso(R.s).slice(0, 4),
    m = +iso(R.s).slice(5, 7) - 1;
  for (;;) {
    const a = dn(`${y}-${String(m + 1).padStart(2, '0')}-01`);
    if (a >= R.s + R.days) break;
    let ny = y,
      nm = m + 1;
    if (nm > 11) {
      ny++;
      nm = 0;
    }
    out.push({ y, m, a, b: dn(`${ny}-${String(nm + 1).padStart(2, '0')}-01`) });
    y = ny;
    m = nm;
  }
  return out;
}
const headH = () => (UI.ppd >= 18 ? 58 : UI.ppd >= 6 ? 40 : 22);
const WD1 = LA(['D', 'L', 'M', 'X', 'J', 'V', 'S'], ['S', 'M', 'T', 'W', 'T', 'F', 'S']),
  WD3 = LA(
    ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  );
function header(R, W, title) {
  const H = headH(),
    T = todayN();
  let h = `<div class="ghead"><div class="lbl" style="height:${H}px">${title}</div><div class="hcells" style="width:${W}px;height:${H}px">`;
  if (UI.ppd < 2) {
    const qs = [];
    for (const M of monthsIn(R)) {
      const q = Math.floor(M.m / 3),
        l = qs[qs.length - 1];
      if (l && l.y === M.y && l.q === q) l.b = M.b;
      else qs.push({ y: M.y, q, a: M.a, b: M.b });
    }
    for (const Q of qs) {
      const a = Math.max(0, Q.a - R.s),
        b = Math.min(R.days, Q.b - R.s);
      h += `<div class="hm${Q.q === 0 ? ' hy' : ''}" style="left:${a * UI.ppd}px;width:${(b - a) * UI.ppd}px">${Q.q + 1 + 'T' + (Q.q === 0 || Q === qs[0] ? ' ' + String(Q.y).slice(2) : '')}</div>`;
    }
  } else
    for (const M of monthsIn(R)) {
      const y = M.y,
        m = M.m;
      const a = Math.max(0, M.a - R.s),
        b = Math.min(R.days, M.b - R.s);
      const first = M.a <= R.s;
      h += `<div class="hm${m === 0 ? ' hy' : ''}" style="left:${a * UI.ppd}px;width:${(b - a) * UI.ppd}px">${UI.ppd >= 8 ? (GBT >= 17 ? MESL[m].toUpperCase() + ' ' + y : MESL[m] + ' ' + y) : UI.ppd >= 3 ? (m === 0 || first ? MES[m] + ' ' + String(y).slice(2) : MES[m]) : m === 0 || first ? String(y) : m % 3 === 0 ? MES[m] : ''}</div>`;
    }
  if (UI.ppd >= 18) {
    for (let d = 0; d < R.days; d++) {
      const n = R.s + d,
        w = dow(n),
        hol = holAll(n),
        cls =
          (n === T ? ' hd-today' : '') + (hol.length && isWork(n) ? ' hd-hol' : !isWork(n) ? ' hd-we' : '');
      const tip = `${WD3[w]} ${fmt(iso(n))}${hol.length ? ' · ' + hol.map((x) => x.name).join(', ') : ''}`;
      h += `<div class="hd${cls}" ${GBT >= 17 ? `data-gday="${n}"` : ''} style="left:${d * UI.ppd}px;width:${UI.ppd}px;${GBT >= 17 ? 'cursor:pointer' : ''}" title="${esc(tip)}${GBT >= 17 ? ' · ver el detalle del día en el Calendario' : ''}"><b>${+iso(n).slice(8, 10)}</b><span>${UI.ppd >= 40 ? WD3[w] : WD1[w]}</span></div>`;
    }
  } else if (UI.ppd >= 6) {
    for (let d = 0; d < R.days; d++) {
      const n = R.s + d;
      if (dow(n) === 1) {
        h += `<div class="hw" style="left:${d * UI.ppd}px;width:${7 * UI.ppd}px">L ${+iso(n).slice(8, 10)}</div>`;
      }
    }
  }
  return h + `</div></div>`;
}
function overlay(R, W) {
  let h = `<div class="overlay" style="left:${LBL}px;width:${W}px">`;
  if (UI.ppd >= 8)
    for (let d = 0; d < R.days; d++) {
      if (dow(R.s + d) === 6)
        h += `<div class="ovw" style="left:${d * UI.ppd}px;width:${2 * UI.ppd}px"></div>`;
    }
  if (UI.ppd >= 18)
    for (let d = 1; d < R.days; d++) h += `<div class="ovd" style="left:${d * UI.ppd}px"></div>`;
  for (let d = 0; d < R.days; d++) {
    if (isWork(R.s + d) && holAll(R.s + d).length)
      h += `<div class="ovh" style="left:${d * UI.ppd}px;width:${Math.max(2, UI.ppd)}px"></div>`;
  }
  for (const M of monthsIn(R)) {
    if (M.a <= R.s) continue;
    if (UI.ppd < 2 && M.m % 3) continue;
    h += `<div class="ovm${M.m === 0 ? ' ovy' : ''}" style="left:${(M.a - R.s) * UI.ppd}px"></div>`;
  }
  const T = todayN() - R.s;
  if (T >= 0 && T < R.days) h += `<div class="today" style="left:${T * UI.ppd + UI.ppd / 2}px"></div>`;
  return h + `</div>`;
}
function clip(R, s, e) {
  if (s == null || e == null) return null;
  const a = Math.max(s, R.s),
    b = Math.min(e, R.s + R.days - 1);
  return b < a ? null : { x: (a - R.s) * UI.ppd, w: (b - a + 1) * UI.ppd };
}
function taskBar(R, t, top, extraTitle = '') {
  const s = dn(t.start),
    e = dn(t.end);
  if (s == null || e == null) return '';
  const c = clip(R, s, e);
  let h = '';
  if (c) {
    const col = GBT >= 17 ? S.projects[t.projectId]?.color || memColor(t.assigneeId) : memColor(t.assigneeId);
    const late = t.status !== 'done' && todayN() > e;
    const blk = depBlocked(t) || t.status === 'blocked';
    const bl = blockers(t);
    const tip = `${extraTitle}${t.name}${inact(t) === 'paused' ? ' · EN PAUSA' : inact(t) === 'cancelled' ? ' · CANCELADA' : ''} · ${fmt(t.start)}–${fmt(t.end)} · ${t.progress || 0}%${bl.length && !t.forceStart ? ' · Bloqueada por: ' + bl.map(tlabel).join(', ') : ''}`;
    const ia = inact(t);
    h += `<div class="bar ${late && !ia ? 'late' : ''} ${t.status === 'done' ? 'done' : ''} ${blk && !ia ? 'blk' : ''} ${!hist(t).length ? (ia === 'paused' ? 'pz' : ia === 'cancelled' ? 'cx' : '') : ''} ${t.priv ? 'privb' : ''}" data-id="${t.id}" title="${esc(tip)}" style="left:${c.x}px;width:${c.w}px;top:${top ?? GBT}px;background-color:${col}40;${canPlan() ? '' : 'cursor:pointer'}"><i style="width:${t.progress || 0}%;background:${col}"></i>${GBT >= 17 && c.w >= 34 ? `<em class="bpct">${t.progress || 0} %</em>` : ''}${canEditTask(t) ? '<span class="rz"></span>' : ''}</div>`;
    {
      const TP = top ?? GBT;
      for (const ev of hist(t)) {
        const a = dn(ev.from);
        if (a == null) continue;
        const ic = ev.k === 'pause' ? '⏸' : '✕';
        if (ev.to) {
          const k = clip(R, Math.max(a, s), Math.min(dn(ev.to) - 1, e));
          if (k)
            h += `<div class="pgap" style="left:${k.x}px;width:${k.w}px;top:${TP}px" title="${esc(HK[ev.k] + ' del ' + fmt(ev.from) + ' al ' + fmt(iso(dn(ev.to) - 1)) + (ev.why ? ' · ' + ev.why : ''))}"><b>${ic}</b></div>`;
        } else {
          const k = clip(R, Math.max(a, s), e);
          if (k)
            h += `<div class="pfade ${ev.k}" style="left:${k.x}px;width:${k.w}px;top:${TP}px" title="${esc((ev.k === 'pause' ? 'En pausa desde el ' : 'Cancelada el ') + fmt(ev.from) + (ev.why ? ' · ' + ev.why : '') + ' · plan vigente ' + fmt(t.start) + '–' + fmt(t.end))}"></div>`;
          const m = clip(R, a, a);
          if (m)
            h += `<div class="pmark ${ev.k}" style="left:${m.x - 6}px;top:${TP - 9}px" title="${esc((ev.k === 'pause' ? 'Pausa ' : 'Cancelación ') + fmt(ev.from) + (ev.why ? ' · ' + ev.why : ''))}">${ic}</div>`;
        }
      }
    }
    for (const x of arr('extras')) {
      if (x.memberId !== t.assigneeId) continue;
      if (x.taskId && x.taskId !== t.id) continue;
      const d = dn(x.date);
      if (d == null || d < s || (!x.taskId && d > e) || (x.taskId && d > Math.max(e, fcOf(t).end ?? e)))
        continue;
      if (!x.taskId && (isRegM(x.memberId, d) || t.status === 'done')) continue;
      const k = clip(R, d, d);
      if (k)
        h += `<div class="xmark" style="left:${k.x + k.w / 2 - 6}px;top:${(top ?? GBT) + (GBT >= 17 ? 5 : 3)}px" title="${esc('Jornada extra ' + fmt(x.date) + ': ' + (mem(x.memberId)?.name || '') + ' · ' + x.hours + ' h' + (x.note ? ' · ' + x.note : ''))}">+</div>`;
    }
    if (memDays(t.assigneeId) && UI.ppd >= 6 && !t.priv)
      for (let d = Math.max(s, R.s); d <= Math.min(e, R.s + R.days - 1); d++)
        if (isWork(d) && !onSchedule(t.assigneeId, d)) {
          const k = clip(R, d, d);
          if (k)
            h += `<div class="nwsd" style="left:${k.x}px;width:${k.w}px;top:${top ?? GBT}px" title="${esc(mem(t.assigneeId)?.name || '')} no trabaja este día"></div>`;
        }
    for (const a of absOverlap(t.assigneeId, s, e)) {
      const k = clip(R, Math.max(a.s, s), Math.min(a.e, e));
      if (k)
        h += `<div class="absmark" style="left:${k.x}px;width:${k.w}px;top:${(top ?? GBT) + (GBT >= 17 ? 15 : 11)}px"></div>`;
    }
    const f = t.status === 'done' ? {} : fcOf(t);
    let tx = c.x + c.w;
    if (f.end != null && f.end > e) {
      const k = clip(R, e + 1, f.end);
      if (k) {
        h += `<div class="fcext" style="left:${k.x}px;width:${k.w}px;top:${top ?? GBT}px" title="${esc('Fin prevista ' + fmt(iso(f.end)) + ' (+' + f.slip + ' días lab.): ' + (f.reasons || []).join(' · '))}"></div>`;
        tx = k.x + k.w;
      }
    }
    if (GBT >= 17 && f.end != null && !inact(t)) {
      const k = clip(R, f.end, f.end);
      if (k)
        h += `<div class="fcstk" style="left:${k.x + k.w / 2 - 1}px"></div><div class="fcdia" style="left:${k.x + k.w / 2 - 5}px" title="${esc('Fin previsto ' + fmt(iso(f.end)) + (f.slip ? ' (' + (f.slip > 0 ? '+' : '') + f.slip + ' días lab. respecto al plan)' : ' (en plazo)'))}"></div>`;
    }
    if (top == null && GBT < 17)
      h += `<span class="btxt" style="left:${tx + 5}px">${esc(mem(t.assigneeId)?.name || '')} · ${t.progress || 0}%${t.status === 'done' ? ' ✓' : ''}${inact(t) === 'paused' ? ' · <i>en pausa</i>' : inact(t) === 'cancelled' ? ' · <i>cancelada</i>' : ''}${f.slip > 0 ? ` · <b style="color:var(--bad)">prevista ${fmt(iso(f.end)).slice(0, 5)}</b>` : ''}</span>`;
  }
  if (t.realStart && top == null) {
    const rs = dn(t.realStart),
      re = t.realEnd ? dn(t.realEnd) : Math.max(rs, todayN());
    const r = clip(R, rs, re);
    if (r)
      h += `<div class="real" style="left:${r.x}px;width:${r.w}px" title="Real: ${fmt(t.realStart)}–${t.realEnd ? fmt(t.realEnd) : 'en curso'}"></div>`;
  }
  return h;
}
function depTags(t) {
  let h = '';
  {
    const s = dn(t.start),
      e = dn(t.end);
    if (s != null && e != null && t.status !== 'done') {
      const ov = absOverlap(t.assigneeId, s, e);
      if (ov.length) {
        const n = ov.reduce((a, x) => a + workDays(t.assigneeId, Math.max(x.s, s), Math.min(x.e, e)), 0);
        if (n)
          h += `<span class="tag mut lock" title="${esc(ov.map((x) => absLabel(x) + ' ' + absWhen(x)).join(', '))}">aus. ${n} d</span>`;
      }
    }
  }
  const bl = depBlocked(t) ? blockers(t) : [];
  const bk = blocking(t);
  if (bl.length)
    h += `<span class="tag bad lock" title="${esc('Espera a: ' + bl.map(tlabel).join(', '))}">⛔ espera</span>`;
  if (bk.length)
    h += `<span class="tag warn lock" title="${esc('Bloquea a: ' + bk.map(tlabel).join(', '))}">⛓ ${bk.length}</span>`;
  return h;
}

/* ---------- vista: Gantt ---------- */
function vGantt(X) {
  GBT = 21;
  try {
    return vGantt_(X);
  } finally {
    GBT = 8;
  }
}
function ganttHead(n) {
  const R = range();
  const pv = ME.owner && EVKEY && Object.values(PRDATA.projects).some((x) => !x._del);
  const ym =
    UI.calMonth && +UI.calMonth.slice(0, 4) === UI.year
      ? +UI.calMonth.slice(5, 7) - 1
      : UI.year === new Date().getFullYear()
        ? new Date().getMonth()
        : 0;
  const pSel = UI.proj.size === 1 ? [...UI.proj][0] : '';
  return `<div class="calhead"><div><div class="eyebrow">Planificación</div><h2>Gantt anual · detalle diario</h2><p class="hint" style="margin:2px 0 0">Visualiza cada día del año, con sus fines de semana y tareas. Desplázate horizontalmente, selecciona un mes o amplía el detalle de los días.</p></div><span class="sp"></span>${ME.memberId ? '<button class="btn" id="addMeet">+ Reunión</button>' : ''}${canCreateTask() ? '<button class="btn pri" id="addTask">+ Añadir tarea</button>' : ''}</div>
  <div class="card gtools"><div class="gtrow"><select id="gProj"><option value="">Todos los proyectos</option>${projects()
    .map(
      (p) =>
        `<option value="${p.id}" ${pSel === p.id ? 'selected' : ''}>${esc((p.priv ? '🔒 ' : '') + (p.code ? p.code + ' · ' : '') + p.name)}</option>`,
    )
    .join('')}</select>
    <select id="fMember"><option value="">Todo el equipo</option>${myMemberId() ? `<option value="__me" ${UI.member === '__me' ? 'selected' : ''}>Solo mis tareas</option>` : ''}${members()
      .map((m) => `<option value="${m.id}" ${UI.member === m.id ? 'selected' : ''}>${esc(m.name)}</option>`)
      .join('')}</select>
    <span class="mut gtl">Año</span><select id="nYear">${navYears()
      .map((y) => `<option ${y === UI.year ? 'selected' : ''}>${y}</option>`)
      .join('')}</select>
    <span class="mut gtl">Ir al mes</span><select id="nMonth">${MESL2.map((n, i) => `<option value="${i}" ${i === ym ? 'selected' : ''}>${n[0].toUpperCase() + n.slice(1)}</option>`).join('')}</select>
    <button class="btn" id="goToday"><b>Ir a hoy</b></button><button class="btn" id="goJan"><b>1 de enero</b></button><span class="sp"></span>
    <div class="gk"><small>Tareas visibles</small><b>${n}</b></div><div class="gk"><small>Días del año</small><b>${R.days}</b></div></div>
  <div class="gtrow gtrow2"><div class="seg" title="Agrupar las tareas por proyecto o por persona"><button data-grp="project" class="${UI.groupBy !== 'person' ? 'on' : ''}">Por proyecto</button><button data-grp="person" class="${UI.groupBy === 'person' ? 'on' : ''}">Por persona</button></div>
    <div class="seg" title="Ancho de cada día">${[
      [8, 'Trimestre'],
      [22, 'Mes'],
    ]
      .map(([v, l]) => `<button data-z="${v}" class="${UI.ppd === v ? 'on' : ''}">${l}</button>`)
      .join('')}</div>
    <select id="fOrigin"><option value="">Cualquier origen</option>${Object.entries(ORIG)
      .map(([k, v]) => `<option value="${k}" ${UI.origin === k ? 'selected' : ''}>${v.t}</option>`)
      .join('')}</select>
    <label class="chip ${UI.showDone ? 'on' : ''}" id="fDone">Mostrar completadas</label>${pv ? `<button class="btn ${UI.showPriv === false ? '' : 'pri'}" id="tgPriv" title="Mostrar u ocultar tus proyectos privados">🔒 Privados: ${UI.showPriv === false ? 'ocultos' : 'visibles'}</button>` : ''}<span class="sp"></span><button class="btn" id="expImg" title="Exportar el Gantt de un proyecto o de una fase como imagen para Word">🖼 Exportar imagen</button></div></div>`;
}
function vGantt_(X) {
  const R = X ? X.R : range(),
    W = R.days * UI.ppd;
  const ps = X ? projects().filter((p) => X.pids.has(p.id)) : projects();
  let h = X ? '' : ganttHead(filtered().filter((t) => !UI.proj.size || UI.proj.has(t.projectId)).length);
  if (!ps.length)
    return (
      h +
      `<div class="card empty">Aún no hay proyectos.${ME.owner ? ' Créalos en <a href="#ajustes">Proyectos y equipo</a>.' : ''}</div>`
    );
  const tasks = X ? arr('tasks').filter((t) => X.tids.has(t.id)) : filtered();
  let y = headH() + 1;
  const rowY = {},
    bx = {},
    shown = [];
  let body = '';
  const byPerson = !X && UI.groupBy === 'person';
  const taskRow = (t) => {
    const o = ORIG[t.origin] || ORIG.plan;
    rowY[t.id] = y + 32;
    const c = clip(R, dn(t.start), dn(t.end));
    if (c) bx[t.id] = { x1: c.x, x2: c.x + c.w };
    shown.push(t);
    const f = t.status === 'done' ? null : fcOf(t);
    const ia = inact(t);
    const pj = S.projects[t.projectId];
    const meta = [
      byPerson ? pj?.code || pj?.name || '' : mem(t.assigneeId)?.name || 'Sin asignar',
      t.status === 'done'
        ? 'terminada' + (t.realEnd ? ' ' + fmtS(t.realEnd) : '')
        : ia === 'paused'
          ? 'en pausa'
          : ia === 'cancelled'
            ? 'cancelada'
            : nf1(remHours(t)) + ' h pendientes',
      (t.progress || 0) + ' %',
      !ia && f && f.end != null
        ? 'Prevista ' +
          fmtS(iso(f.end)) +
          (f.slip ? ' · ' + (f.slip > 0 ? '+' : '') + f.slip + ' días respecto al plan' : ' · en plazo')
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    body += `<div class="grow gt" style="height:64px"><div class="lbl gl" style="padding-left:30px"><div class="gl1">${byPerson ? `<span class="dot" style="background:${esc(pj?.color || '#98a2b3')};margin:0 6px 0 4px"></span>` : who(t.assigneeId, true)}<span class="tname" data-task="${t.id}" title="${esc(t.name)}">${t.priv ? '🔒 ' : ''}${esc(t.name)}</span>${t.handover ? '<span class="tag mut" title="Parte traspasada a otra persona" style="margin-left:6px">⇄ 1.ª parte</span>' : t.contOf ? '<span class="tag mut" title="Continúa una tarea traspasada" style="margin-left:6px">⇄ continuación</span>' : ''}</div><div class="gl2" title="${esc(meta)}">${esc(meta)}</div><div class="gl3"><span class="tag ${t.origin && t.origin !== 'plan' ? o.c : 'lv2'}">${esc(o.t)}</span>${depTags(t)}${health(t) && health(t).c === 'bad' ? `<span class="tag bad">${esc(health(t).t)}</span>` : ''}${projEndRisk(t) ? `<span class="tag bad" title="Acaba o está prevista después del fin objetivo del proyecto (${fmt(S.projects[t.projectId].end)})">Fuera del plazo del proyecto</span>` : ''}</div></div><div class="trk" style="width:${W}px;height:64px">${taskBar(R, t)}</div></div>`;
    y += 64;
  };
  if (byPerson) {
    const T = todayN();
    const ms = members().filter(
      (m) =>
        (!UI.member || (UI.member === '__me' ? m.id === myMemberId() : m.id === UI.member)) &&
        (inTeam(m, UI.year + '-01-01') || UI.member === m.id),
    );
    const groups = ms.map((m) => ({
      m,
      ts: tasks.filter((t) => t.assigneeId === m.id && (!UI.proj.size || UI.proj.has(t.projectId))),
    }));
    const un = tasks.filter((t) => !S.members[t.assigneeId] && (!UI.proj.size || UI.proj.has(t.projectId)));
    if (un.length && !UI.member) groups.push({ m: null, ts: un });
    for (const { m, ts } of groups) {
      const key = 'm:' + (m ? m.id : 'none');
      const col = UI.collapsed.has(key);
      ts.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      let trk = '';
      if (m) {
        const L = loadDays(m.id, R.s, R.s + R.days - 1);
        for (let d = 0; d < R.days; ) {
          const n = R.s + d;
          const len = Math.min(7 - ((dow(n) + 6) % 7), R.days - d);
          let H = 0,
            C = 0;
          for (let i = 0; i < len; i++) {
            H += L.h[d + i];
            C += L.c[d + i];
          }
          const v = pctOf(H, C);
          if (v > 0)
            trk += `<div class="wload" title="Semana del ${fmt(iso(monday(n)))}: ${fmtPct(v)} de sus horas disponibles" style="left:${d * UI.ppd + 1}px;width:${len * UI.ppd - 2}px;background:${loadBg(v)}">${len * UI.ppd >= 44 ? fmtPct(v) : ''}</div>`;
          d += len;
        }
        for (const a of absOf(m.id)) {
          const k = clip(R, a.s, a.e);
          if (k)
            trk += `<div class="absband" style="left:${k.x}px;width:${k.w}px" title="${esc(absLabel(a) + ' · ' + absWhen(a))}"></div>`;
        }
        for (const x of arr('meetings')) {
          if (!(x.attendees || []).includes(m.id)) continue;
          const d = dn(x.date) - R.s;
          if (d < 0 || d >= R.days) continue;
          trk += `<div class="mtg" data-meet="${x.id}" title="Reunión: ${esc(x.title)} · ${fmt(x.date)} ${esc(x.time || '')}" style="left:${d * UI.ppd + UI.ppd / 2 - 5}px;top:5px"></div>`;
        }
      }
      const wk = m ? weekLoads(m.id, T, 1)[0] : null;
      const lv = wk ? loadLevel(wk.avg) : null;
      body += `<div class="grow proj" style="height:48px"><div class="lbl"><span class="tog" data-tog="${key}">${col ? '▸' : '▾'}</span>${m ? who(m.id) : '<span class="mut">Sin asignar</span>'}<span class="mut" style="font-weight:400;font-size:11.5px">${m ? esc(m.role || '') + (schedLbl(m.id) ? ' · ' + schedLbl(m.id) : '') : ''}</span><span class="sp"></span>${lv ? `<span class="tag ${lv.c}" title="Carga de esta semana">${lv.t} · ${fmtPct(wk.avg)}</span>` : ''}<span class="mut" style="font-weight:400">${ts.length}</span></div><div class="trk" style="width:${W}px;height:48px">${trk}</div></div>`;
      y += 48;
      if (col) continue;
      if (!ts.length) {
        body += `<div class="grow" style="height:34px"><div class="lbl mut" style="padding-left:34px">Sin tareas con estos filtros</div><div class="trk" style="width:${W}px"></div></div>`;
        y += 34;
      }
      for (const t of ts) taskRow(t);
    }
  }
  for (const p of byPerson ? [] : ps) {
    if (!X && UI.proj.size && !UI.proj.has(p.id)) continue;
    const all = arr('tasks').filter((t) => t.projectId === p.id && (!X || X.tids.has(t.id)));
    const pts = tasks
      .filter((t) => t.projectId === p.id)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const col = !X && UI.collapsed.has(p.id);
    let sum = '';
    if (all.length) {
      const s = Math.min(...all.map((t) => dn(t.start))),
        e = Math.max(...all.map((t) => dn(t.end)));
      const c = clip(R, s, e);
      const tw = all.reduce((a, t) => a + (dn(t.end) - dn(t.start) + 1), 0) || 1;
      const pr = all.reduce((a, t) => a + (t.progress || 0) * (dn(t.end) - dn(t.start) + 1), 0) / tw;
      if (c)
        sum = `<div class="sumbar" style="left:${c.x}px;width:${c.w}px;background:${esc(p.color || '#9aa4b5')}55" title="${esc(p.name)} · ${Math.round(pr)}%"><i style="width:${pr}%;background:${esc(p.color || '#3a4252')}"></i></div>`;
    }
    const mts = arr('meetings')
      .filter((m) => m.projectId === p.id)
      .map((m) => {
        const d = dn(m.date) - R.s;
        return d < 0 || d >= R.days
          ? ''
          : `<div class="mtg" data-meet="${m.id}" title="Reunión: ${esc(m.title)} · ${fmt(m.date)}" style="left:${d * UI.ppd + UI.ppd / 2 - 5}px;top:11px"></div>`;
      })
      .join('');
    body += `<div class="grow proj" style="height:40px"><div class="lbl">${X ? '' : `<span class="tog" data-tog="${p.id}">${col ? '▸' : '▾'}</span>`}<span class="dot" style="background:${esc(p.color || '#98a2b3')}"></span><span class="tname" title="${esc(p.name)}${ptypeOf(p.type) ? ' · ' + esc(ptypeLbl(p.type)) : ''}${
      projPeople(p).length
        ? ' · Participantes: ' +
          esc(
            projPeople(p)
              .map((x) => mem(x).name)
              .join(', '),
          )
        : ''
    }" ${ME.owner ? `data-editproj="${p.id}"` : ''}>${esc(p.name)}</span>${p.priv ? ' <span class="tag mut" title="Proyecto privado: solo lo ves tú">🔒</span>' : ''}${pstatusTag(p)}<span class="mut" style="font-weight:400">${all.length}</span><span class="sp"></span>${!X && canCreateTask() ? `<button class="btn sm" data-addin="${p.id}">+</button>` : ''}</div><div class="trk" style="width:${W}px;height:40px">${sum}${mts}</div></div>`;
    y += 40;
    if (col) continue;
    if (!pts.length) {
      body += `<div class="grow" style="height:34px"><div class="lbl mut" style="padding-left:34px">Sin tareas con estos filtros</div><div class="trk" style="width:${W}px"></div></div>`;
      y += 34;
    }
    for (const t of pts) taskRow(t);
  }
  // flechas de dependencia (fin → inicio)
  let paths = '';
  for (const t of shown)
    for (const pid of t.deps || []) {
      if (rowY[pid] == null || !bx[pid] || !bx[t.id]) continue;
      const p = S.tasks[pid];
      const x1 = bx[pid].x2,
        y1 = rowY[pid],
        x2 = bx[t.id].x1,
        y2 = rowY[t.id];
      const k = dn(t.start) <= dn(p.end) ? 'c' : p.status === 'done' ? 'd' : 'n';
      const xm = x1 + 6;
      paths += `<path d="M${x1} ${y1} H${xm} V${y2 + (y2 > y1 ? -9 : 9)} H${x2 - 6} V${y2} H${x2 - 1}" fill="none" stroke="${k === 'c' ? '#c4320a' : k === 'd' ? '#b0b7c3' : '#3a4252'}" stroke-width="1.4" ${k === 'c' ? 'stroke-dasharray="3 2"' : ''} marker-end="url(#ar-${k})"/>`;
    }
  const mk = (id, c) =>
    `<marker id="ar-${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${c}"/></marker>`;
  const svg = `<svg class="arrows" style="left:${LBL}px" width="${W}" height="${y}"><defs>${mk('c', '#c4320a')}${mk('d', '#b0b7c3')}${mk('n', '#3a4252')}</defs>${paths}</svg>`;
  h +=
    `<div class="gwrap" id="gw"><div class="ginner" style="width:${LBL + W}px">` +
    overlay(R, W) +
    header(R, W, byPerson ? 'Persona / tarea' : 'Proyecto / tarea') +
    body +
    svg +
    `</div></div>`;
  const LEGH = `<div class="legend">${ps.some((p) => p.priv) ? '<span><span class="bar privb" style="position:static;display:inline-block;width:26px;height:10px;background:#c7d2fe"></span>🔒 Privado (solo tú)</span>' : ''}<span><span class="pgap" style="position:static;display:inline-block;width:26px;height:10px"></span>Pausa ya reanudada</span><span><span style="position:relative;display:inline-block;width:12px;height:16px"><span class="fcstk" style="left:5px;top:5px;height:11px"></span><span class="fcdia" style="left:1px;top:0"></span></span>Fin previsto (rombo con línea)</span><span><span class="xmark" style="position:static;display:inline-block">+</span>Jornada extra (fin de semana, festivo o día libre)</span><span><span class="pmark pause" style="position:static">⏸</span><span class="pmark cancel" style="position:static">✕</span>En pausa / cancelada desde esa fecha (plan vigente atenuado)</span><span><span style="width:26px;height:10px;background:#2f5bea40;border-radius:3px;display:inline-block;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:55%;background:#2f5bea;border-radius:3px"></i></span>Plan (relleno = avance)</span><span><span style="width:26px;height:3px;background:#3a4252;display:inline-block"></span>Fechas reales</span><span><span style="width:16px;height:10px;outline:2px solid var(--bad);display:inline-block;border-radius:3px"></span>Vencida</span><span><span class="bar blk" style="position:static;display:inline-block;width:26px;height:10px;background-color:#2f5bea40"></span>Bloqueada</span><span>→ Dependencia (fin → inicio); <b style="color:var(--bad)">roja discontinua</b> = empieza antes de que acabe la anterior</span><span><span class="tag bad">⛔ espera</span> esperando a otra tarea</span><span><span class="tag warn">⛓ n</span> bloquea a n tareas</span><span><span class="mtg" style="position:static;display:inline-block"></span>Reunión</span><span><span class="tag found">⚑</span>Detectada</span><span><span class="tag inc">!</span>Incidencia</span><span><span class="fcext" style="position:static;display:inline-block;width:26px;height:10px"></span>Hasta la fin prevista (retraso)</span><span><span style="display:inline-block;width:12px;height:12px;background:#fde2e1"></span>Festivo (todo el equipo)</span><span><span class="absmark" style="position:static;display:inline-block;width:22px;height:5px"></span>Días en que el responsable está ausente</span><span><span class="tag chg">Δ</span>Cambio</span></div>`;
  if (X)
    return {
      inner: overlay(R, W) + header(R, W, X.colTitle || 'Proyecto / tarea') + body + svg,
      legend: LEGH,
      W: LBL + W,
      H: y,
    };
  h += LEGH;
  if (byPerson)
    h +=
      `<div class="legend" style="margin-top:-6px"><span>Fila de cada persona: <span class="dot" style="background:#32d583;border-radius:2px"></span> carga semanal &lt; 85 % <span class="dot" style="background:#f79009;border-radius:2px"></span> 85–100 % <span class="dot" style="background:#f04438;border-radius:2px"></span> &gt; 100 %</span><span><span class="absband" style="position:static;display:inline-block;width:22px;height:12px"></span>Ausencia</span><span><span class="mtg" style="position:static;display:inline-block"></span>Reunión a la que asiste</span></div>` +
      loadTable(
        activeMembers().filter(
          (m) => !UI.member || (UI.member === '__me' ? m.id === myMemberId() : m.id === UI.member),
        ),
      );
  return h;
}
