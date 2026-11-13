/* ---------- vista: calendario (mensual, estilo agenda) ---------- */
const MESL2 = LA(
  [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
);
const DWL = LA(['D', 'L', 'M', 'X', 'J', 'V', 'S'], ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
const nf1 = (v) => (Math.round(v * 10) / 10).toLocaleString(LOC(), { maximumFractionDigits: 1 });
function taskHoursOn(t, d) {
  if (t.status === 'done' || inact(t) || t.priv || S.projects[t.projectId]?.priv) return 0;
  const a = dn(t.start),
    b = dn(t.end);
  if (a == null || b == null || d < a || d > b) return 0;
  if (hist(t).length && inGap(t, d)) return 0;
  const mid = t.assigneeId,
    ded = (t.dedication ?? 100) / 100;
  let h = 0;
  if (isRegM(mid, d)) h += capOf(mid) * ded;
  const ex = extraAt(mid, d);
  if (ex) h += (ex.byTask[t.id] || 0) + (isRegM(mid, d) ? 0 : ex.free * ded);
  return h;
}
function dayInfo(mid, d) {
  const reg = isRegM(mid, d),
    ex = extraAt(mid, d),
    ab = absOn(mid, d),
    hol = holOn(mid, d);
  const cap = (reg ? capOf(mid) * absAvail(ab) : 0) + (ex ? ex.h : 0);
  const ts = arr('tasks')
    .filter((t) => t.assigneeId === mid)
    .map((t) => ({ t, h: taskHoursOn(t, d) }))
    .filter((x) => x.h > 0);
  const ms = arr('meetings')
    .filter((x) => (x.attendees || []).includes(mid) && dn(x.date) === d)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const mh = ms.filter(() => isWorkM(mid, d)).reduce((a, x) => a + (+x.duration || 0) / 60, 0);
  const th = ts.reduce((a, x) => a + x.h, 0),
    tot = th + mh;
  const pct = cap > 0 ? (100 * tot) / cap : tot > 0 ? Infinity : 0;
  let st = 'free';
  if (!isWork(d) && !ex) st = 'we';
  else if (hol.length && !ex) st = 'hol';
  else if (!onSchedule(mid, d) && !ex) st = 'off';
  else if (ab && absAvail(ab) === 0 && !ex) st = 'abs';
  else if (pct > 100) st = 'over';
  else if (pct >= 85) st = 'high';
  else if (th > 0) st = 'task';
  else if (mh > 0) st = 'meet';
  return { reg, ex, ab, hol, cap, ts, ms, mh, th, tot, pct, st };
}
const CST = {
  free: '',
  task: 'Tareas',
  meet: 'Reuniones',
  high: 'Alta ocupación',
  over: 'Sobrecarga',
  abs: 'Ausencia',
  we: 'Fin de semana',
  hol: 'Festivo',
  off: 'No trabaja',
};
function calStateChip(di) {
  const m = {
    over: ['bad', 'Sobrecarga'],
    high: ['warn', 'Alta ocupación'],
    abs: ['mut', 'Ausente'],
    we: ['mut', 'No laborable'],
    hol: ['mut', 'Festivo'],
    off: ['mut', 'No trabaja'],
  }[di.st] || ['ok', 'Disponible'];
  return `<span class="tag ${m[0]}">${m[1]}</span>`;
}
function vCalendario() {
  const ms = members();
  if (!ms.length)
    return calHead('mes') + `<div class="card empty">Todavía no hay miembros en el equipo.</div>`;
  const ym = UI.calMonth || todayS().slice(0, 7);
  UI.calMonth = ym;
  const y = +ym.slice(0, 4),
    mo = +ym.slice(5, 7) - 1;
  UI.year = y;
  const s = dn(ym + '-01');
  const nd = new Date(y, mo + 1, 0).getDate();
  const e = s + nd - 1;
  const T = todayN();
  let sel = UI.calDay != null && UI.calDay >= s && UI.calDay <= e ? UI.calDay : T >= s && T <= e ? T : s;
  const one = UI.calMember && S.members[UI.calMember] ? UI.calMember : '';
  let h = calHead('mes', one);
  h += `<div class="card calcard"><div class="bar-tools" style="margin:0 0 12px"><select id="cMem"><option value="">Todo el equipo</option>${ms.map((m) => `<option value="${m.id}" ${one === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><button class="btn" id="cPrev">‹</button><b style="font-size:15px;min-width:110px;text-align:center">${MESL2[mo][0].toUpperCase() + MESL2[mo].slice(1)}</b><select id="cYear">${navYears()
    .map((x) => `<option ${x === y ? 'selected' : ''}>${x}</option>`)
    .join(
      '',
    )}</select><button class="btn" id="cNext">›</button><button class="btn" id="cToday">Hoy</button><span class="sp"></span><span class="mut" style="font-size:12px">${one ? esc(S.members[one].name) : ms.length + ' personas'} · ${nd} días</span></div>`;
  const INF = {};
  const info = (mid, d) => INF[mid + '|' + d] || (INF[mid + '|' + d] = dayInfo(mid, d));
  if (!one) {
    h += `<div class="cmx-wrap"><table class="cmx"><thead><tr><th class="cmx-n">Miembro</th>${Array.from(
      { length: nd },
      (_, i) => {
        const d = s + i,
          w = dow(d),
          ha = holAll(d);
        return `<th class="${!isWork(d) ? 'cwe' : ha.length ? 'chol' : ''} ${d === T ? 'ctoday' : ''} ${d === sel ? 'csel' : ''}" data-cd="${d}" title="${esc(fmt(iso(d)) + (ha.length ? ' · ' + ha[0].name : ''))}"><b>${i + 1}</b><small>${DWL[w]}</small></th>`;
      },
    ).join('')}</tr></thead><tbody>`;
    for (const m of ms) {
      h += `<tr><td class="cmx-n"><a href="#" data-cm="${m.id}" title="Ver su calendario">${esc(m.name)}</a><small>${esc(m.role || '')}${schedLbl(m.id) ? ' · ' + schedLbl(m.id) : ''}</small></td>`;
      for (let i = 0; i < nd; i++) {
        const d = s + i,
          di = info(m.id, d);
        let inner = '';
        if (di.st === 'we' || di.st === 'hol' || di.st === 'off') inner = '<span class="cx-d">—</span>';
        else if (di.st === 'abs')
          inner = `<b>${esc(absLabel(di.ab).split(' ')[0].slice(0, 4))}.</b><small>ausencia</small>`;
        else if (di.tot > 0) {
          const nt = di.ts.length,
            nm = di.ms.length;
          inner = `<b>${nf1(di.tot)}h</b><small>${di.st === 'over' ? 'Exceso' : nt ? nt + (nt > 1 ? ' tareas' : ' tarea') : nm + ' reun.'}</small>`;
        } else inner = '<span class="cx-d">·</span>';
        if (di.ex) inner += '<i class="cx-x" title="Jornada extra">+</i>';
        h += `<td class="cx s-${di.st} ${d === T ? 'ctoday' : ''} ${d === sel ? 'csel' : ''}" data-cd="${d}" title="${esc(m.name + ' · ' + fmt(iso(d)) + (di.cap ? ` · tareas ${nf1(di.th)} h · reuniones ${nf1(di.mh)} h · capacidad ${nf1(di.cap)} h` : '') + (di.hol.length ? ' · ' + di.hol[0].name : '') + (di.ab ? ' · ' + absLabel(di.ab) : ''))}">${inner}</td>`;
      }
      h += `</tr>`;
    }
    h += `</tbody></table></div>` + calLegend() + `</div>`;
    let kT = 0,
      kM = 0,
      kC = 0,
      kA = 0,
      kO = 0;
    for (const m of ms)
      for (let d = s; d <= e; d++) {
        const di = info(m.id, d);
        kT += di.th;
        kM += di.mh;
        kC += di.cap;
        if (di.st === 'abs') kA++;
        if (di.st === 'over') kO++;
      }
    h += `<div class="kpis cal-k"><div class="kpi"><small>Tareas del mes (horas-persona)</small><b>${nf1(kT)} h</b></div><div class="kpi"><small>Reuniones (horas-persona)</small><b>${nf1(kM)} h</b></div><div class="kpi"><small>Capacidad neta del equipo</small><b>${nf1(Math.max(0, kC - kM))} h</b></div><div class="kpi"><small>Días-persona de ausencia</small><b>${kA}</b></div><div class="kpi"><small>Días-persona con sobrecarga</small><b style="color:${kO ? 'var(--bad)' : 'inherit'}">${kO}</b></div></div>`;
    h += `<div class="card"><h3 style="margin-bottom:2px">Detalle · ${new Date(iso(sel) + 'T00:00').toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3><p class="hint" style="margin-top:0">Todo el equipo${holAll(sel).length ? ' · festivo: ' + esc(holAll(sel)[0].name) : ''}</p><div class="cdet">${ms.map((m) => calPersonCard(m.id, info(m.id, sel))).join('')}</div></div>`;
  } else {
    const first = (dow(s) + 6) % 7;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = s; d <= e; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    h += `<div class="cind"><div><div class="cmg">${WDL.map((x) => `<div class="cmg-h">${x}</div>`).join('')}${cells
      .map((d) => {
        if (d == null) return '<div class="cmg-c empty"></div>';
        const di = info(one, d);
        const pills = [];
        if (di.hol.length) pills.push(`<span class="pl hol">${esc(di.hol[0].name)}</span>`);
        if (di.ab)
          pills.push(
            `<span class="pl abs">${esc(absLabel(di.ab) + (absHours(di.ab) ? ' ' + di.ab.fromTime + '–' + di.ab.toTime : ''))}</span>`,
          );
        if (di.ex) pills.push(`<span class="pl ext">+ Jornada extra ${nf1(di.ex.h)} h</span>`);
        if (di.th > 0)
          pills.push(
            `<span class="pl ${di.st === 'over' ? 'over' : di.st === 'high' ? 'high' : 'task'}">Tareas ${nf1(di.th)} h</span>`,
          );
        if (di.ms.length)
          pills.push(
            `<span class="pl meet">${di.ms.length} ${di.ms.length > 1 ? 'reuniones' : 'reunión'}${di.ms[0].time ? ' · ' + di.ms[0].time : ''}</span>`,
          );
        return `<div class="cmg-c ${di.st === 'we' || di.st === 'hol' || di.st === 'off' ? 'cwe' : ''} ${d === T ? 'ctoday' : ''} ${d === sel ? 'csel' : ''}" data-cd="${d}"><span class="cmg-d">${+iso(d).slice(8)}</span>${pills.join('')}</div>`;
      })
      .join('')}</div>${calLegend()}</div>`;
    const di = info(one, sel);
    h += `<div class="card cside"><h3 style="margin-bottom:2px">Detalle diario</h3><p class="hint" style="margin-top:0">${esc(S.members[one].name)} · ${new Date(iso(sel) + 'T00:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="cbox"><span class="tag ${di.st === 'over' ? 'bad' : di.st === 'high' ? 'warn' : 'ok'}">${nf1(di.th)} h tareas</span> <span class="tag mut">${nf1(Math.max(0, di.cap - di.tot))} h disponibles</span> ${calStateChip(di)}<div class="hint" style="margin-top:6px">Jornada ${nf1(isRegM(one, sel) ? capOf(one) : 0)} h${di.ex ? ' + extra ' + nf1(di.ex.h) + ' h' : ''} · Reuniones ${nf1(di.mh)} h${di.ab ? ' · ' + esc(absLabel(di.ab)) : ''}${di.hol.length ? ' · ' + esc(di.hol[0].name) : ''}</div></div>
      <div style="font-weight:600;margin:12px 0 6px">Tareas activas ese día (${di.ts.length})</div>${di.ts.length ? di.ts.map(({ t, h: hh }) => calTaskItem(t, hh)).join('') : '<div class="cbox mut">Sin tareas ese día.</div>'}
      <div style="font-weight:600;margin:12px 0 6px">Reuniones (${di.ms.length})</div>${di.ms.length ? di.ms.map(calMeetItem).join('') : '<div class="cbox mut">Sin reuniones registradas.</div>'}
      ${
        ME.owner && one === myMemberId()
          ? (() => {
              const pv = arr('tasks').filter(
                (t) => t.priv && t.status !== 'done' && !inact(t) && dn(t.start) <= sel && dn(t.end) >= sel,
              );
              return pv.length
                ? `<div style="font-weight:600;margin:12px 0 6px">🔒 Privadas (fuera de jornada)</div>` +
                    pv.map((t) => calTaskItem(t, null)).join('')
                : '';
            })()
          : ''
      }</div></div>`;
    let kT = 0,
      kM = 0,
      kC = 0;
    for (let d = s; d <= e; d++) {
      const x = info(one, d);
      kT += x.th;
      kM += x.mh;
      kC += x.cap;
    }
    h += `<div class="kpis cal-k"><div class="kpi"><small>Tareas en el mes</small><b>${nf1(kT)} h</b></div><div class="kpi"><small>Reuniones</small><b>${nf1(kM)} h</b></div><div class="kpi"><small>Capacidad disponible</small><b>${nf1(kC)} h</b></div><div class="kpi"><small>Ocupación</small><b>${kC > 0 ? nf1((100 * (kT + kM)) / kC) : '0'} %</b></div></div>`;
  }
  h += `<p class="hint">Las horas muestran el <b>reparto estimado del trabajo planificado</b> (dedicación × jornada en los días de la tarea), no horas fichadas. Reuniones y ausencias descuentan capacidad; las reuniones en fin de semana o festivo son opcionales y no cuentan. Pulsa un día para ver el detalle y un nombre para ver su calendario.</p>`;
  return h;
}
function calHead(mode, one) {
  return `<div class="calhead"><div><div class="eyebrow">${one ? 'Agenda personal' : 'Agenda del equipo'}</div><h2>${mode === 'crono' ? 'Cronograma del equipo' : one ? 'Calendario de ' + esc(S.members[one].name) : 'Calendario conjunto'}</h2><p class="hint" style="margin:2px 0 0">${mode === 'crono' ? 'Tareas de cada persona en el tiempo, con su carga semanal.' : one ? 'Tareas, reuniones, ausencias y festivos de cada día, con su carga diaria.' : 'Cada fila es una persona y cada columna un día. Pulsa una celda para ver tareas y reuniones; pulsa un nombre para ver su calendario.'}</p></div><span class="sp"></span>${ME.memberId ? '<button class="btn pri" id="cMeet">+ Registrar reunión</button>' : ''}</div>`;
}
function calLegend() {
  return `<div class="legend cleg"><span><i class="lg task"></i>Tareas</span><span><i class="lg meet"></i>Reuniones</span><span><i class="lg high"></i>Alta ocupación (≥ 85 %)</span><span><i class="lg over"></i>Sobrecarga (&gt; 100 %)</span><span><i class="lg abs"></i>Ausencia</span><span><i class="lg we"></i>Fin de semana, festivo o día sin jornada</span><span><i class="cx-x" style="position:static">+</i> Jornada extra</span></div>`;
}
function calTaskItem(t, hh) {
  const p = S.projects[t.projectId];
  return `<div class="citem" data-task="${t.id}"><b>${t.priv ? '🔒 ' : ''}${esc(t.name)}</b><small>${esc(p?.code || p?.name || '')}${hh != null ? ' · ' + nf1(hh) + ' h ese día' : ''} · ${nf1(remHours(t))} h pendientes${health(t) && health(t).c !== 'ok' ? ' · ' + esc(health(t).t) : ''}</small></div>`;
}
function calMeetItem(x) {
  const p = S.projects[x.projectId];
  return `<div class="citem meet" data-meet="${x.id}"><b>${esc(x.time ? x.time + '–' + endTime(x.time, x.duration) : '')} ${esc(x.title)}</b><small>${esc(MTYPE[x.type] || '')} · ${x.duration || 0} min${p ? ' · ' + esc(p.code || p.name) : ''}</small></div>`;
}
function calPersonCard(mid, di) {
  const m = S.members[mid];
  return `<div class="cpc"><div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start"><a href="#" data-cm="${mid}"><b>${esc(m.name)}</b></a>${calStateChip(di)}</div><div class="hint" style="margin:4px 0 8px">Tareas ${nf1(di.th)} h · Reuniones ${nf1(di.mh)} h · Capacidad ${nf1(di.cap)} h</div>${di.ts.map(({ t, h }) => calTaskItem(t, h)).join('')}${di.ms.map(calMeetItem).join('')}${!di.ts.length && !di.ms.length ? '<div class="hint">Sin actividades registradas.</div>' : ''}</div>`;
}
function bindCalendar(m) {
  const go = (d) => {
    UI.calMonth = iso(d).slice(0, 7);
    render();
  };
  m.querySelectorAll('[data-cmode]').forEach(
    (b) =>
      (b.onclick = () => {
        UI.calMode = b.dataset.cmode;
        render();
      }),
  );
  if ($('#cMeet'))
    $('#cMeet').onclick = () => openMeeting(null, UI.calDay != null ? { date: iso(UI.calDay) } : {});
  if (UI.calMode === 'crono') return;
  const ym = UI.calMonth || todayS().slice(0, 7);
  const y = +ym.slice(0, 4),
    mo = +ym.slice(5, 7) - 1;
  if ($('#cPrev'))
    $('#cPrev').onclick = () => {
      const d = new Date(y, mo - 1, 1);
      setNav(d.getFullYear(), d.getMonth());
      render();
    };
  if ($('#cNext'))
    $('#cNext').onclick = () => {
      const d = new Date(y, mo + 1, 1);
      setNav(d.getFullYear(), d.getMonth());
      render();
    };
  if ($('#cToday'))
    $('#cToday').onclick = () => {
      UI.calDay = todayN();
      const d = new Date();
      setNav(d.getFullYear(), d.getMonth());
      render();
    };
  if ($('#cYear'))
    $('#cYear').onchange = (e) => {
      setNav(+e.target.value, mo);
      render();
    };
  if ($('#cMem'))
    $('#cMem').onchange = (e) => {
      UI.calMember = e.target.value;
      render();
    };
  m.querySelectorAll('[data-cd]').forEach(
    (el) =>
      (el.onclick = () => {
        UI.calDay = +el.dataset.cd;
        render();
      }),
  );
  m.querySelectorAll('[data-cm]').forEach(
    (el) =>
      (el.onclick = (e) => {
        e.preventDefault();
        UI.calMember = el.dataset.cm;
        render();
      }),
  );
}
/* ---------- vista: cronograma del equipo ---------- */
function loadTable(ms) {
  const T = todayN(),
    W0 = monday(T),
    NW = 8;
  return `<div class="card" style="margin-top:14px;overflow:auto"><h3>Carga prevista · próximas ${NW} semanas</h3><table><thead><tr><th>Miembro</th>${Array.from({ length: NW }, (_, i) => `<th style="text-align:center">${WDL[0]} ${fmt(iso(W0 + 7 * i)).slice(0, 5)}</th>`).join('')}</tr></thead><tbody>${ms
    .map((m) => {
      const w = weekLoads(m.id, T, NW);
      return `<tr><td>${who(m.id)}</td>${w.map((x) => `<td style="text-align:center">${weekTag(x)}</td>`).join('')}</tr>`;
    })
    .join(
      '',
    )}</tbody></table><p class="hint">Carga = dedicación prevista de sus tareas (en sus días de trabajo) + horas de reunión, sobre sus horas disponibles (jornada × disponibilidad: festivos 0 h, las ausencias reducen horas, las jornadas extra suman). «·A» = semana con ausencias; ∞ = tareas previstas en días sin disponibilidad. <b>Sobrecarga</b> &gt; 100 %, <b>al límite</b> 85–100 %.</p></div>`;
}
function vEquipo() {
  const R = range(),
    W = R.days * UI.ppd;
  const ms = members();
  let h = timeTools() + filterBar(false);
  if (!ms.length) return h + `<div class="card empty">Todavía no hay miembros en el equipo.</div>`;
  const tasks = arr('tasks').filter(
    (t) => (UI.proj.size === 0 || UI.proj.has(t.projectId)) && (UI.showDone || t.status !== 'done'),
  );
  const T = todayN(),
    me = myMemberId();
  h +=
    `<div class="gwrap" id="gw"><div class="ginner" style="width:${LBL + W}px">` +
    overlay(R, W) +
    header(R, W, 'Miembro · carga actual');
  for (const m of ms) {
    if (UI.member && (UI.member === '__me' ? me !== m.id : UI.member !== m.id)) continue;
    const mt = tasks
      .filter((t) => t.assigneeId === m.id)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const lanes = [];
    const placed = mt.map((t) => {
      const s = dn(t.start),
        e = dn(t.end);
      let l = lanes.findIndex((x) => x < s);
      if (l < 0) {
        l = lanes.length;
        lanes.push(e);
      } else lanes[l] = e;
      return { t, l };
    });
    const mMax = Math.max(
      0,
      ...Object.values(
        arr('meetings')
          .filter((x) => (x.attendees || []).includes(m.id))
          .reduce((a, x) => {
            a[x.date] = (a[x.date] || 0) + 1;
            return a;
          }, {}),
      ),
    );
    const nL = Math.max(1, lanes.length),
      H = Math.max(98, nL * 24 + 30 + (UI.ppd >= 18 ? Math.max(0, mMax - 1) * 15 : 0));
    const active = mt.filter((t) => t.status !== 'done' && dn(t.start) <= T && dn(t.end) >= T).length;
    const L = loadDays(m.id, R.s, R.s + R.days - 1);
    const wk = weekLoads(m.id, T, 4);
    const lvNow = loadLevel(wk[0].avg);
    const pk = wk.reduce((a, w) => (w.avg > a.avg ? w : a), wk[0]);
    const absNow = absOn(m.id, T);
    const holds = arr('tasks')
      .filter((t) => t.assigneeId === m.id)
      .flatMap((t) => blocking(t))
      .filter((s) => s.assigneeId !== m.id);
    const waits = arr('tasks').filter((t) => t.assigneeId === m.id && depBlocked(t)).length;
    const meets = arr('meetings').filter((x) => (x.attendees || []).includes(m.id));
    const ym = new Date().toISOString().slice(0, 7);
    const mh =
      meets.filter((x) => (x.date || '').startsWith(ym)).reduce((a, x) => a + (+x.duration || 0), 0) / 60;
    h += `<div class="grow" style="height:${H}px"><div class="lbl" style="flex-direction:column;align-items:flex-start;justify-content:center;gap:3px">${who(m.id)}<span class="mut" style="font-size:11.5px;padding-left:28px">${esc(m.role || '')}${m.isPM ? ' · PM' : ''} · ${active} activa${active === 1 ? '' : 's'} hoy</span><span style="font-size:11.5px;padding-left:28px">${absNow ? `<span class="tag mut" title="Hasta el ${fmt(absNow.end)}">${esc(absLabel(absNow))} hasta ${fmt(absNow.end).slice(0, 5)}</span> ` : ''}<span class="tag ${lvNow.c}" title="Media de esta semana">${fmtPct(wk[0].avg)} · ${lvNow.t}</span>${pk.avg > 100 && pk !== wk[0] ? ` <span class="tag bad" title="Pico en las próximas 4 semanas">⚠ ${fmtPct(pk.avg)} sem. ${fmt(iso(pk.start)).slice(0, 5)}</span>` : ''}</span><span class="mut" style="font-size:11.5px;padding-left:28px">${capOf(m.id)} h/día · ${mh.toFixed(1)} h de reunión este mes</span>${holds.length || waits ? `<span style="font-size:11.5px;padding-left:28px">${holds.length ? `<span class="tag warn" title="${esc(holds.map(tlabel).join(', '))}">⛓ bloquea ${holds.length} de otros</span> ` : ''}${waits ? `<span class="tag bad">⛔ espera en ${waits}</span>` : ''}</span>` : ''}</div><div class="trk" style="width:${W}px;height:${H}px">`;
    for (const a of absOf(m.id)) {
      const k = clip(R, a.s, a.e);
      if (k)
        h += `<div class="absband" style="left:${k.x}px;width:${k.w}px" title="${esc(absLabel(a) + ' · ' + absWhen(a) + (!absHours(a) && a.availability > 0 ? ' · disponible ' + a.availability + '%' : ''))}">${k.w > 60 ? `<span>${esc(absLabel(a))}</span>` : ''}</div>`;
    }
    if (memDays(m.id))
      for (let d = 0; d < R.days; d++) {
        const n = R.s + d;
        if (isWork(n) && !onSchedule(m.id, n))
          h += `<div class="absband nws" style="left:${d * UI.ppd}px;width:${Math.max(1, UI.ppd)}px" title="No trabaja este día (jornada ${schedLbl(m.id)})"></div>`;
      }
    for (let d = 0; d < R.days; d++) {
      const n = R.s + d;
      if (isWork(n) && !holAll(n).length && holOn(m.id, n).length)
        h += `<div class="absband hol" style="left:${d * UI.ppd}px;width:${Math.max(2, UI.ppd)}px" title="${esc(
          holOn(m.id, n)
            .map((x) => x.name)
            .join(', '),
        )}"></div>`;
    }
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
        h += `<div title="Semana del ${fmt(iso(monday(n)))}: ${fmtPct(v)} de sus horas disponibles" style="position:absolute;left:${d * UI.ppd}px;width:${len * UI.ppd - 1}px;bottom:0;height:5px;background:${loadBg(v)};opacity:.85;z-index:2"></div>`;
      d += len;
    }
    for (const { t, l } of placed) {
      const p = S.projects[t.projectId];
      h += taskBar(R, t, 6 + l * 24, (p?.code || p?.name || '') + ' · ');
    }
    {
      const perDay = {};
      for (const x of meets
        .slice()
        .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')))) {
        const d = dn(x.date) - R.s;
        if (d < 0 || d >= R.days) continue;
        const k = (perDay[d] = (perDay[d] || 0) + 1);
        const tip = `${x.title} · ${fmt(x.date)} ${x.time ? x.time + '–' + endTime(x.time, x.duration) : ''} · ${x.duration || 0} min${x.source === 'thunderbird' ? ' · Thunderbird' : ''}`;
        if (UI.ppd >= 18)
          h += `<div class="mpill" data-meet="${x.id}" title="${esc(tip)}" style="left:${d * UI.ppd + 1}px;width:${UI.ppd >= 40 ? UI.ppd * 1 - 2 : UI.ppd - 2}px;top:${H - 8 - k * 15}px">${UI.ppd >= 40 ? esc((x.time || '') + ' ' + x.title) : '●'}</div>`;
        else if (k === 1)
          h += `<div class="mdot" data-meet="${x.id}" title="${esc(tip)}" style="left:${d * UI.ppd + UI.ppd / 2 - 4}px;top:${H - 17}px"></div>`;
      }
    }
    h += `</div></div>`;
  }
  h += `</div></div><div class="legend"><span>Franja inferior = carga semanal: <span class="dot" style="background:#32d583;border-radius:2px"></span> &lt; 85% <span class="dot" style="background:#f79009;border-radius:2px"></span> 85–100% <span class="dot" style="background:#f04438;border-radius:2px"></span> &gt; 100% sobrecarga</span><span><span class="absband" style="position:static;display:inline-block;width:22px;height:12px"></span>Ausencia</span><span><span style="display:inline-block;width:12px;height:12px;background:#fde2e1"></span>Festivo</span><span>Barras coloreadas por miembro; el texto emergente indica el proyecto.</span><span><span class="mdot" style="position:static;display:inline-block"></span>Reunión a la que asiste (en Mes y Semana, etiqueta con hora y título; clic para abrirla)</span><span>Las tareas que se solapan se apilan: más carriles = más carga en paralelo.</span></div>`;
  const W0 = monday(T),
    NW = 8;
  h += `<div class="card" style="margin-top:14px;overflow:auto"><h3>Carga prevista · próximas ${NW} semanas</h3><table><thead><tr><th>Miembro</th>${Array.from({ length: NW }, (_, i) => `<th style="text-align:center">${WDL[0]} ${fmt(iso(W0 + 7 * i)).slice(0, 5)}</th>`).join('')}</tr></thead><tbody>${ms
    .map((m) => {
      const w = weekLoads(m.id, T, NW);
      return `<tr><td>${who(m.id)}</td>${w.map((x) => `<td style="text-align:center">${weekTag(x)}</td>`).join('')}</tr>`;
    })
    .join(
      '',
    )}</tbody></table><p class="hint">Carga = suma de la dedicación prevista de sus tareas (en sus días laborables) + horas de reunión, sobre sus horas disponibles (jornada × disponibilidad: los festivos cuentan 0 y las ausencias reducen las horas). Media de lunes a viernes; «·A» = semana con ausencias; ∞ = tareas previstas en días en que no está disponible. Se considera <b>sobrecarga</b> por encima del 100% y <b>al límite</b> entre el 85 y el 100%. La dedicación se fija en cada tarea; si no se indica, cuenta como 100%.</p></div>`;
  return h;
}

/* ---------- vista: tareas ---------- */
function vTareas() {
  let h =
    `<div class="bar-tools"><select id="sortSel">${[
      ['end', 'Ordenar por fin plan.'],
      ['fc', 'Por fin previsto'],
      ['start', 'Por inicio'],
      ['project', 'Por proyecto'],
      ['member', 'Por responsable'],
      ['health', 'Por estado de salud'],
    ]
      .map(([v, l]) => `<option value="${v}" ${UI.sort === v ? 'selected' : ''}>${l}</option>`)
      .join(
        '',
      )}</select><span class="sp"></span>${canCreateTask() ? '<button class="btn pri" id="addTask2">+ Tarea</button>' : ''}</div>` +
    filterBar();
  let ts = filtered();
  const hr = {
    'Bloqueada por dependencia': 0,
    Bloqueada: 1,
    Vencida: 2,
    Retrasada: 3,
    'Conflicto de fechas': 4,
    'En plazo': 5,
    'No iniciada': 6,
  };
  const hk = (t) => {
    const h = health(t);
    return h.fc ? 2.5 : hr[h.t];
  };
  const k = {
    end: (t) => t.end || '',
    start: (t) => t.start || '',
    project: (t) => S.projects[t.projectId]?.name || '',
    member: (t) => mem(t.assigneeId)?.name || '~',
    health: (t) => (t.status === 'done' ? 9 : hk(t)),
    fc: (t) => {
      const f = fcOf(t);
      return f.end == null ? '9999' : iso(f.end);
    },
  };
  ts.sort((a, b) => {
    const x = k[UI.sort](a),
      y = k[UI.sort](b);
    return x < y ? -1 : x > y ? 1 : (a.end || '').localeCompare(b.end || '');
  });
  if (!ts.length) return h + `<div class="card empty">No hay tareas con estos filtros.</div>`;
  h += `<div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Proyecto</th><th>Tarea</th><th>Origen</th><th>Responsable</th><th>Inicio</th><th>Fin plan.</th><th>Fin previsto</th><th>Fin real</th><th>Avance</th><th>Depende de</th><th>Estado</th><th>${ME.owner ? 'Salud / índice' : 'Salud'}</th></tr></thead><tbody>`;
  for (const t of ts) {
    const p = S.projects[t.projectId];
    const o = ORIG[t.origin] || ORIG.plan;
    const dp = preds(t)
      .map(
        (x) =>
          `<div style="white-space:nowrap">${x.status === 'done' ? '✓' : '⏳'} ${esc(x.name.length > 28 ? x.name.slice(0, 27) + '…' : x.name)} ${who(x.assigneeId, true)}</div>`,
      )
      .join('');
    h += `<tr class="click" data-task="${t.id}"><td><span class="who"><span class="dot" style="background:${esc(p?.color || '#98a2b3')}"></span>${esc(p?.code || p?.name || '—')}</span></td><td><b style="font-weight:500">${esc(t.name)}</b>${t.priority === 'alta' ? ' <span class="tag bad">alta</span>' : ''} ${depTags(t)}${projEndRisk(t) ? ` <span class="tag bad" title="Acaba o está prevista después del fin objetivo del proyecto">Fuera del plazo del proyecto</span>` : ''}</td><td><span class="tag ${o.c}">${o.t}</span></td><td>${who(t.assigneeId)}</td><td>${fmt(t.start)}</td><td>${fmt(t.end)}</td><td>${fcTag(t)}</td><td>${fmt(t.realEnd)}</td><td><div style="display:flex;gap:6px;align-items:center"><div class="pbar"><i style="width:${t.progress || 0}%"></i></div>${t.progress || 0}%</div></td><td style="font-size:12px">${dp || '<span class="mut">—</span>'}</td><td>${STAT[t.status] || 'Pendiente'}</td><td>${statusCell(t)}</td></tr>`;
  }
  return h + `</tbody></table></div>`;
}

/* ---------- vista: reuniones ---------- */
function vReuniones() {
  const ms = members();
  const per = UI.meetPeriod;
  const inPer = (x) =>
    per === 'future'
      ? (x.date || '') >= todayS()
      : per === 'all'
        ? (x.date || '').startsWith(String(UI.year))
        : (x.date || '').startsWith(per);
  const q = norm(UI.meetQ || ''),
    sel = UI.meetSel;
  const months = [];
  for (let m = 0; m < 12; m++) months.push(`${UI.year}-${String(m + 1).padStart(2, '0')}`);
  let h = `<div class="bar-tools"><button class="btn" id="yPrev">‹</button><b style="font-size:14px">${UI.year}</b><button class="btn" id="yNext">›</button><select id="perSel"><option value="future" ${per === 'future' ? 'selected' : ''}>Desde hoy (todas las futuras)</option><option value="all" ${per === 'all' ? 'selected' : ''}>Todo el año</option>${months.map((m, i) => `<option value="${m}" ${per === m ? 'selected' : ''}>${MESL[i]}</option>`).join('')}</select><select id="mmSel"><option value="">Todos los asistentes</option>${ms.map((m) => `<option value="${m.id}" ${UI.meetMember === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><input type="search" id="mQ" placeholder="🔍 Buscar por título…" title="Escribe parte del título (p. ej. «briefing») para ver solo esas reuniones; útil junto con «Seleccionar varias»" value="${esc(UI.meetQ || '')}" style="width:190px"><span class="sp"></span>${ME.memberId ? `<button class="btn ${sel ? 'pri' : ''}" id="mSelT">${sel ? 'Terminar selección' : 'Seleccionar varias'}</button>` : ''}${ME.memberId ? '<button class="btn" id="impIcs">Importar .ics</button><button class="btn pri" id="addMeet2">+ Reunión</button>' : ''}</div>`;
  const list = arr('meetings')
    .filter(inPer)
    .filter((x) => !UI.meetMember || (x.attendees || []).includes(UI.meetMember))
    .filter((x) => !q || norm(x.title).includes(q))
    .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
  let sumT = `<table><thead><tr><th>Miembro</th><th>Reuniones</th><th>Horas</th><th>Con cliente</th><th>% de jornada*</th></tr></thead><tbody>`;
  const workdays = (() => {
    let s, e;
    if (per === 'future') {
      const L = list.length ? dn(list[list.length - 1].date) : todayN();
      s = todayN();
      e = Math.max(s + 1, L + 1);
    } else if (per === 'all') {
      s = dn(UI.year + '-01-01');
      e = dn(UI.year + 1 + '-01-01');
    } else {
      s = dn(per + '-01');
      const [y, m] = per.split('-').map(Number);
      e = dn(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`);
    }
    let c = 0;
    for (let n = s; n < e; n++) {
      const w = dow(n);
      if (w && w < 6) c++;
    }
    return c;
  })();
  for (const m of ms) {
    const all_ = arr('meetings')
      .filter(inPer)
      .filter((x) => !q || norm(x.title).includes(q))
      .filter((x) => (x.attendees || []).includes(m.id));
    const mm = all_.filter((x) => isWorkM(m.id, dn(x.date)));
    const opt_ = all_.length - mm.length;
    const hrs = mm.reduce((a, x) => a + (+x.duration || 0), 0) / 60;
    const cl = mm.filter((x) => x.type === 'cliente').length;
    sumT += `<tr><td>${who(m.id)}${m.isPM ? ' <span class="tag mut">PM</span>' : ''}</td><td>${mm.length}${opt_ ? ` <span class="mut" title="Reuniones en fin de semana o festivo: opcionales, no cuentan en horas ni en la carga">+${opt_} opc.</span>` : ''}</td><td>${hrs.toFixed(1)}</td><td>${cl}</td><td>${workdays ? ((100 * hrs) / (workdays * 8)).toFixed(1) + '%' : '—'}</td></tr>`;
  }
  sumT += `</tbody></table><p class="hint">* Horas de reunión sobre ${workdays} días laborables × 8 h del periodo. Las reuniones en fin de semana o festivo son <b>opcionales</b> («opc.»): no cuentan en las horas, la carga ni las fechas previstas.</p>`;
  let lt = '';
  let cur = '';
  if (!list.length) lt = `<div class="empty">No hay reuniones registradas en este periodo.</div>`;
  for (const x of list) {
    const mk = (x.date || '').slice(0, 7);
    if (mk !== cur) {
      cur = mk;
      lt += `<div class="mhead">${MESL[+mk.slice(5, 7) - 1] || ''} ${mk.slice(0, 4)}</div>`;
    }
    const p = S.projects[x.projectId];
    const ce = canEditMeeting(x),
      on_ = sel && UI.meetPick.has(x.id);
    lt += `<div class="list-row" ${sel ? (ce ? `data-msel="${x.id}"` : 'title="No puedes modificar esta reunión"') : `data-meet="${x.id}"`} style="cursor:pointer;${on_ ? 'background:var(--accs)' : ''}${sel && !ce ? ';opacity:.5' : ''}">${sel ? `<input type="checkbox" ${on_ ? 'checked' : ''} ${ce ? '' : 'disabled'} style="width:16px;height:16px;margin:0 8px 0 0;flex:0 0 auto;pointer-events:none">` : ''}<div style="width:84px"><b>${fmt(x.date).slice(0, 5)}</b><div class="mut">${esc(x.time ? x.time + '–' + endTime(x.time, x.duration) : '')}</div></div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(x.title)}${x.seriesId ? ` <span class="tag mut" title="${esc(repeatLbl(SERIES[x.seriesId]?.repeat))}">↻ periódica</span>` : ''}${x.date && !isWork(dn(x.date)) ? ' <span class="tag warn" title="Cae en fin de semana: asistencia opcional; no cuenta en horas, carga ni fechas previstas">fin de semana · opcional</span>' : x.date && holAll(dn(x.date)).length ? ' <span class="tag warn" title="Cae en festivo: asistencia opcional; no cuenta en horas, carga ni fechas previstas">festivo · opcional</span>' : ''}${x.source === 'thunderbird' ? ' <span class="tag mut" title="Registrada desde Thunderbird">Thunderbird</span>' : x.source === 'ics' ? ' <span class="tag mut" title="Importada desde un .ics">.ics</span>' : ''}</div><div class="mut">${MTYPE[x.type] || ''} · ${x.duration || 0} min · ${p ? esc(p.code || p.name) : 'General'}</div></div><div style="display:flex;gap:2px">${(x.attendees || []).map((a) => who(a, true)).join('')}</div></div>`;
  }
  {
    const pend = arr('meetings').filter((x) => x.source === 'thunderbird' && !x.projectId && inPer(x)).length;
    if (pend)
      h += `<div class="note warn" style="margin-bottom:12px">📅 Hay <b>${pend}</b> convocatoria(s) de Thunderbird en este periodo sin proyecto asignado (etiqueta «Thunderbird» en la lista). Haz clic en cada una para asignarle proyecto y tipo.</div>`;
  }
  if (sel) {
    const vis = list.filter(canEditMeeting);
    h += `<div class="note info" style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span><b>${UI.meetPick.size}</b> reunión(es) seleccionada(s). Pulsa sobre las reuniones para marcarlas, o usa el buscador y el periodo para filtrar (por ejemplo, «briefing» + «Desde hoy»).</span><span class="sp"></span><button class="btn sm" id="mSelAll">Marcar las ${vis.length} visibles</button><button class="btn sm" id="mSelNone">Desmarcar todas</button><button class="btn sm pri" id="mSelEdit" ${UI.meetPick.size ? '' : 'disabled'}>Modificar las seleccionadas</button></div>`;
  }
  h += `<div class="grid2"><div class="card"><h3>Reuniones${q ? ` <span class="mut" style="font-weight:400">· «${esc(UI.meetQ)}»: ${list.length}</span>` : ''}</h3>${lt}</div><div class="card"><h3>Tiempo en reuniones por persona</h3>${sumT}</div></div>`;
  return h;
}

/* ---------- vista: cumplimiento ---------- */
function blocksCard(all) {
  const pairs = all.filter((t) => blocking(t).length);
  return `<div class="card"><h3>Bloqueos activos (${pairs.length})</h3>${
    pairs.length
      ? pairs
          .map(
            (t) =>
              `<div class="list-row" style="align-items:flex-start"><div style="flex:1"><div>${who(t.assigneeId, true)} <span class="tname" data-task="${t.id}" style="display:inline">${esc(t.name)}</span> <span class="mut">· fin ${fmt(t.end)} · ${t.progress || 0}%</span></div><div class="mut" style="padding-left:28px;margin-top:3px">bloquea a: ${blocking(
                t,
              )
                .map(
                  (s) =>
                    `${who(s.assigneeId, true)} <span class="tname" data-task="${s.id}" style="display:inline">${esc(s.name)}</span>`,
                )
                .join(' · ')}</div></div></div>`,
          )
          .join('')
      : '<div class="hint">Ninguna tarea está frenando a otra.</div>'
  }</div>`;
}
function vCumplimiento() {
  const all = arr('tasks').filter(
    (t) => !t.priv && (UI.proj.size === 0 || UI.proj.has(t.projectId)) && inact(t) !== 'cancelled',
  );
  const done = all.filter((t) => t.status === 'done');
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const onTime = done.filter((t) => t.realEnd && dn(t.realEnd) <= dn(t.end)).length,
    withReal = done.filter((t) => t.realEnd).length;
  const risk = all.filter(atRisk);
  const found = all.filter((t) => t.origin && t.origin !== 'plan').length;
  const blockedN = all.filter(depBlocked).length;
  const chips = `<div class="bar-tools">${projects()
    .map(
      (p) =>
        `<span class="chip ${UI.proj.has(p.id) ? 'on' : ''}" data-proj="${p.id}"><span class="dot" style="background:${esc(p.color || '#98a2b3')}"></span>${esc(p.code || p.name)}</span>`,
    )
    .join('')}<span class="sp"></span>`;
  const riskCard = `<div class="card"><h3>En riesgo (${risk.length})</h3>${
    risk.length
      ? risk
          .map((t) => {
            const x = health(t);
            return `<div class="list-row" data-task="${t.id}" style="cursor:pointer"><span style="flex:1">${esc(t.name)} <span class="mut">· fin ${fmt(t.end)} · ${t.progress || 0}%</span></span>${who(t.assigneeId, true)}<span class="tag ${x.c}">${x.t}</span></div>`;
          })
          .join('')
      : '<div class="hint">Nada en riesgo.</div>'
  }</div>`;
  const lateFc = all.filter((t) => t.status !== 'done' && fcOf(t).slip > 0).length;
  const commonK = `<div class="kpi"><small>Con retraso previsto</small><b style="color:${lateFc ? 'var(--bad)' : 'inherit'}">${lateFc}</b><small>su fin prevista es posterior a la planificada</small></div><div class="kpi"><small>Tareas completadas</small><b>${done.length} / ${all.length}</b></div><div class="kpi"><small>Entregadas a tiempo</small><b>${withReal ? Math.round((100 * onTime) / withReal) + '%' : '—'}</b><small>${onTime} de ${withReal} con fecha real</small></div><div class="kpi"><small>En riesgo ahora</small><b style="color:${risk.length ? 'var(--bad)' : 'inherit'}">${risk.length}</b><small>bloqueadas, vencidas o retrasadas</small></div><div class="kpi"><small>Esperando a otra tarea</small><b style="color:${blockedN ? 'var(--bad)' : 'inherit'}">${blockedN}</b><small>bloqueadas por dependencias</small></div><div class="kpi"><small>En sobrecarga (4 semanas)</small><b style="color:${overloaded().length ? 'var(--bad)' : 'inherit'}">${overloaded().length}</b><small>${
    overloaded()
      .map((m) => esc(m.name))
      .join(', ') || 'nadie por encima del 100%'
  }</small></div><div class="kpi"><small>No planificadas</small><b>${found}</b><small>detectadas, incidencias o cambios (${all.length ? Math.round((100 * found) / all.length) : 0}%)</small></div>`;
  if (!ME.owner) {
    return (
      chips +
      `<span class="hint">Las evaluaciones de calidad solo las ve el project manager.</span></div><div class="kpis">${commonK}</div><div class="grid2">${blocksCard(all)}${riskCard}</div>`
    );
  }
  const ev = done.map((t) => ({ t, s: score(t) })).filter((x) => x.s);
  const gi = avg(ev.map((x) => x.s.total));
  const lv = level(gi);
  const w = weights();
  let h =
    chips +
    `<span class="hint">🔒 Solo tú (PM) ves esta sección de evaluación. Índice = Plazo ${w.plazo}% · Calidad ${w.calidad}% · Alcance ${w.alcance}% · Retrabajo ${w.retrabajo}%</span></div>`;
  h += `<div class="kpis"><div class="kpi"><small>Índice de calidad de cumplimiento 🔒</small><b>${gi == null ? '—' : Math.round(gi)}</b><span class="tag ${lv.c}">${lv.t}</span> <small>${ev.length} evaluadas</small></div>${commonK}</div>`;
  const row = (label, ts) => {
    const d = ts.filter((t) => t.status === 'done');
    const e = d.map((t) => score(t)).filter(Boolean);
    const g = avg(e.map((s) => s.total));
    const l = level(g);
    const rk = ts.filter(atRisk).length;
    return `<tr><td>${label}</td><td>${d.length}/${ts.length}</td><td>${pct(avg(e.map((s) => s.plazo)))}</td><td>${pct(avg(e.map((s) => s.calidad)))}</td><td>${pct(avg(e.map((s) => s.alcance)))}</td><td>${pct(avg(e.map((s) => s.retrabajo)))}</td><td>${rk || ''}</td><td><b>${g == null ? '—' : Math.round(g)}</b> <span class="tag ${l.c}">${l.t}</span></td></tr>`;
  };
  const th = `<thead><tr><th></th><th>Hechas</th><th>Plazo</th><th>Calidad</th><th>Alcance</th><th>Retrabajo</th><th>En riesgo</th><th>Índice</th></tr></thead>`;
  h += `<div class="grid2"><div class="card" style="overflow:auto"><h3>Por miembro del equipo 🔒</h3><table>${th}<tbody>${members()
    .map((m) =>
      row(
        who(m.id),
        all.filter((t) => t.assigneeId === m.id),
      ),
    )
    .join('')}</tbody></table></div>`;
  h += `<div class="card" style="overflow:auto"><h3>Por proyecto 🔒</h3><table>${th}<tbody>${projects()
    .filter((p) => UI.proj.size === 0 || UI.proj.has(p.id))
    .map((p) =>
      row(
        `<span class="who"><span class="dot" style="background:${esc(p.color || '#98a2b3')}"></span>${esc(p.code || p.name)}</span>`,
        all.filter((t) => t.projectId === p.id),
      ),
    )
    .join('')}</tbody></table></div></div>`;
  const pend = done.filter((t) => !score(t));
  h += `<div class="grid2" style="margin-top:14px">${blocksCard(all)}${riskCard}</div>`;
  h += `<div class="grid2" style="margin-top:14px"><div class="card"><h3>Completadas pendientes de evaluar (${pend.length})</h3>${pend.length ? pend.map((t) => `<div class="list-row"><span style="flex:1">${esc(t.name)} <span class="mut">· ${esc(S.projects[t.projectId]?.code || '')}</span></span>${who(t.assigneeId, true)}<button class="btn sm" data-task="${t.id}">Evaluar</button></div>`).join('') : '<div class="hint">Todo evaluado.</div>'}</div><div></div></div>`;
  h += `<div class="card" style="margin-top:14px;overflow:auto"><h3>Detalle de tareas evaluadas 🔒</h3>${
    ev.length
      ? `<table><thead><tr><th>Tarea</th><th>Responsable</th><th>Retraso</th><th>Plazo</th><th>Calidad</th><th>Alcance</th><th>Retrabajo</th><th>Índice</th><th>Comentario</th></tr></thead><tbody>${ev
          .sort((a, b) => a.s.total - b.s.total)
          .map(({ t, s }) => {
            const l = level(s.total);
            const e = S.evals[t.id];
            return `<tr class="click" data-task="${t.id}"><td>${esc(t.name)}</td><td>${who(t.assigneeId)}</td><td>${s.late ? s.late + ' d' : '—'}</td><td>${pct(s.plazo)}</td><td>${'★'.repeat(e.quality)}<span style="color:#d0d5dd">${'★'.repeat(5 - e.quality)}</span></td><td>${pct(s.alcance)}</td><td>${e.rework || 0}</td><td><b>${Math.round(s.total)}</b> <span class="tag ${l.c}">${l.t}</span></td><td class="mut">${esc(e.notes || '')}</td></tr>`;
          })
          .join('')}</tbody></table>`
      : '<div class="hint">Cuando una tarea se completa, evalúala desde su ficha: calidad (1–5), alcance entregado y nº de retrabajos. El plazo se calcula a partir de la fecha real de fin.</div>'
  }</div>`;
  return h;
}

/* ---------- vista: ausencias y festivos ---------- */
function vAusencias() {
  const y = UI.year,
    ys = dn(y + '-01-01'),
    ye = dn(y + 1 + '-01-01') - 1,
    ms = members();
  let h =
    `<div class="bar-tools"><button class="btn" id="yPrev">‹</button><b style="font-size:14px">${y}</b><button class="btn" id="yNext">›</button><select id="aMem"><option value="">Todo el equipo</option>${ms.map((m) => `<option value="${m.id}" ${UI.member === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><span class="sp"></span>${ME.memberId ? '<button class="btn pri" id="addAbs">+ Ausencia</button><button class="btn" id="addExt" title="Un día que alguien trabaja fuera de su jornada: sábado, domingo, festivo o día libre">+ Jornada extra</button>' : ''}${ME.owner ? '<button class="btn" id="impHol">Importar festivos (BOCM)</button><button class="btn" id="addHol">+ Festivo</button>' : ''}</div>` +
    gapsNote();
  const list = arr('absences')
    .filter((a) => a.start <= iso(ye) && a.end >= iso(ys) && (!UI.member || a.memberId === UI.member))
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  h += `<div class="grid2"><div class="card" style="overflow:auto"><h3>Ausencias ${y}</h3>${
    list.length
      ? `<table><thead><tr><th>Persona</th><th>Tipo</th><th>Desde</th><th>Hasta / horario</th><th>Días lab.</th><th>Disponible</th><th>Nota</th></tr></thead><tbody>${list
          .map((a) => {
            const s = Math.max(dn(a.start), ys),
              e = Math.min(dn(a.end), ye);
            return `<tr class="click" data-abs="${a.id}"><td>${who(a.memberId)}</td><td><span class="tag mut" style="border-left:3px solid ${ABS[a.type]?.c || '#667085'}">${esc(absLabel(a))}</span></td><td>${fmt(a.start)}</td><td>${absHours(a) ? a.fromTime + '–' + a.toTime : fmt(a.end)}</td><td>${absHours(a) ? nf1(absHours(a)) + ' h' : workDays(a.memberId, s, e)}</td><td>${absPrivate(a) ? '—' : Math.round(absAvail(a) * 100) + '%'}</td><td class="mut">${absPrivate(a) ? '' : esc(a.note || '')}</td></tr>`;
          })
          .join('')}</tbody></table>`
      : '<div class="hint">Sin ausencias registradas en este año.</div>'
  }</div>`;
  const cols = [
    ['vac', 'Vacaciones'],
    ['viaje', 'Viajes'],
    ['congreso', 'Congresos'],
    ['otras', 'Otras'],
  ];
  h += `<div class="card" style="overflow:auto"><h3>Días laborables de ausencia por persona · ${y}</h3><table><thead><tr><th>Persona</th>${cols.map((c) => `<th style="text-align:center">${c[1]}</th>`).join('')}<th style="text-align:center">Total</th></tr></thead><tbody>${ms
    .map((m) => {
      const c = { vac: 0, viaje: 0, congreso: 0, otras: 0 };
      for (const a of absOf(m.id)) {
        const s = Math.max(a.s, ys),
          e = Math.min(a.e, ye);
        if (e < s) continue;
        const k = ['vac', 'viaje', 'congreso'].includes(a.type) ? a.type : 'otras';
        // an absence by hours counts as the fraction of the working day it takes
        c[k] += workDays(m.id, s, e) * (absHours(a) ? Math.min(1, absHours(a) / capOf(m.id)) : 1);
      }
      for (const k in c) c[k] = Math.round(c[k] * 100) / 100;
      const tot = Math.round((c.vac + c.viaje + c.congreso + c.otras) * 100) / 100;
      return `<tr><td>${who(m.id, true)} ${esc(String(m.name || '').split(' ')[0])}</td>${cols.map((k) => `<td style="text-align:center">${c[k[0]] || '<span class="mut">0</span>'}</td>`).join('')}<td style="text-align:center"><b>${tot}</b></td></tr>`;
    })
    .join(
      '',
    )}</tbody></table><p class="hint">Cuenta solo días laborables: no incluye fines de semana ni festivos.</p></div></div>`;
  const hol = arr('holidays')
    .filter((x) => (x.date || '').startsWith(String(y)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const DW = LAx(
    ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  );
  {
    const xs = arr('extras')
      .filter((x) => (x.date || '').startsWith(String(y)) && (!UI.member || x.memberId === UI.member))
      .sort((a, b) => a.date.localeCompare(b.date));
    h += `<div class="card" style="margin-top:14px;overflow:auto"><h3>Jornadas extra ${y} <span class="mut" style="font-weight:400">· días trabajados fuera de la jornada (fin de semana, festivo o día libre)</span></h3>${
      xs.length
        ? `<table><thead><tr><th>Persona</th><th>Día</th><th>Horas</th><th>Para</th><th>Nota</th></tr></thead><tbody>${xs
            .map((x) => {
              const t = x.taskId ? tk(x.taskId) : null;
              return `<tr data-ext="${x.id}" style="cursor:pointer"><td>${who(x.memberId)}</td><td>${DW[dow(dn(x.date))]} ${fmt(x.date)}${isRegM(x.memberId, dn(x.date)) ? ' <span class="tag mut" title="Es un día normal de su jornada: se suman como horas extra">horas extra</span>' : ''}</td><td>${x.hours} h</td><td>${t ? esc(t.name) : '<span class="mut">sus tareas en curso</span>'}</td><td class="mut">${esc(x.note || '')}</td></tr>`;
            })
            .join('')}</tbody></table>`
        : '<p class="hint">Si alguien trabaja puntualmente un sábado, domingo o festivo (o un día que no le toca), regístralo con «+ Jornada extra»: esas horas cuentan en su carga y adelantan la fecha prevista de la tarea elegida.</p>'
    }</div>`;
  }
  h += `<div class="card" style="margin-top:14px;overflow:auto"><h3 style="display:flex;align-items:center;gap:8px">Festivos ${y} <span class="mut" style="font-weight:400">(${hol.filter((x) => isWork(dn(x.date))).length} en día laborable)</span><span class="sp"></span>${ME.owner && hol.length ? `<button class="btn sm" id="copyHol">Copiar los de fecha fija a ${y + 1}</button>` : ''}</h3>${
    hol.length
      ? `<table><thead><tr><th>Fecha</th><th>Día</th><th>Festivo</th><th>Ámbito</th><th>Aplica a</th><th>Fuente</th></tr></thead><tbody>${hol
          .map((x) => {
            const d = dn(x.date),
              we = !isWork(d);
            return `<tr ${ME.owner ? `class="click" data-hol="${x.id}"` : ''}><td><b>${fmt(x.date)}</b></td><td class="${we ? 'mut' : ''}">${DW[dow(d)]}${we ? ' (fin de semana)' : ''}</td><td>${esc(x.name)}${x.fixed ? '' : ' <span class="tag mut" title="Fecha que cambia cada año">variable</span>'}</td><td>${esc(holScopeLabel(x))}</td><td>${(() => {
              const ms = members();
              const ap = ms.filter((m) => holApplies(x, m.id));
              return ap.length === ms.length
                ? '<span class="mut">Todo el equipo</span>'
                : ap.length
                  ? ap.map((m) => who(m.id, true)).join('')
                  : '<span class="mut">Nadie del equipo</span>';
            })()}</td><td>${x.source ? `<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.sourceName || 'fuente')}</a>` : ''}</td></tr>`;
          })
          .join('')}</tbody></table>`
      : `<div class="hint">No hay festivos registrados para ${y}.${ME.owner ? ' Añádelos con «+ Festivo».' : ''}</div>`
  }<p class="hint">Los festivos no cuentan como días laborables: se sombrean en el Gantt y en el calendario, no suman carga y no cuentan en el cálculo del plazo. Cada persona tiene los festivos nacionales, los autonómicos de su comunidad y los locales del municipio de su centro de trabajo (se asigna en su ficha). Los festivos locales de otros municipios se añaden con «+ Festivo» eligiendo el ámbito «Local».</p></div>`;
  return h;
}
function openExtra(id) {
  const x = id
    ? { ...S.extras[id] }
    : {
        memberId: ME.owner ? UI.member || ME.memberId : ME.memberId,
        date: todayS(),
        hours: '',
        taskId: '',
        note: '',
      };
  const editable = ME.owner || (!!ME.memberId && x.memberId === ME.memberId);
  const tasksOf = (mid) =>
    arr('tasks')
      .filter((t) => t.assigneeId === mid && t.status !== 'done' && !inact(t) && !t.priv)
      .sort((a, b) => String(a.name).localeCompare(b.name));
  const body = `<label>Persona<select id="xM" ${ME.owner ? '' : 'disabled'}>${opt(
    members().map((m) => [m.id, m.name]),
    x.memberId,
  )}</select></label>
   <label>Día<input type="date" id="xD" value="${esc(x.date)}"></label>
   <label>Horas trabajadas<input type="number" id="xH" min="0.5" max="16" step="0.5" value="${esc(x.hours || capOf(x.memberId))}"></label>
   <label>Para la tarea (opcional)<select id="xT"></select></label>
   <label class="full">Nota<input type="text" id="xN" value="${esc(x.note || '')}" placeholder="p. ej. despliegue en producción fuera de horario"></label>
   <div class="full hint" id="xInfo"></div>`;
  openDlg(
    id ? 'Jornada extra' : 'Nueva jornada extra',
    body,
    async () => {
      const o = {
        memberId: val('xM'),
        date: val('xD'),
        hours: +val('xH') || 0,
        taskId: val('xT'),
        note: val('xN'),
      };
      if (!o.date || !(o.hours > 0)) {
        toast('Indica el día y las horas.');
        return false;
      }
      if (!(await save('extras', id, o))) return false;
    },
    id && editable ? () => del('extras', id) : null,
    editable,
  );
  const fill = () => {
    const mid = val('xM');
    const ts = tasksOf(mid);
    $('#xT').innerHTML =
      `<option value="">— Sus tareas en curso (reparto normal) —</option>` +
      ts
        .map(
          (t) =>
            `<option value="${t.id}" ${t.id === x.taskId ? 'selected' : ''}>${esc((S.projects[t.projectId]?.code ? S.projects[t.projectId].code + ' · ' : '') + t.name)}</option>`,
        )
        .join('');
    info();
  };
  const info = () => {
    const d = dn(val('xD'));
    const mid = val('xM');
    if (d == null) {
      $('#xInfo').textContent = '';
      return;
    }
    const reg = isRegM(mid, d);
    const hl = holOn(mid, d);
    $('#xInfo').innerHTML =
      (reg
        ? 'Es un día normal de su jornada: estas horas se suman como <b>horas extra</b> a su capacidad de ese día.'
        : `Es ${!isWork(d) ? 'fin de semana' : hl.length ? 'festivo (' + esc(hl[0].name) + ')' : 'un día que no le toca trabajar'}: ese día pasa a contar como laborable para esta persona, con estas horas.`) +
      ' Si eliges una tarea, todas las horas van a esa tarea (adelantan su fecha prevista); si no, se reparten entre sus tareas en curso.';
  };
  $('#xM').onchange = fill;
  $('#xD').onchange = info;
  fill();
}
function openAbsence(id, defs = {}) {
  const a = id
    ? { ...S.absences[id] }
    : {
        memberId: ME.owner ? UI.member || ME.memberId : ME.memberId,
        type: 'vac',
        start: todayS(),
        end: todayS(),
        availability: 0,
        ...defs,
      };
  const editable = ME.owner || (!!ME.memberId && a.memberId === ME.memberId);
  const priv = id && absPrivate(a);
  let byH = !!absHours(a);
  const body = `<label>Persona${ME.owner ? '' : ' <span class="mut" style="font-weight:400">(solo puedes registrar las tuyas)</span>'}<select id="aM" ${ME.owner ? '' : 'disabled'}>${opt(
    members().map((m) => [m.id, m.name]),
    a.memberId,
  )}</select></label>
   <label>Tipo<select id="aT">${
     priv
       ? '<option>Ausente</option>'
       : opt(
           Object.entries(ABS).map(([k, v]) => [k, v.t]),
           a.type,
         )
   }</select></label>
   <div class="full"><div class="seg" id="aMode"><button type="button" data-am="days" class="${byH ? '' : 'on'}">Días completos</button><button type="button" data-am="hours" class="${byH ? 'on' : ''}">Por horas</button></div></div>
   <label><span id="aSl">Desde</span><input type="date" id="aS" value="${esc(a.start)}"></label>
   <label class="amD">Hasta (incluido)<input type="date" id="aE" value="${esc(a.end)}"></label>
   <label class="amD">Disponibilidad durante la ausencia (%)<input type="number" min="0" max="100" step="10" id="aA" value="${priv ? 0 : +a.availability || 0}"></label>
   <div class="amH" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Desde las<input type="time" id="aF" value="${esc(a.fromTime || '10:00')}"></label><label>Hasta las<input type="time" id="aU" value="${esc(a.toTime || '12:00')}"></label></div>
   <div class="hint" id="aInfo" style="align-self:end;padding-bottom:8px"></div>
   <label class="full" id="aNw">Nota (opcional)<input type="text" id="aN" value="${esc(priv ? '' : a.note || '')}" placeholder="Destino, congreso, motivo…"></label>
   <div class="full" id="aWarn" style="display:contents"></div>`;
  openDlg(
    id ? (editable ? 'Editar ausencia' : 'Ausencia') : 'Nueva ausencia',
    body,
    async () => {
      const o = {
        memberId: ME.owner ? val('aM') : a.memberId,
        type: val('aT'),
        start: val('aS'),
        end: val('aE'),
        availability: Math.min(100, Math.max(0, +$('#aA').value || 0)),
        note: val('aT') === 'baja' ? '' : val('aN'),
        updatedAt: new Date().toISOString(),
      };
      if (!o.memberId) {
        toast('Elige la persona.');
        return false;
      }
      if (byH) {
        const f = hm2min(val('aF')),
          u = hm2min(val('aU'));
        if (f == null || u == null || u <= f) {
          toast('La hora de fin debe ser posterior a la de inicio.');
          return false;
        }
        o.end = o.start;
        o.fromTime = val('aF');
        o.toTime = val('aU');
        // also stored as a percentage, so older copies of the tool still calculate it right
        o.availability = Math.round(Math.max(0, 1 - (u - f) / 60 / capOf(o.memberId)) * 100);
      }
      if (!o.start || !o.end || o.end < o.start) {
        toast('Revisa las fechas.');
        return false;
      }
      const s = dn(o.start),
        e = dn(o.end);
      if (absOf(o.memberId).some((x) => x.id !== id && x.s <= e && x.e >= s)) {
        toast('Ya hay otra ausencia de esa persona en esas fechas.');
        return false;
      }
      if (!(await save('absences', id, o))) return false;
    },
    id && editable ? () => del('absences', id) : null,
    editable && !priv,
  );
  const showMode = () => {
    document.querySelectorAll('.amD').forEach((x) => (x.style.display = byH ? 'none' : ''));
    document.querySelectorAll('.amH').forEach((x) => (x.style.display = byH ? 'grid' : 'none'));
    $('#aSl').textContent = byH ? 'Día' : 'Desde';
    if (byH) $('#aE').value = val('aS');
  };
  showMode();
  const upd = () => {
    const t = val('aT'),
      mid = ME.owner ? val('aM') : a.memberId;
    $('#aNw').style.display = t === 'baja' ? 'none' : '';
    const s = dn(val('aS')),
      e = dn(val('aE'));
    let info = '',
      w = '';
    showMode();
    const hf = hm2min(val('aF')),
      hu = hm2min(val('aU'));
    if (byH && s != null) {
      if (hf != null && hu > hf)
        info = `${nf1((hu - hf) / 60)} h de ausencia · quedan ${nf1(Math.max(0, capOf(mid) - (hu - hf) / 60))} h de su jornada`;
    } else if (s != null && e != null && e >= s) {
      info = `${workDays(mid, s, e)} días laborables`;
      const ts = arr('tasks').filter(
        (x) => x.assigneeId === mid && x.status !== 'done' && dn(x.start) <= e && dn(x.end) >= s,
      );
      if (ts.length)
        w += `<div class="note warn">En esas fechas tiene ${ts.length} tarea${ts.length > 1 ? 's' : ''} prevista${ts.length > 1 ? 's' : ''}: ${ts
          .slice(0, 5)
          .map((x) => `<b>${esc(x.name)}</b> (${fmt(x.start)}–${fmt(x.end)})`)
          .join(', ')}${ts.length > 5 ? '…' : ''}. Revisa fechas o reasigna si hace falta.</div>`;
    }
    if (t === 'baja')
      w +=
        '<div class="note info">El resto del equipo solo verá «Ausente», sin el tipo ni la nota. No escribas datos médicos.</div>';
    $('#aInfo').textContent = info;
    $('#aWarn').innerHTML = w;
  };
  if (!priv) {
    $('#aT').onchange = () => {
      $('#aA').value = ABS[val('aT')]?.a ?? 0;
      upd();
    };
    ['aS', 'aE', 'aM', 'aF', 'aU'].forEach((i) => $('#' + i).addEventListener('change', upd));
    $('#aMode').onclick = (ev) => {
      const b = ev.target.closest('[data-am]');
      if (!b) return;
      byH = b.dataset.am === 'hours';
      $('#aMode')
        .querySelectorAll('button')
        .forEach((x) => x.classList.toggle('on', x === b));
      upd();
    };
    upd();
  }
}
function openHoliday(id) {
  if (!ME.owner) return;
  const x = id
    ? { ...S.holidays[id] }
    : {
        date: todayS(),
        scope: 'local',
        municipality: centers()[0]?.municipality || '',
        memberIds: [],
        centerIds: [],
        fixed: false,
      };
  let sel = new Set(x.memberIds || []),
    cs = new Set(x.centerIds || []);
  const munis = [
    ...new Set(
      centers()
        .map((c) => c.municipality)
        .filter(Boolean),
    ),
  ];
  const body = `<label>Fecha<input type="date" id="hD" value="${esc(x.date)}"></label>
   <label>Nombre<input type="text" id="hN" value="${esc(x.name)}" placeholder="p. ej. Fiesta local"></label>
   <label>Ámbito<select id="hS">${opt(Object.entries(HSCOPE), x.scope)}</select></label>
   <label id="hMw">Municipio<input type="text" id="hMu" list="hMuL" value="${esc(holMuni(x))}" placeholder="p. ej. Fuenlabrada"><datalist id="hMuL">${munis.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label>
   <div class="full" id="hCw"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Centros <span class="mut" style="font-weight:400">(ninguno marcado = todos)</span></div><div id="hC" style="display:flex;gap:6px;flex-wrap:wrap">${centers()
     .map(
       (c) => `<span class="chip ${cs.has(c.id) ? 'on' : ''}" data-hc="${esc(c.id)}">${esc(c.name)}</span>`,
     )
     .join('')}</div></div>
   <label style="flex-direction:row;align-items:center;gap:8px;margin-top:6px" class="full"><input type="checkbox" id="hF" ${x.fixed ? 'checked' : ''} style="width:auto"> Fecha fija cada año (se puede copiar al año siguiente)</label>
   <div class="full"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Excepción: aplicar solo a estas personas <span class="mut" style="font-weight:400">(normalmente vacío)</span></div><div id="hM" style="display:flex;gap:6px;flex-wrap:wrap">${members()
     .map((m) => `<span class="chip ${sel.has(m.id) ? 'on' : ''}" data-hm="${m.id}">${who(m.id)}</span>`)
     .join('')}</div></div>
   <div class="full hint" id="hWho"></div>
   <label class="full">Fuente (enlace, opcional)<input type="text" id="hU" value="${esc(x.source || '')}" placeholder="https://…"></label>`;
  const cur = () => ({
    date: val('hD'),
    name: val('hN'),
    scope: val('hS'),
    municipality: val('hS') === 'local' ? val('hMu') : '',
    centerIds: val('hS') === 'empresa' ? [...cs] : [],
    region: val('hS') === 'comunidad' ? 'Comunidad de Madrid' : '',
    fixed: $('#hF').checked,
    memberIds: [...sel],
    source: val('hU'),
    sourceName: x.sourceName || (val('hU') ? 'fuente' : ''),
  });
  const upd = () => {
    const sc = val('hS');
    $('#hMw').style.display = sc === 'local' ? '' : 'none';
    $('#hCw').style.display = sc === 'empresa' ? '' : 'none';
    const o = cur(),
      ap = members().filter((m) => holApplies(o, m.id));
    $('#hWho').innerHTML =
      `Se aplica a: ${ap.length ? ap.map((m) => esc(m.name)).join(', ') : '<b>nadie del equipo</b> (ningún centro está en ese municipio)'}`;
  };
  openDlg(
    id ? 'Editar festivo' : 'Nuevo festivo',
    body,
    async () => {
      const o = cur();
      if (!o.date || !o.name) {
        toast('Indica fecha y nombre.');
        return false;
      }
      if (o.scope === 'local' && !o.municipality) {
        toast('Indica el municipio del festivo local.');
        return false;
      }
      if (!(await save('holidays', id, o))) return false;
    },
    id ? () => del('holidays', id) : null,
  );
  $('#hM')
    .querySelectorAll('[data-hm]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          const k = c.dataset.hm;
          sel.has(k) ? sel.delete(k) : sel.add(k);
          c.classList.toggle('on');
          upd();
        }),
    );
  $('#hC')
    .querySelectorAll('[data-hc]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          const k = c.dataset.hc;
          cs.has(k) ? cs.delete(k) : cs.add(k);
          c.classList.toggle('on');
          upd();
        }),
    );
  ['hS', 'hMu'].forEach((i) => $('#' + i).addEventListener('input', upd));
  $('#hS').addEventListener('change', upd);
  upd();
}
function openCenter(idx) {
  if (!ME.owner) return;
  const list = centers().map((c) => ({ ...c }));
  const c =
    idx != null
      ? list[idx]
      : { id: 'c' + Date.now().toString(36), name: '', municipality: '', region: 'Comunidad de Madrid' };
  const body = `<label>Nombre del centro<input type="text" id="cN" value="${esc(c.name)}" placeholder="p. ej. Sede Fuenlabrada"></label>
   <label>Municipio<input type="text" id="cM" value="${esc(c.municipality)}" placeholder="p. ej. Fuenlabrada"></label>
   <label class="full">Comunidad autónoma<input type="text" id="cR" value="${esc(c.region || 'Comunidad de Madrid')}" disabled></label>
   <div class="full hint">Por ahora todos los centros están en la Comunidad de Madrid. El municipio decide qué festivos locales se aplican a las personas de este centro.</div>`;
  openDlg(
    idx != null ? 'Editar centro de trabajo' : 'Nuevo centro de trabajo',
    body,
    async () => {
      const o = { ...c, name: val('cN'), municipality: val('cM'), region: 'Comunidad de Madrid' };
      if (!o.name || !o.municipality) {
        toast('Indica nombre y municipio.');
        return false;
      }
      if (idx != null) list[idx] = o;
      else list.push(o);
      if (!(await save('config', 'settings', { ...(S.config.settings || {}), centers: list }))) return false;
    },
    idx != null && list.length > 1
      ? async () => {
          if (members().some((m) => (m.centerId || list[0].id) === c.id)) {
            toast('Hay personas en este centro: cámbialas de centro antes.');
            return;
          }
          list.splice(idx, 1);
          await save('config', 'settings', { ...(S.config.settings || {}), centers: list });
        }
      : null,
  );
}
