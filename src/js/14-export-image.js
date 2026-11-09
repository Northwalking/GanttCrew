/* ---------- exportar Gantt como imagen (el mismo diagrama, a otra escala) ---------- */
const XSCALE = [
  ['18', 'Días'],
  ['6', 'Semanas'],
  ['3', 'Meses'],
  ['1', 'Trimestres'],
];
async function domToPng(el, scale = 2) {
  const w = Math.ceil(el.scrollWidth),
    h = Math.ceil(el.scrollHeight);
  const wrap = document.createElement('div');
  wrap.setAttribute(
    'style',
    `font-family:${getComputedStyle(document.body).fontFamily};font-size:13px;color:#101828;background:#fff;width:${w}px;height:${h}px`,
  );
  const st = document.createElement('style');
  st.textContent = [...document.querySelectorAll('style')].map((x) => x.textContent).join('\n');
  wrap.append(st, el.cloneNode(true));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.scale(scale, scale);
  c.drawImage(img, 0, 0);
  return cv;
}
function openExportGantt(pid) {
  const ps = projects();
  if (!ps.length) {
    toast('No hay proyectos.');
    return;
  }
  pid = pid && S.projects[pid] ? pid : UI.proj.size === 1 ? [...UI.proj][0] : ps[0].id;
  const st = { pid, sel: new Set() };
  const body = `<div class="full" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px 12px">
     <label style="grid-column:span 2">Proyecto<select id="xP"><option value="__all">Todos los proyectos${ps.some((p) => p.priv) ? ' (sin los privados)' : ''}</option>${ps.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc((p.priv ? '🔒 ' : '') + (p.code ? p.code + ' · ' : '') + p.name)}</option>`).join('')}</select></label>
     <label>Escala<select id="xG">${XSCALE.map(([v, l]) => `<option value="${v}" ${v === '6' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
     <label>Fecha del informe<input type="date" id="xF" value="${todayS()}"></label>
     <label style="grid-column:span 2">Título<input type="text" id="xT" placeholder="por defecto, el nombre del proyecto"></label>
     <label>Desde<input type="date" id="xA"></label><label>Hasta<input type="date" id="xB"></label>
     <label style="grid-column:span 2">Fase (opcional, aparece en el título)<input type="text" id="xPh" placeholder="p. ej. Fase 2 · Desarrollo"></label>
     <div style="grid-column:span 2;display:flex;gap:14px;align-items:end;font-size:12.5px">
       <label style="flex-direction:row;gap:6px;align-items:center;font-weight:400"><input type="checkbox" id="xL" checked style="width:auto"> Leyenda</label>
       <label style="flex-direction:row;gap:6px;align-items:center;font-weight:400"><input type="checkbox" id="xI" checked style="width:auto"> Cabecera con avance y fecha</label></div></div>
   <div class="full"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:4px;display:flex;gap:8px;align-items:center">Tareas que se incluyen <span class="mut" style="font-weight:400">(desmarca para exportar solo una fase)</span><span class="sp"></span><button type="button" class="btn sm" id="xAll">Todas</button><button type="button" class="btn sm" id="xNone">Ninguna</button></div><div id="xTs" style="max-height:140px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px 8px"></div></div>
   <div class="full" style="display:flex;gap:8px;align-items:center"><button type="button" class="btn pri" id="xCopy">Copiar imagen</button><button type="button" class="btn" id="xPng">Descargar PNG</button><span class="hint" id="xMsg"></span></div>
   <div class="full" style="overflow:auto;border:1px solid var(--line);border-radius:8px;background:#f6f7f9;padding:8px;max-height:52vh"><div id="xPv"></div></div>`;
  openDlg('Exportar diagrama Gantt como imagen', body, null, null, true);
  $('#dlg').style.width = 'min(1180px,100%)';
  const pids = () =>
    st.pid === '__all' ? new Set(ps.filter((p) => !p.priv).map((p) => p.id)) : new Set([st.pid]);
  const tasksOf = () => {
    const P = pids();
    return arr('tasks')
      .filter((t) => P.has(t.projectId))
      .sort(
        (a, b) =>
          (P.size > 1
            ? String(S.projects[a.projectId]?.name).localeCompare(String(S.projects[b.projectId]?.name))
            : 0) || String(a.start).localeCompare(String(b.start)),
      );
  };
  const fillTasks = () => {
    const ts = tasksOf();
    st.sel = new Set(ts.filter((t) => inact(t) !== 'cancelled').map((t) => t.id));
    $('#xTs').innerHTML = ts.length
      ? ts
          .map(
            (t) =>
              `<div style="display:flex;gap:8px;align-items:center;margin:2px 0;font-size:12.5px"><input type="checkbox" data-xt="${t.id}" ${st.sel.has(t.id) ? 'checked' : ''} style="width:16px;height:16px;margin:0;flex:0 0 auto"><span style="flex:1">${pids().size > 1 ? '<span class="mut">' + esc(S.projects[t.projectId]?.code || '') + '</span> ' : ''}${esc(t.name)}</span><span class="mut">${fmt(t.start)} – ${fmt(t.end)} · ${t.status === 'done' ? 'terminada' : (t.progress || 0) + ' %'}</span></div>`,
          )
          .join('')
      : '<span class="hint">No hay tareas.</span>';
    $('#xTs')
      .querySelectorAll('[data-xt]')
      .forEach(
        (c) =>
          (c.onchange = () => {
            c.checked ? st.sel.add(c.dataset.xt) : st.sel.delete(c.dataset.xt);
            autoRange();
            draw();
          }),
      );
    autoRange();
  };
  const autoRange = () => {
    const ts = tasksOf().filter((t) => st.sel.has(t.id));
    if (!ts.length) return;
    let a = Infinity,
      b = -Infinity;
    for (const t of ts) {
      const s0 = dn(t.start);
      if (s0 != null) a = Math.min(a, s0);
      for (const v of [dn(t.end), dn(t.realEnd), t.status !== 'done' ? fcOf(t).end : null])
        if (v != null) b = Math.max(b, v);
    }
    if (a < Infinity) {
      $('#xA').value = iso(a);
      $('#xB').value = iso(b);
    }
  };
  const build = () => {
    const ts = tasksOf().filter((t) => st.sel.has(t.id));
    if (!ts.length) return null;
    const A = dn(val('xA')),
      B = dn(val('xB'));
    if (A == null || B == null || B < A) return null;
    const ppd = +val('xG');
    const y0 = +iso(A).slice(0, 4),
      m0 = +iso(A).slice(5, 7) - 1,
      mS = ppd < 2 ? Math.floor(m0 / 3) * 3 : m0;
    const s0 =
      ppd >= 6 && ppd < 18
        ? monday(A)
        : ppd >= 18
          ? A - 1
          : dn(`${y0}-${String(mS + 1).padStart(2, '0')}-01`);
    let e0;
    if (ppd >= 6) {
      e0 = B + 1;
    } else {
      const M = monthsIn({ s: B, days: 1 })[0];
      let y = M.y,
        m = M.m + 1;
      if (ppd < 2) m = Math.floor(M.m / 3) * 3 + 3;
      if (m > 11) {
        y++;
        m -= 12;
      }
      e0 = dn(`${y}-${String(m + 1).padStart(2, '0')}-01`) - 1;
    }
    const R = { s: s0, days: e0 - s0 + 1, years: 1 };
    const old = UI.ppd;
    UI.ppd = ppd;
    let g;
    try {
      g = vGantt({ R, pids: new Set(ts.map((t) => t.projectId)), tids: new Set(ts.map((t) => t.id)) });
    } finally {
      UI.ppd = old;
    }
    const w = (t) => estHours(t) || 1,
      tw = ts.reduce((a, t) => a + w(t), 0),
      pct = tw
        ? Math.round(ts.reduce((a, t) => a + w(t) * (t.status === 'done' ? 100 : t.progress || 0), 0) / tw)
        : 0;
    const pn = [...new Set(ts.map((t) => t.projectId))].map((id) => S.projects[id]);
    const title =
      (val('xT') || (pn.length === 1 ? pn[0].name : 'Diagrama Gantt')) +
      (val('xPh') ? ' · ' + val('xPh') : '');
    const head = $('#xI').checked
      ? `<div style="padding:4px 2px 10px"><div style="font-size:17px;font-weight:700;color:#101828">${esc(title)}</div><div style="color:#667085;font-size:12px;margin-top:3px">${pn.length === 1 && pn[0].code ? esc(pn[0].code) + ' · ' : ''}${fmt(iso(A))} – ${fmt(iso(B))} · ${ts.length} tarea(s) · avance ${pct} % · fecha del informe ${fmt(val('xF') || todayS())}</div></div>`
      : '';
    const XW = g.W + 230;
    const css = `#xEl .tname{white-space:normal!important;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.2;font-size:12px}#xEl .legend span{white-space:nowrap}#xEl .legend{max-width:${XW}px}${ppd < 3 ? '#xEl .ovh{display:none}' : ''}`;
    return `<div id="xEl" style="background:#fff;padding:14px;width:${XW + 30}px;box-sizing:border-box"><style>${css}</style>${head}<div style="border:1px solid var(--line);border-radius:10px;background:#fff;width:${XW}px;box-sizing:border-box"><div class="ginner" style="width:${g.W}px">${g.inner}</div></div>${$('#xL').checked ? g.legend : ''}</div>`;
  };
  const draw = () => {
    const h = build();
    $('#xPv').innerHTML =
      h || '<div class="hint" style="padding:20px">Marca al menos una tarea y un periodo válido.</div>';
    const el = $('#xEl');
    $('#xMsg').innerHTML = el
      ? el.scrollWidth > 2400
        ? `<b style="color:#b54708">La imagen sale de ${el.scrollWidth} px de ancho: para Word, acorta el periodo o usa una escala mayor.</b>`
        : 'Con «Copiar imagen» lo pegas directamente en Word (Ctrl+V).'
      : '';
  };
  $('#xP').onchange = () => {
    st.pid = val('xP');
    fillTasks();
    draw();
  };
  for (const k of ['xG', 'xF', 'xA', 'xB', 'xL', 'xI']) $('#' + k).addEventListener('change', draw);
  for (const k of ['xT', 'xPh']) $('#' + k).addEventListener('input', draw);
  $('#xAll').onclick = () => {
    tasksOf().forEach((t) => st.sel.add(t.id));
    $('#xTs')
      .querySelectorAll('[data-xt]')
      .forEach((c) => (c.checked = true));
    autoRange();
    draw();
  };
  $('#xNone').onclick = () => {
    st.sel.clear();
    $('#xTs')
      .querySelectorAll('[data-xt]')
      .forEach((c) => (c.checked = false));
    draw();
  };
  const fname = () => {
    const p = S.projects[st.pid];
    return (
      (
        'Gantt ' +
        (p ? p.code || p.name : 'todos') +
        (val('xPh') ? ' ' + val('xPh') : '') +
        ' ' +
        (val('xF') || todayS())
      )
        .replace(/[\\/:*?"<>|·]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim() + '.png'
    );
  };
  const png = async () => {
    const el = $('#xEl');
    if (!el) {
      toast('No hay nada que exportar.');
      return null;
    }
    const cv = await domToPng(el, 2);
    return await new Promise((r) => cv.toBlob(r, 'image/png'));
  };
  $('#xPng').onclick = async () => {
    try {
      const b = await png();
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = fname();
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
      toast('Imagen descargada: ' + fname());
    } catch (e) {
      toast('No se pudo generar la imagen: ' + e.message);
    }
  };
  $('#xCopy').onclick = async () => {
    try {
      const b = png();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toast('Imagen copiada. Pégala en Word con Ctrl+V.');
    } catch (e) {
      toast('El navegador no permite copiar la imagen aquí: usa «Descargar PNG» e insértala en Word.');
    }
  };
  fillTasks();
  draw();
}
function openResume(pid, r) {
  const T = todayN(),
    days = Math.max(0, T - (dn(r.from) ?? T)),
    ts = r.ids.map(tk).filter(Boolean);
  const row = (d) =>
    ts
      .map(
        (t) =>
          `<tr><td>${esc(t.name)}</td><td class="mut">${who(t.assigneeId, true)}</td><td>${fmt(t.start)} – ${fmt(t.end)}</td><td><b>${fmt(iso(dn(t.start) + d))} – ${fmt(iso(dn(t.end) + d))}</b></td></tr>`,
      )
      .join('');
  openDlg(
    'Reanudar proyecto',
    `<div class="full"><p>La pausa ha durado <b>${days} día(s)</b> (desde el ${fmt(r.from)}). ¿Desplazas las fechas planificadas de las ${ts.length} tarea(s) que estaban en pausa?</p>
    <label style="max-width:260px">Desplazar (días naturales)<input type="number" id="rsD" min="0" value="${days}"></label>
    <table style="margin-top:10px"><thead><tr><th>Tarea</th><th></th><th>Ahora</th><th>Quedaría</th></tr></thead><tbody id="rsT">${row(days)}</tbody></table>
    <p class="hint">Pulsa <b>Cancelar</b> para mantener las fechas como están.</p></div>`,
    async () => {
      const d = Math.round(+val('rsD') || 0);
      if (!d) return;
      await saveMany(
        'tasks',
        ts.map((t) => [t.id, { ...t, start: iso(dn(t.start) + d), end: iso(dn(t.end) + d) }]),
      );
      toast(`Fechas desplazadas ${d} día(s).`);
    },
  );
  $('#rsD').oninput = () => {
    $('#rsT').innerHTML = row(Math.round(+val('rsD') || 0));
  };
}
function openMember(id) {
  if (!ME.owner) return;
  const m = id ? { ...S.members[id] } : { color: PALETTE[Object.keys(S.members).length % PALETTE.length] };
  const body = `<label class="full">Nombre<input type="text" id="uN" value="${esc(m.name)}"></label>
   <label>Rol<input type="text" id="uR" value="${esc(m.role)}" placeholder="Desarrollador/a, QA, diseño…"></label>
   <label>Color<input type="color" id="uC" value="${esc(m.color)}" style="height:34px;width:100%;border:1px solid var(--line);border-radius:7px"></label>
   <label>Correo (opcional)<input type="email" id="uE" value="${esc(m.email)}"></label>
   <label>Horas disponibles por día<input type="number" min="1" max="12" step="0.5" id="uH" value="${m.hoursPerDay || 8}"></label>
   <div><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Días de trabajo <span class="mut" style="font-weight:400">(p. ej. becarios: L, X, V)</span></div><div id="uWd" style="display:flex;gap:6px">${[1, 2, 3, 4, 5].map((x) => `<span class="chip ${(m.workDays || [1, 2, 3, 4, 5]).includes(x) ? 'on' : ''}" data-wd="${x}" style="min-width:34px;justify-content:center">${['', 'L', 'M', 'X', 'J', 'V'][x]}</span>`).join('')}</div></div>
   <label>Centro de trabajo<select id="uCt">${opt(
     centers().map((c) => [c.id, c.name + ' (' + c.municipality + ')']),
     m.centerId || centers()[0].id,
   )}</select></label>
   <label>Fecha de incorporación<input type="date" id="uJ" value="${esc(m.joinedAt || (id ? '' : todayS()))}"></label>
   <label style="flex-direction:row;align-items:center;gap:8px;margin-top:20px"><input type="checkbox" id="uP" ${m.isPM ? 'checked' : ''} ${id && id === ME.memberId ? 'disabled' : ''} style="width:auto"> Es project manager</label>
   <div class="note info">${id && id === ME.memberId ? 'Eres tú: tu rol de PM no se puede quitar desde aquí.' : 'Al abrir la herramienta, esta persona elegirá su nombre de la lista; a partir de ahí podrá editar sus propias tareas y ausencias.'}</div>`;
  openDlg(
    id ? 'Editar miembro' : 'Nuevo miembro',
    body,
    async () => {
      const o = {
        name: val('uN'),
        role: val('uR'),
        color: $('#uC').value,
        email: val('uE').toLowerCase(),
        isPM: $('#uP').checked,
        hoursPerDay: +$('#uH').value || 8,
        centerId: val('uCt'),
        joinedAt: val('uJ'),
      };
      {
        const wd = [...document.querySelectorAll('#uWd .chip.on')].map((c) => +c.dataset.wd);
        if (!wd.length) {
          toast('Marca al menos un día de trabajo.');
          return false;
        }
        if (wd.length < 5) o.workDays = wd;
      }
      if (!o.name) {
        toast('Indica el nombre.');
        return false;
      }
      if (!(await save('members', id, o))) return false;
    },
    id
      ? () => {
          if (arr('tasks').some((t) => t.assigneeId === id)) {
            toast('Tiene tareas asignadas: reasígnalas antes.');
            return;
          }
          if (arr('absences').some((a) => a.memberId === id)) {
            toast('Tiene ausencias registradas: bórralas antes.');
            return;
          }
          del('members', id);
        }
      : null,
  );
  document.querySelectorAll('#uWd [data-wd]').forEach((c) => (c.onclick = () => c.classList.toggle('on')));
}
