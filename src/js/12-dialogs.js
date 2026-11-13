/* ---------- modales ---------- */
function openDlg(title, body, onSave, onDel, editable = true) {
  $('#dlg').innerHTML =
    `<h2>${title}</h2><div class="body">${body}</div><div class="foot">${onDel && editable ? '<button class="btn dang" id="mDel">Eliminar</button>' : ''}<span class="sp"></span><button class="btn" id="mCancel">${editable ? 'Cancelar' : 'Cerrar'}</button>${editable && onSave ? '<button class="btn pri" id="mSave">Guardar</button>' : ''}</div>`;
  $('#modal').classList.add('show');
  $('#mCancel').onclick = closeDlg;
  if ($('#mSave'))
    $('#mSave').onclick = async () => {
      const b = $('#mSave');
      b.disabled = true;
      const ok = await onSave();
      b.disabled = false;
      if (ok !== false) closeDlg();
    };
  const d = $('#mDel');
  if (d)
    d.onclick = () => {
      if (d.classList.contains('arm')) {
        onDel();
        closeDlg();
      } else {
        d.classList.add('arm');
        d.textContent = '¿Seguro? Pulsa otra vez';
        setTimeout(() => {
          d.classList.remove('arm');
          d.textContent = 'Eliminar';
        }, 3000);
      }
    };
  if (!editable)
    $('#dlg')
      .querySelectorAll('input,select,textarea,.stars button,.dep .x')
      .forEach((e) => (e.disabled = true));
}
function closeDlg() {
  $('#modal').classList.remove('show');
  $('#dlg').style.width = '';
  if (pendingRender) render();
}
$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeDlg();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDlg();
});
const opt = (list, sel, empty) =>
  (empty != null ? `<option value="">${empty}</option>` : '') +
  list
    .map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`)
    .join('');
const val = (id) => $('#' + id).value.trim();

function openTask(id, defs = {}) {
  if (!projects().length) {
    toast(ME.owner ? 'Primero crea un proyecto en «Proyectos y equipo».' : 'Aún no hay proyectos.');
    return;
  }
  const me = myMemberId();
  const t = id
    ? { ...S.tasks[id], id }
    : {
        projectId: defs.projectId || [...UI.proj][0] || projects()[0]?.id || '',
        origin: 'plan',
        status: 'pending',
        priority: 'media',
        progress: 0,
        start: todayS(),
        end: iso(todayN() + 6),
        assigneeId: ME.owner ? '' : me,
        deps: [],
        ...defs,
      };
  const editable = id ? canEditTask(t) : canCreateTask();
  const planOK = canPlan();
  const ev = S.evals[id] || {};
  let q = ev.quality || 0;
  let deps = [...(t.deps || [])];
  let H = JSON.parse(JSON.stringify(hist(t)));
  let pzForm = null;
  const ms = pickMembers([t.assigneeId, t.detectedBy]).map((m) => [m.id, m.name]);
  const succ = id ? successors(id) : [];
  const body = `<label class="full">Nombre de la tarea<input type="text" id="tName" value="${esc(t.name)}"></label>
   <label>Proyecto<select id="tProj">${opt(
     projects().map((p) => [p.id, (p.priv ? '🔒 ' : '') + p.name]),
     t.projectId,
   )}</select></label>
   <label>Responsable${ME.owner ? '' : ' <span class="mut" style="font-weight:400">(lo asigna el PM)</span>'}<select id="tAs" ${ME.owner ? '' : 'disabled'}>${opt(ms, t.assigneeId, 'Sin asignar')}</select></label>
   <label>Origen<select id="tOrig">${opt(
     Object.entries(ORIG).map(([k, v]) => [k, v.t]),
     t.origin || 'plan',
   )}</select></label>
   <label>Prioridad<select id="tPri">${opt(
     [
       ['alta', 'Alta'],
       ['media', 'Media'],
       ['baja', 'Baja'],
     ],
     t.priority || 'media',
   )}</select></label>
   <label class="detf">Detectada por<select id="tDetBy">${opt(ms, t.detectedBy, '—')}</select></label>
   <label class="detf">Fecha de detección<input type="date" id="tDetOn" value="${esc(t.detectedOn || '')}"></label>
   <label class="full">Descripción / criterio de aceptación<textarea id="tDesc">${esc(t.description)}</textarea></label>
   <div class="sect">Dependencias <span class="mut" style="font-weight:400">· esta tarea no puede avanzar hasta que terminen:</span></div>
   <div class="full deps" id="tDeps"></div>
   ${succ.length ? `<div class="note warn">⛓ Esta tarea bloquea a: ${succ.map((s) => `<b>${esc(s.name)}</b> (${esc(mem(s.assigneeId)?.name || 'sin asignar')})${s.status === 'done' ? ' ✓' : ''}`).join(', ')}. Mientras no la completes, esas personas no pueden avanzar.</div>` : ''}
   <div id="tBlk" class="full" style="display:contents"></div>
   <div class="sect">Planificación y seguimiento</div>
   <label>Inicio planificado<input type="date" id="tS" value="${esc(t.start)}"></label>
   <label>Fin planificado<input type="date" id="tE" value="${esc(t.end)}"></label>
   <label>Inicio real<input type="date" id="tRS" value="${esc(t.realStart || '')}"></label>
   <label>Fin real<input type="date" id="tRE" value="${esc(t.realEnd || '')}"></label>
   ${id ? '<div class="full" id="tPz"></div>' : ''}
   <label>Dedicación prevista (% de su jornada)<input type="number" min="5" max="100" step="5" id="tDed" value="${t.dedication ?? 100}"></label>
   <div class="hint" style="align-self:end;padding-bottom:8px" id="tDedH"></div>
   <label>Horas estimadas (total)<input type="number" min="0" step="1" id="tEH" value="${esc(t.estimatedHours ?? '')}" placeholder="${Math.round(estHours(t)) || ''}"></label>
   <label>Horas pendientes <span class="mut" style="font-weight:400">(vacío = según avance)</span><input type="number" min="0" step="1" id="tRH" value="${esc(t.remainingHours ?? '')}"></label>
   <div id="tFc" class="full" style="display:contents"></div>
   <div id="tLoad" class="full" style="display:contents"></div>
   <label>Estado<select id="tSt">${opt(Object.entries(STAT), t.status || 'pending')}</select></label>
   <label><span>Avance: <b id="tPv">${t.progress || 0}%</b></span><input type="range" min="0" max="100" step="5" id="tP" value="${t.progress || 0}"></label>
   <label class="full" id="tBRw">Motivo del bloqueo<input type="text" id="tBR" value="${esc(t.blockReason || '')}" placeholder="Qué o quién te bloquea"></label>
   ${
     ME.owner
       ? `<div class="sect">Evaluación de la calidad de cumplimiento <span class="tag lv3">🔒 solo la ves tú</span></div>
   <label>Calidad del resultado<div class="stars" id="tQ">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-q="${i}" class="${i <= q ? 'on' : ''}" title="${i} ★ · ${RLBL[i - 1]}: ${esc(rubric()[i - 1])}">★</button>`).join('')}</div><span class="hint" id="tQd" style="font-weight:400"></span></label>
   <label>Alcance entregado (%)<input type="number" min="0" max="100" id="tSc" value="${ev.scope ?? 100}"></label>
   <label>Nº de retrabajos<input type="number" min="0" max="10" id="tRw" value="${ev.rework || 0}"></label>
   <label class="full">Comentario de la evaluación<textarea id="tEvN" style="min-height:44px">${esc(ev.notes)}</textarea></label>
   <details class="full hint" style="margin-top:-4px"><summary style="cursor:pointer">Ver la escala de calidad completa</summary><table style="margin-top:6px">${[5, 4, 3, 2, 1].map((i) => `<tr><td style="white-space:nowrap;color:#f5a524">${'★'.repeat(i)}<span style="color:#d0d5dd">${'★'.repeat(5 - i)}</span></td><td><b>${RLBL[i - 1]}</b></td><td>${esc(rubric()[i - 1])}</td></tr>`).join('')}</table></details>
   <div class="scorebox" id="tScore"></div>`
       : ''
   }`;
  const cur = () => ({
    ...t,
    deps,
    forceStart: ME.owner && $('#tForce') ? $('#tForce').checked : !!t.forceStart,
    status: val('tSt'),
    start: val('tS'),
    end: val('tE'),
  });
  const renderDeps = () => {
    const list = deps.map(tk).filter(Boolean);
    let h = list
      .map(
        (p) =>
          `<div class="dep">${p.status === 'done' ? '<span class="tag ok">✓ hecha</span>' : '<span class="tag bad">⏳ pendiente</span>'}<span style="flex:1"><b>${esc(p.name)}</b> <span class="mut">· ${esc(S.projects[p.projectId]?.code || '')} · fin ${fmt(p.end)} · ${p.progress || 0}%</span></span>${who(p.assigneeId, true)}${editable && planOK ? `<button class="x" data-rm="${p.id}" title="Quitar">×</button>` : ''}</div>`,
      )
      .join('');
    if (!list.length) h += '<span class="hint">Sin dependencias.</span>';
    if (editable && planOK) {
      const myPriv = !!S.projects[val('tProj')]?.priv;
      const cand = arr('tasks')
        .filter(
          (x) => (myPriv || !x.priv) && x.id !== id && !deps.includes(x.id) && !(id && reaches(x.id, id)),
        )
        .sort(
          (a, b) =>
            (S.projects[a.projectId]?.name || '').localeCompare(S.projects[b.projectId]?.name || '') ||
            (a.end || '').localeCompare(b.end || ''),
        );
      h += `<select id="tAddDep"><option value="">+ Añadir tarea de la que depende…</option>${cand.map((x) => `<option value="${x.id}">${esc((S.projects[x.projectId]?.code || '') + ' · ' + x.name + ' — ' + (mem(x.assigneeId)?.name || 'sin asignar') + (x.status === 'done' ? ' ✓' : ''))}</option>`).join('')}</select>`;
    }
    $('#tDeps').innerHTML = h;
    $('#tDeps')
      .querySelectorAll('[data-rm]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            deps = deps.filter((d) => d !== b.dataset.rm);
            renderDeps();
            upd();
          }),
      );
    const ad = $('#tAddDep');
    if (ad)
      ad.onchange = () => {
        if (ad.value) {
          deps.push(ad.value);
          renderDeps();
          upd();
        }
      };
  };
  const renderPz = () => {
    const box = $('#tPz');
    if (!box) return;
    const aid = val('tAs') || t.assigneeId;
    const op = H[H.length - 1] && !H[H.length - 1].to ? H[H.length - 1] : null;
    const done = val('tSt') === 'done';
    const stTxt = op
      ? op.k === 'pause'
        ? `<span class="tag warn">⏸ En pausa</span> desde el ${fmt(op.from)} (${gapWork(aid, op.from, todayS())} días laborables)`
        : `<span class="tag bad">✕ Cancelada</span> el ${fmt(op.from)}`
      : done
        ? '<span class="tag ok">Terminada</span>'
        : '<span class="tag ok">Activa</span>';
    const btn =
      !editable || !planOK || done
        ? ''
        : op
          ? op.k === 'pause'
            ? '<button type="button" class="btn sm pri" data-pza="resume">▶ Reanudar</button>'
            : '<button type="button" class="btn sm pri" data-pza="resume">↻ Reactivar</button>'
          : '<button type="button" class="btn sm" data-pza="pause">⏸ Pausar</button><button type="button" class="btn sm" data-pza="cancel">✕ Cancelar</button>' +
            (id && t.assigneeId && !t.priv
              ? '<button type="button" class="btn sm" id="tHo" title="Pasar lo que queda de la tarea a otra persona, conservando lo hecho">⇄ Traspasar…</button>'
              : '');
    let f = '';
    if (pzForm === 'pause' || pzForm === 'cancel')
      f = `<div class="pzf"><div style="font-weight:600;margin-bottom:6px">${pzForm === 'pause' ? 'Pausar la tarea' : 'Cancelar la tarea'}</div><div style="display:grid;grid-template-columns:170px 1fr;gap:8px"><label>Fecha de ${pzForm === 'pause' ? 'pausa' : 'cancelación'}<input type="date" id="pzD" value="${todayS()}"></label><label>Motivo<input type="text" id="pzW" placeholder="${pzForm === 'pause' ? 'p. ej. a la espera de datos del cliente' : 'p. ej. el cliente retira el requisito'}"></label></div><div class="hint" style="margin:6px 0">Mientras dure, no cuenta en la carga ni en las fechas previstas y no genera avisos de retraso. En el Gantt se sigue viendo el plan vigente, atenuado desde esa fecha.</div><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="btn sm" data-pzx="close">Cancelar</button><button type="button" class="btn sm pri" data-pzx="ok">Aplicar</button></div></div>`;
    if (pzForm === 'resume' && op)
      f = `<div class="pzf"><div style="font-weight:600;margin-bottom:6px">${op.k === 'pause' ? 'Reanudar la tarea' : 'Reactivar la tarea'}</div><div style="display:grid;grid-template-columns:170px 120px 1fr;gap:8px;align-items:end"><label>Fecha de ${op.k === 'pause' ? 'reanudación' : 'reactivación'}<input type="date" id="pzD" value="${todayS()}"></label><div><div class="hint">Días ${op.k === 'pause' ? 'en pausa' : 'cancelada'}</div><b id="pzN" style="font-size:15px"></b> <span class="mut">lab.</span></div><label>Nuevo fin planificado <span class="mut" style="font-weight:400">(fin anterior ${fmt(val('tE'))} + días ${op.k === 'pause' ? 'en pausa' : 'cancelada'})</span><div style="display:flex;gap:4px"><input type="date" id="pzE" style="flex:1"><button type="button" class="btn sm" id="pzR" title="Volver a calcularlo">↺</button></div></label></div><label style="margin-top:8px">Nota (opcional)<input type="text" id="pzW"></label><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px"><button type="button" class="btn sm" data-pzx="close">Cancelar</button><button type="button" class="btn sm pri" data-pzx="ok">Aplicar</button></div></div>`;
    if (pzForm === 'edit') {
      const l = H[H.length - 1];
      f = `<div class="pzf"><div style="font-weight:600;margin-bottom:6px">Corregir el último registro (${HK[l.k].toLowerCase()})</div><div style="display:grid;grid-template-columns:170px 170px 1fr;gap:8px"><label>Desde<input type="date" id="pzF" value="${esc(l.from)}"></label>${l.to ? `<label>Hasta (reanudación)<input type="date" id="pzT" value="${esc(l.to)}"></label>` : '<div></div>'}<label>Motivo<input type="text" id="pzW" value="${esc(l.why || '')}"></label></div><div style="display:flex;gap:6px;justify-content:space-between;margin-top:8px"><button type="button" class="btn sm" data-pzx="del" style="color:var(--bad)">${l.to ? 'Deshacer la reanudación' : 'Eliminar este registro'}</button><span><button type="button" class="btn sm" data-pzx="close">Cancelar</button> <button type="button" class="btn sm pri" data-pzx="ok">Aplicar</button></span></div></div>`;
    }
    const rows = H.map(
      (e, i) =>
        `<tr><td>${i + 1}</td><td>${e.k === 'pause' ? '⏸ Pausa' : '✕ Cancelación'}</td><td>${fmt(e.from)}</td><td>${e.to ? fmt(e.to) : '<i>en curso</i>'}</td><td>${e.to ? gapWork(aid, e.from, e.to) : gapWork(aid, e.from, todayS())}</td><td>${esc(e.why || '')}${e.note ? ' <span class="mut">· ' + esc(e.note) + '</span>' : ''}${e.grp ? ' <span class="mut" title="Registrado al pausar o cancelar el proyecto">· proyecto</span>' : ''}</td><td style="white-space:nowrap">${e.endBefore && e.endAfter ? fmt(e.endBefore).slice(0, 8) + ' → ' + fmt(e.endAfter).slice(0, 8) : '—'}</td><td>${editable && i === H.length - 1 && !pzForm ? '<button type="button" class="x" data-pzx="editlast" title="Corregir">✎</button>' : ''}</td></tr>`,
    ).join('');
    const tot = H.filter((e) => e.to);
    const nP = H.filter((e) => e.k === 'pause').length,
      nC = H.filter((e) => e.k === 'cancel').length,
      dd = H.reduce((a, e) => a + gapWork(aid, e.from, e.to || todayS()), 0);
    box.innerHTML = `<div class="pzbox"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>Estado:</b> ${stTxt}<span class="sp"></span>${pzForm ? '' : btn}</div>${f}${H.length ? `<table class="pzt"><thead><tr><th>#</th><th>Registro</th><th>Desde</th><th>Hasta</th><th>Días lab.</th><th>Motivo</th><th>Fin planificado</th><th></th></tr></thead><tbody>${rows}</tbody></table><div class="hint">${nP} pausa(s)${nC ? ' · ' + nC + ' cancelación(es)' : ''} · ${dd} días laborables sin actividad en total.</div>` : ''}</div>`;
    box.querySelectorAll('[data-pza]').forEach(
      (b) =>
        (b.onclick = () => {
          pzForm = b.dataset.pza;
          renderPz();
        }),
    );
    if ($('#tHo')) $('#tHo').onclick = () => openHandover(id);
    const calc = () => {
      if (!$('#pzE')) return;
      const n = gapWork(aid, op.from, val('pzD'));
      $('#pzN').textContent = n;
      $('#pzE').value = iso(addWork(aid, dn(val('tE')), n));
    };
    if (pzForm === 'resume' && op) {
      calc();
      $('#pzD').onchange = calc;
      $('#pzR').onclick = calc;
    }
    box.querySelectorAll('[data-pzx]').forEach(
      (b) =>
        (b.onclick = () => {
          const a = b.dataset.pzx;
          if (a === 'close') {
            pzForm = null;
            renderPz();
            return;
          }
          if (a === 'editlast') {
            pzForm = 'edit';
            renderPz();
            return;
          }
          const last = H[H.length - 1];
          if (a === 'del') {
            if (last.to) {
              last.to = '';
              if (last.endBefore) {
                $('#tE').value = last.endBefore;
              }
              delete last.endBefore;
              delete last.endAfter;
              delete last.note;
            } else H.pop();
            pzForm = null;
            renderPz();
            upd();
            return;
          }
          if (pzForm === 'pause' || pzForm === 'cancel') {
            const d = val('pzD');
            if (!d) {
              toast('Indica la fecha.');
              return;
            }
            const prevTo = H.length ? H[H.length - 1].to : '';
            if (prevTo && d < prevTo) {
              toast('La fecha no puede ser anterior a la última reanudación (' + fmt(prevTo) + ').');
              return;
            }
            H.push({
              k: pzForm,
              from: d,
              to: '',
              why: val('pzW'),
              by: ME.memberId || 'pm',
              at: new Date().toISOString(),
            });
          } else if (pzForm === 'resume') {
            const d = val('pzD'),
              ne = val('pzE');
            if (!d || d < op.from) {
              toast('La fecha de reanudación no puede ser anterior al ' + fmt(op.from) + '.');
              return;
            }
            if (!ne || ne < val('tS')) {
              toast('Revisa el nuevo fin planificado.');
              return;
            }
            op.to = d;
            op.endBefore = val('tE');
            op.endAfter = ne;
            if (val('pzW')) op.note = val('pzW');
            $('#tE').value = ne;
          } else if (pzForm === 'edit') {
            const F = val('pzF'),
              T2 = $('#pzT') ? val('pzT') : '';
            const pv = H.length > 1 ? H[H.length - 2].to : '';
            if (!F || (pv && F < pv) || (T2 && T2 <= F)) {
              toast('Revisa las fechas.');
              return;
            }
            last.from = F;
            if (last.to) last.to = T2;
            last.why = val('pzW');
          }
          pzForm = null;
          renderPz();
          upd();
        }),
    );
  };
  const collect = () => {
    const status = val('tSt');
    let progress = +$('#tP').value;
    let realEnd = val('tRE');
    if (status === 'done') {
      progress = 100;
      if (!realEnd) realEnd = todayS();
    }
    const o = {
      projectId: val('tProj'),
      name: val('tName'),
      assigneeId: ME.owner ? val('tAs') : t.assigneeId,
      origin: val('tOrig'),
      priority: val('tPri'),
      detectedBy: val('tDetBy'),
      detectedOn: val('tDetOn'),
      description: $('#tDesc').value,
      start: val('tS'),
      end: val('tE'),
      realStart: val('tRS') || (status !== 'pending' && status !== 'blocked' ? t.realStart || todayS() : ''),
      realEnd,
      status,
      progress,
      deps: [...deps],
      forceStart: ME.owner && $('#tForce') ? $('#tForce').checked : !!t.forceStart,
      blockReason: status === 'blocked' ? val('tBR') : '',
      dedication: Math.min(100, Math.max(5, +$('#tDed').value || 100)),
      estimatedHours: $('#tEH').value === '' ? null : Math.max(0, +$('#tEH').value),
      remainingHours: $('#tRH').value === '' ? null : Math.max(0, +$('#tRH').value),
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (o.origin === 'plan') {
      delete o.detectedBy;
      delete o.detectedOn;
    }
    if (H.length || t.hist) o.hist = H;
    return o;
  };
  const evCollect = () =>
    q
      ? {
          quality: q,
          scope: +$('#tSc').value,
          rework: +$('#tRw').value,
          by: 'PM',
          notes: $('#tEvN').value,
          at: ev.at || todayS(),
        }
      : null;
  const upd = () => {
    const c = cur();
    const bl = deps.map(tk).filter((p) => p && p.status !== 'done');
    const blocked = c.status !== 'done' && bl.length > 0 && !c.forceStart;
    let n = '';
    if (bl.length && c.status !== 'done')
      n += `<div class="note ${blocked ? 'bad' : 'info'}">${blocked ? '⛔ <b>Bloqueada:</b> no se puede avanzar ni completar hasta que terminen ' : 'Avance permitido por el PM aunque siguen pendientes '}${bl.map((p) => `<b>${esc(p.name)}</b> (${esc(mem(p.assigneeId)?.name || 'sin asignar')})`).join(', ')}.${ME.owner ? `<label style="flex-direction:row;align-items:center;gap:6px;margin-top:6px;font-weight:500"><input type="checkbox" id="tForce" ${c.forceStart ? 'checked' : ''} style="width:auto"> Permitir avanzar igualmente (decisión del PM)</label>` : ''}</div>`;
    const cf = dateConflict(c);
    if (cf && c.status !== 'done')
      n += `<div class="note warn">📅 Empieza antes de que termine aquello de lo que depende. Inicio más temprano coherente: <b>${fmt(cf)}</b>. ${editable && planOK ? `<button type="button" class="btn sm" id="tFix">Mover la tarea a esa fecha</button>` : ''}</div>`;
    {
      const pp = S.projects[val('tProj')];
      const pe = pp && pp.end;
      if (pe && c.status !== 'done' && c.end && c.end > pe)
        n += `<div class="note warn">📅 El fin planificado (<b>${fmt(c.end)}</b>) es posterior al fin objetivo del proyecto «${esc(pp.name)}» (<b>${fmt(pe)}</b>). Puedes guardarla igualmente; aparecerá como «Fuera del plazo del proyecto» y en los avisos 🔔.</div>`;
    }
    $('#tBlk').innerHTML = n;
    const fc = $('#tForce');
    if (fc) fc.onchange = upd;
    const fx = $('#tFix');
    if (fx)
      fx.onclick = () => {
        const d = dn(val('tE')) - dn(val('tS'));
        $('#tS').value = cf;
        $('#tE').value = iso(dn(cf) + d);
        upd();
      };
    const P = $('#tP'),
      ST = $('#tSt');
    if (editable) {
      P.disabled = blocked;
      ST.querySelector('option[value=done]').disabled = blocked;
      ST.querySelector('option[value=doing]').disabled = blocked;
    }
    $('#tBRw').style.display = c.status === 'blocked' ? '' : 'none';
    {
      const o = collect();
      const aid = o.assigneeId;
      const cap = capOf(aid);
      $('#tDedH').textContent = aid
        ? `≈ ${((cap * o.dedication) / 100).toFixed(1)} h/día de ${cap} h disponibles`
        : '';
      let ln = '';
      if (aid && o.start && o.end && o.status !== 'done') {
        const s = dn(o.start),
          e = dn(o.end);
        const wk = weekLoads(
          aid,
          Math.max(s, todayN() - 7),
          Math.max(1, Math.min(26, Math.ceil((e - Math.max(s, todayN() - 7) + 1) / 7) + 1)),
          { exclude: id, extra: { ...o, id: '__new' } },
        ).filter((w) => w.start + 4 >= s && w.start <= e);
        const pk = wk.reduce((a, w) => (w.avg > a.avg ? w : a), { avg: 0 });
        if (pk.avg > 100)
          ln = `<div class="note bad">⚠ Con esta tarea, <b>${esc(mem(aid)?.name)}</b> queda en <b>sobrecarga</b>: ${fmtPct(pk.avg)} de sus horas disponibles la semana del ${fmt(iso(pk.start))}. Reduce la dedicación, mueve fechas o reasigna.</div>`;
        else if (pk.avg >= 85)
          ln = `<div class="note warn">Con esta tarea, ${esc(mem(aid)?.name)} queda al límite (${fmtPct(pk.avg)} la semana del ${fmt(iso(pk.start))}).</div>`;
      }
      if (aid && o.start && o.end && o.status !== 'done') {
        const s = dn(o.start),
          e = dn(o.end);
        const ov = absOverlap(aid, s, e);
        if (ov.length)
          ln += `<div class="note warn">🗓 ${esc(mem(aid)?.name)} estará ausente durante la tarea: ${ov.map((x) => `<b>${esc(absLabel(x))}</b> ${absWhen(x)}${!absHours(x) && x.availability > 0 ? ` (disponible ${x.availability}%)` : ''}`).join(', ')}.</div>`;
        const hs = holOn(aid, s),
          he = holOn(aid, e);
        if (hs.length || he.length || !isWork(s) || !isWork(e))
          ln += `<div class="note info">${!isWorkM(aid, s) ? `La tarea empieza en un día no laborable (${fmt(o.start)}${hs.length ? ' · ' + esc(hs.map((x) => x.name).join(', ')) : ''}). ` : ''}${!isWorkM(aid, e) ? `Termina en un día no laborable (${fmt(o.end)}${he.length ? ' · ' + esc(he.map((x) => x.name).join(', ')) : ''}).` : ''}</div>`;
        const wd = workDays(aid, s, e);
        if (wd) $('#tDedH').textContent += ` · ${wd} días laborables`;
      }
      $('#tLoad').innerHTML = ln;
      {
        const o2 = { ...o, id: id || '__new' };
        const box = $('#tFc');
        $('#tEH').placeholder = Math.round(estHours({ ...o2, estimatedHours: null })) || '';
        $('#tRH').placeholder = Math.round(remHours({ ...o2, remainingHours: null })) || '';
        if (o2.status === 'done' || !aid || !o2.start || !o2.end) {
          box.innerHTML = '';
        } else {
          const f = forecasts(o2)[o2.id] || {};
          const rh = Math.round(remHours(o2));
          box.innerHTML =
            f.end == null
              ? `<div class="note warn">Sin fecha prevista: ${esc(f.why || '')}.</div>`
              : `<div class="note ${f.slip > 0 ? 'bad' : 'info'}">📅 <b>Fin prevista: ${fmt(iso(f.end))}</b> ${f.slip > 0 ? `· <b>${f.slip} días laborables después</b> de la fin planificada (${fmt(o2.end)})` : f.slip < 0 ? `· ${-f.slip} días laborables antes de lo planificado` : '· coincide con la fin planificada'}<br><span style="font-size:12px">Quedan ≈ ${rh} h de ${Math.round(estHours(o2))} h estimadas${(f.reasons || []).length ? ' · Influye: ' + esc(f.reasons.join(' · ')) : ''}. Cálculo con su calendario (festivos de su centro y ausencias), sus reuniones y sus otras tareas: primero las de prioridad alta.</span></div>`;
        }
      }
    }
    if (!ME.owner) return;
    const o = { ...collect() };
    const s = score(o, evCollect());
    const box = $('#tScore');
    if (!s) {
      box.innerHTML = `<span class="hint">${o.status === 'done' ? 'Valora la calidad (★) para calcular el índice.' : 'El índice se calcula cuando la tarea está completada y valorada.'}</span>`;
      return;
    }
    const l = level(s.total);
    box.innerHTML = `<div>Índice<br><b>${Math.round(s.total)}</b> <span class="tag ${l.c}">${l.t}</span></div><div class="hint">Plazo ${pct(s.plazo)}${s.late ? ` (${s.late} d de retraso)` : ''}<br>Calidad ${pct(s.calidad)} · Alcance ${pct(s.alcance)} · Retrabajo ${pct(s.retrabajo)}</div>`;
  };
  openDlg(
    id ? (editable ? 'Editar tarea' : 'Tarea (solo lectura)') : 'Nueva tarea',
    body,
    async () => {
      const o = collect();
      // a member's save never changes the plan: those fields are taken from the current task
      if (!planOK && id) for (const k of PLAN_FIELDS) if (S.tasks[id][k] !== undefined) o[k] = S.tasks[id][k];
      if (!o.name) {
        toast('Ponle un nombre a la tarea.');
        return false;
      }
      if (!o.start || !o.end || o.end < o.start) {
        toast('Revisa las fechas planificadas.');
        return false;
      }
      const bl = o.deps.map(tk).filter((p) => p && p.status !== 'done');
      if (
        bl.length &&
        !o.forceStart &&
        (o.status === 'done' || o.status === 'doing') &&
        !(id && S.tasks[id].status === o.status)
      ) {
        toast(
          'No puede pasar a «' +
            STAT[o.status] +
            '»: está bloqueada por ' +
            bl.map((p) => p.name).join(', ') +
            '.',
        );
        return false;
      }
      if (bl.length && !o.forceStart && o.status === 'done') {
        toast('No puede completarse mientras esté bloqueada.');
        return false;
      }
      const nid = await saveTask(id, o);
      if (!nid) return false;
      if (ME.owner) {
        const e = evCollect();
        if (e) await save('evals', nid, e);
      }
    },
    id && planOK ? () => delTask(id) : null,
    editable,
  );
  if (editable && !planOK) {
    ['tName', 'tProj', 'tOrig', 'tPri', 'tDetBy', 'tDetOn', 'tDesc', 'tS', 'tE', 'tDed', 'tEH'].forEach(
      (i) => $('#' + i) && ($('#' + i).disabled = true),
    );
    $('#dlg .body').insertAdjacentHTML(
      'afterbegin',
      '<div class="note info full">La planificación de la tarea la cambia el project manager. Tú puedes actualizar el estado, el avance, las horas pendientes, las fechas reales y el motivo de un bloqueo.</div>',
    );
  }
  if (id && (t.handover || t.contOf)) {
    const ho = t.handover,
      prev = t.contOf && S.tasks[t.contOf];
    const link = (tid, txt) => (S.tasks[tid] ? ` <a href="#" data-goto="${tid}">${txt}</a>` : '');
    $('#dlg .body').insertAdjacentHTML(
      'afterbegin',
      (ho
        ? `<div class="note info full">⇄ Traspasada a <b>${esc(mem(ho.member)?.name || '—')}</b> el ${fmt(ho.on)}, con un avance del ${ho.progress || 0} %. Esta ficha recoge la parte hecha hasta esa fecha.${link(ho.to, 'Ver la continuación')}</div>`
        : '') +
        (prev
          ? `<div class="note info full">⇄ Continúa la tarea que llevaba <b>${esc(mem(prev.assigneeId)?.name || '—')}</b> hasta el ${fmt(prev.handover?.on || prev.end)}.${link(t.contOf, 'Ver la parte anterior')}</div>`
          : ''),
    );
    document.querySelectorAll('#dlg [data-goto]').forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          openTask(a.dataset.goto);
        }),
    );
  }
  mdField($('#tDesc'));
  renderDeps();
  renderPz();
  $('#tSt').addEventListener('change', renderPz);
  const detToggle = () => {
    const plan = val('tOrig') === 'plan';
    document.querySelectorAll('.detf').forEach((e) => (e.style.display = plan ? 'none' : ''));
    if (!plan && !val('tDetOn') && editable) $('#tDetOn').value = todayS();
  };
  $('#tOrig').onchange = detToggle;
  detToggle();
  $('#tAs').addEventListener('change', () => upd());
  {
    const pvS = () => {
      const pv = !!S.projects[val('tProj')]?.priv;
      const a = $('#tAs');
      if (pv) {
        if (myMemberId()) a.value = myMemberId();
        a.disabled = true;
      } else a.disabled = !ME.owner || !editable;
      let n = $('#tPvN');
      if (pv && !n) {
        n = document.createElement('div');
        n.id = 'tPvN';
        n.className = 'full note info';
        n.innerHTML =
          '🔒 <b>Proyecto privado</b>: solo tú ves esta tarea. Su fecha prevista se calcula con tu calendario privado (' +
          privH() +
          ' h/día, todos los días) y no cuenta en tu carga laboral.';
        $('#tName').closest('label').after(n);
      } else if (!pv && n) n.remove();
      upd();
    };
    $('#tProj').addEventListener('change', pvS);
    pvS();
  }
  $('#tP').oninput = () => {
    $('#tPv').textContent = $('#tP').value + '%';
    upd();
  };
  if (ME.owner) {
    const qd = (v) => {
      $('#tQd').innerHTML = v
        ? `<b>${v} ★ · ${RLBL[v - 1]}:</b> ${esc(rubric()[v - 1])}`
        : 'Elige de 1 a 5 estrellas según la escala.';
    };
    qd(q);
    $('#tQ')
      .querySelectorAll('button')
      .forEach((b) => {
        b.onclick = () => {
          q = +b.dataset.q;
          $('#tQ')
            .querySelectorAll('button')
            .forEach((x) => x.classList.toggle('on', +x.dataset.q <= q));
          qd(q);
          upd();
        };
        b.onmouseenter = () => qd(+b.dataset.q);
        b.onmouseleave = () => qd(q);
      });
  }
  $('#tSt').onchange = () => {
    if (val('tSt') === 'done') {
      $('#tP').value = 100;
      $('#tPv').textContent = '100%';
      if (!val('tRE')) $('#tRE').value = todayS();
    }
    upd();
  };
  ['tS', 'tE', 'tRE', 'tDed', 'tEH', 'tRH', 'tPri']
    .concat(ME.owner ? ['tSc', 'tRw'] : [])
    .forEach((i) => $('#' + i).addEventListener('input', upd));
  upd();
}
function openMeeting(id, defs = {}) {
  const me = myMemberId();
  const occ = id && String(id).startsWith('rs-') ? S.meetings[id] : null;
  const sr = occ ? SERIES[occ.seriesId] : null;
  const m = id
    ? { ...S.meetings[id] }
    : {
        date: todayS(),
        time: '10:00',
        duration: 60,
        type: 'seguimiento',
        attendees: [
          ...new Set([
            ...activeMembers()
              .filter((x) => x.isPM)
              .map((x) => x.id),
            ...(me ? [me] : []),
          ]),
        ],
        ...defs,
      };
  const editable = canEditMeeting(id ? m : null);
  const tbm = m.source === 'thunderbird';
  let att = new Set(m.attendees || []);
  const rp = sr ? { ...sr.repeat } : { freq: '', days: [], until: '', skipHol: true };
  const days = new Set(rp.days || []);
  const FIELDS = ['title', 'type', 'projectId', 'date', 'time', 'duration', 'notes'];
  const body = `${
    occ
      ? `<div class="full note info" style="margin:0">↻ Reunión periódica: <b>${esc(repeatLbl(sr?.repeat))}</b> desde el ${fmt(sr?.date)}${sr?.repeat?.until ? ' hasta el ' + fmt(sr.repeat.until) : ' (sin fecha de fin)'} · ${{ list: 'asistentes elegidos', team: 'todo el equipo', project: 'participantes del proyecto' }[sr?.attMode || 'list']}.</div>
   <label class="full">Aplicar los cambios a<select id="mScope"><option value="one">Solo esta reunión (${fmt(occ.occDate)})</option><option value="next">Esta y las siguientes</option><option value="all">Toda la serie</option></select></label>`
      : ''
  }
   <label class="full">Título<input type="text" id="mT" value="${esc(m.title)}"></label>
   <label>Tipo<select id="mTy">${opt(Object.entries(MTYPE), m.type)}</select></label>
   <label>Proyecto<select id="mP">${opt(
     projects()
       .filter((p) => !p.priv)
       .map((p) => [p.id, p.name]),
     m.projectId,
     'General (varios proyectos)',
   )}</select></label>
   <label>Fecha<input type="date" id="mD" value="${esc(m.date)}"></label>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Hora de inicio<input type="time" id="mH" value="${esc(m.time || '')}"></label><label>Hora de fin<input type="time" id="mF" value="${endTime(m.time, m.duration)}"></label></div>
   ${
     tbm
       ? ''
       : `<div class="full" id="mRp" style="border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px 12px">
     <label>Repetir<select id="mRe">${opt(REPEAT, rp.freq || '')}</select></label>
     <label>Hasta (opcional)<input type="date" id="mUn" value="${esc(rp.until || '')}"></label>
     <div class="full" id="mDw" style="display:none"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Días</div><div style="display:flex;gap:6px">${WDL.map((l, i) => `<span class="chip ${days.has(i) ? 'on' : ''}" data-wd="${i}" style="min-width:34px;justify-content:center">${l}</span>`).join('')}</div></div>
     <label class="full" id="mShL" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="mSh" ${rp.skipHol !== false ? 'checked' : ''} style="width:auto"> No ponerla en festivos de todo el equipo</label>
     <label class="full" id="mAmL">Asistentes de la serie<select id="mAm">${opt(ATTM, sr?.attMode || 'list')}</select></label>
     <div class="full hint" id="mAmH"></div></div>`
   }
   <div class="full"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px;display:flex;align-items:center">Asistentes<span class="sp"></span>${editable ? '<button type="button" class="btn sm" id="mAP" title="Marca a todos los participantes del proyecto elegido">+ Participantes del proyecto</button>' : ''}</div><div id="mA" style="display:flex;gap:6px;flex-wrap:wrap">${
     pickMembers([...att], m.date)
       .map(
         (x) =>
           `<span class="chip ${att.has(x.id) ? 'on' : ''}" data-a="${x.id}">${who(x.id)}${x.isPM ? ' <span class="mut">PM</span>' : ''}</span>`,
       )
       .join('') || '<span class="hint">Añade miembros del equipo primero.</span>'
   }</div></div>
   <label class="full">Acuerdos / notas<textarea id="mN">${esc(m.notes)}</textarea></label>
   ${tbm ? '<div class="note info">📅 Convocatoria registrada desde <b>Thunderbird</b>. El título, la fecha, la hora y la duración se cambian allí; aquí puedes completar el tipo, el proyecto, los asistentes y las notas.</div>' : ''}
   ${id && !editable ? '<div class="note info">Solo quien registró la reunión o el PM pueden modificarla.</div>' : ''}`;
  const scope = () => (occ ? val('mScope') : null);
  const freq = () => ($('#mRe') && !(occ && scope() === 'one') ? val('mRe') : '');
  const mode = () => (freq() && $('#mAm') ? val('mAm') : 'list');
  const delSeries = async (sid) => {
    S.meetings[sid] = SERIES[sid];
    await del('meetings', sid);
  };
  openDlg(
    id ? (editable ? 'Editar reunión' : 'Reunión') : 'Nueva reunión',
    body,
    async () => {
      const o = {
        title: val('mT'),
        type: val('mTy'),
        projectId: val('mP'),
        date: val('mD'),
        time: val('mH'),
        duration: m.duration || 60,
        notes: $('#mN').value,
      };
      const h0 = hm2min(o.time),
        h1 = hm2min(val('mF'));
      if (!tbm && h0 != null && h1 != null) {
        if (h1 <= h0) {
          toast('La hora de fin debe ser posterior a la de inicio.');
          return false;
        }
        o.duration = h1 - h0;
      }
      if (!o.title || !o.date) {
        toast('Indica título y fecha.');
        return false;
      }
      const F = freq(),
        M = mode();
      if (M === 'list' && !att.size) {
        toast('Marca al menos un asistente: la reunión se muestra en la fila de cada asistente.');
        return false;
      }
      if (M === 'project' && !projPeople(S.projects[o.projectId]).length) {
        toast('El proyecto elegido no tiene participantes: elige otro modo de asistentes.');
        return false;
      }
      if (F && (F === 'weekly' || F === 'biweekly') && !days.size) days.add((dow(dn(o.date)) + 6) % 7);
      const rep = {
        freq: F,
        days: [...days].sort(),
        until: $('#mUn') ? val('mUn') : '',
        skipHol: $('#mSh') ? $('#mSh').checked : true,
      };
      if (rep.until && rep.until < o.date) {
        toast('La fecha «Hasta» es anterior al inicio.');
        return false;
      }
      const serie = (date, cb) => ({
        isSeries: true,
        ...o,
        date,
        repeat: rep,
        attMode: M,
        attendees: M === 'list' ? [...att] : [],
        createdBy: cb,
        updatedAt: new Date().toISOString(),
      });
      if (tbm) {
        const ov = {
          type: o.type,
          projectId: o.projectId,
          attendees: [...att],
          notes: o.notes,
          tbOverride: true,
          createdBy: m.createdBy,
        };
        if (!(await save('meetings', id, ov))) return false;
        return;
      }
      if (occ) {
        const sc = scope();
        if (sc === 'one') {
          const ov = { occOverride: true, createdBy: sr.createdBy };
          const was = S.meetings[id];
          for (const k of FIELDS) {
            if ((was.overridden || []).includes(k)) ov[k] = was[k];
            if (String(o[k] ?? '') !== String(was[k] ?? '')) ov[k] = o[k];
          }
          const a = [...att].sort().join(),
            b = [...(was.attendees || [])].sort().join();
          if ((was.overridden || []).includes('attendees') || a !== b) ov.attendees = [...att];
          if (!(await save('meetings', id, ov))) return false;
          return;
        }
        if (!F) {
          toast('Para dejar de repetir, elige «Solo esta reunión» o borra la serie.');
          return false;
        }
        if (sc === 'all' || occ.occDate === sr.date) {
          if (!(await save('meetings', occ.seriesId, serie(sc === 'all' ? sr.date : o.date, sr.createdBy))))
            return false;
          return;
        }
        await save('meetings', occ.seriesId, {
          ...sr,
          repeat: { ...sr.repeat, until: iso(dn(occ.occDate) - 1) },
        });
        if (!(await save('meetings', null, serie(o.date, sr.createdBy)))) return false;
        return;
      }
      if (F) {
        if (!(await save('meetings', null, serie(o.date, me || m.createdBy)))) return false;
        if (id) await del('meetings', id);
        toast('Reunión periódica creada.');
        return;
      }
      if (!(await save('meetings', id, { ...o, attendees: [...att], updatedAt: new Date().toISOString() })))
        return false;
    },
    id
      ? occ
        ? async () => {
            const sc = scope();
            if (sc === 'one')
              await save('meetings', id, { occOverride: true, hidden: true, createdBy: sr.createdBy });
            else if (sc === 'all' || occ.occDate === sr.date) await delSeries(occ.seriesId);
            else
              await save('meetings', occ.seriesId, {
                ...sr,
                repeat: { ...sr.repeat, until: iso(dn(occ.occDate) - 1) },
              });
          }
        : tbm
          ? () => save('meetings', id, { hidden: true, tbOverride: true, createdBy: m.createdBy })
          : () => del('meetings', id)
      : null,
    editable,
  );
  mdField($('#mN'));
  {
    let len = +m.duration || 60;
    const H = $('#mH'),
      F = $('#mF');
    if (H && F) {
      H.onchange = () => {
        if (hm2min(H.value) != null) F.value = min2hm(Math.min(1439, hm2min(H.value) + len));
      };
      F.onchange = () => {
        const a = hm2min(H.value),
          b = hm2min(F.value);
        if (a != null && b != null && b > a) len = b - a;
      };
    }
  }
  if (tbm) {
    ['mT', 'mD', 'mH', 'mF'].forEach((i) => ($('#' + i).disabled = true));
    const d = $('#mDel');
    if (d) d.textContent = 'Ocultar en la herramienta';
  }
  const paint = () =>
    $('#mA')
      .querySelectorAll('[data-a]')
      .forEach((c) => c.classList.toggle('on', att.has(c.dataset.a)));
  const sync = () => {
    const b = $('#mAP');
    if (b) {
      const pp = projPeople(S.projects[val('mP')]);
      b.disabled = !pp.length || mode() !== 'list';
      b.title = pp.length
        ? 'Marca a: ' + pp.map((x) => mem(x).name).join(', ')
        : 'El proyecto elegido no tiene participantes registrados';
    }
    const rpBox = $('#mRp');
    if (rpBox) {
      const showRp = !(occ && scope() === 'one');
      rpBox.style.display = showRp ? 'grid' : 'none';
      const F = freq();
      $('#mDw').style.display = F === 'weekly' || F === 'biweekly' ? 'block' : 'none';
      $('#mShL').style.display = F && F !== 'daily' ? 'flex' : 'none';
      $('#mAmL').style.display = F ? 'flex' : 'none';
      $('#mUn').disabled = !F;
      const M = mode(),
        h = $('#mAmH');
      if (M !== 'list') {
        att = new Set(seriesAtt({ attMode: M, projectId: val('mP') }, val('mD') || todayS()));
        paint();
        h.innerHTML =
          M === 'team'
            ? 'Asisten todas las personas del equipo. Quien se incorpore después entra solo en las reuniones a partir de su <b>fecha de incorporación</b>.'
            : 'Asisten los participantes del proyecto elegido. Si cambian los participantes, cambian los asistentes.';
        h.style.display = 'block';
      } else {
        h.style.display = 'none';
      }
      $('#mA').style.opacity = M !== 'list' ? '.6' : '1';
    }
  };
  $('#mA')
    .querySelectorAll('[data-a]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          if (!editable || mode() !== 'list') return;
          const a = c.dataset.a;
          att.has(a) ? att.delete(a) : att.add(a);
          c.classList.toggle('on');
        }),
    );
  document.querySelectorAll('#mDw [data-wd]').forEach(
    (c) =>
      (c.onclick = () => {
        const k = +c.dataset.wd;
        days.has(k) ? days.delete(k) : days.add(k);
        c.classList.toggle('on');
      }),
  );
  for (const k of ['mP', 'mRe', 'mAm', 'mScope', 'mD'])
    if ($('#' + k)) $('#' + k).addEventListener('change', sync);
  sync();
  if ($('#mAP'))
    $('#mAP').onclick = () => {
      for (const x of projPeople(S.projects[val('mP')])) att.add(x);
      paint();
    };
}
function openProject(id) {
  if (!ME.owner) return;
  const p = id
    ? { ...S.projects[id] }
    : {
        color: PALETTE[Object.keys(S.projects).length % PALETTE.length],
        status: 'active',
        start: todayS(),
        ownerId: members().find((m) => m.isPM)?.id,
      };
  const parts = new Set([...(p.participants || []), ...(id && p.ownerId ? [p.ownerId] : [])]);
  const body = `<label class="full">Nombre<input type="text" id="pN" value="${esc(p.name)}"></label>
   <label>Código corto <span class="mut" style="font-weight:400">· automático</span><div style="display:flex;gap:4px"><input type="text" id="pC" value="${esc(p.code || '')}" placeholder="se genera con el nombre" style="flex:1"><button type="button" class="btn sm" id="pCa" title="Volver a generarlo a partir del nombre">↻</button></div></label>
   <label>Color<input type="color" id="pCo" value="${esc(p.color || '#2f5bea')}" style="height:34px;width:100%;border:1px solid var(--line);border-radius:7px"></label>
   <label>Responsable<select id="pO">${opt(
     pickMembers([p.ownerId]).map((m) => [m.id, m.name]),
     p.ownerId,
     '—',
   )}</select></label>
   <label>Estado<select id="pS">${opt(PSTATUS, p.status || 'active')}</select></label>
   ${ME.owner && EVKEY ? `<label class="full" style="flex-direction:row;align-items:center;gap:8px;background:#f9fafb;border:1px solid var(--line);border-radius:8px;padding:8px 10px"><input type="checkbox" id="pPriv" ${p.priv ? 'checked' : ''} style="width:auto"> <span>🔒 <b>Privado (solo yo)</b> <span class="mut" style="font-weight:400">· el equipo no lo ve en ningún sitio; se guarda cifrado con tu contraseña. Sus tareas usan tu calendario privado (${privH()} h/día, todos los días) y no cuentan en tu jornada laboral.</span></span></label>` : ''}
   <label>Tipo<select id="pTy">${opt(
     ptypes().map((t) => [t.id, t.name]),
     ptypeOf(p.type) ? p.type : '',
     '— Sin tipo —',
   )}</select></label>
   <label>Programa / organismo<input type="text" id="pPg" value="${esc(p.program || '')}" placeholder="p. ej. Horizonte Europa, plan nacional de I+D…"></label>
   <label>Inicio<input type="date" id="pSt" value="${esc(p.start || '')}"></label>
   <label>Fin objetivo<input type="date" id="pE" value="${esc(p.end || '')}"></label>
   <div class="full" id="pPaW" style="${p.priv ? 'display:none' : ''}"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Participantes del equipo <span class="mut" style="font-weight:400">(el responsable cuenta siempre como participante)</span></div><div id="pPa" style="display:flex;gap:6px;flex-wrap:wrap">${
     pickMembers([...parts])
       .map((x) => `<span class="chip ${parts.has(x.id) ? 'on' : ''}" data-pa="${x.id}">${who(x.id)}</span>`)
       .join('') || '<span class="hint">Añade miembros del equipo primero.</span>'
   }</div></div>
   <div class="full" id="pSx"></div>
   <label class="full">Descripción<textarea id="pD">${esc(p.description)}</textarea></label>`;
  openDlg(
    id ? 'Editar proyecto' : 'Nuevo proyecto',
    body,
    async () => {
      const prev = id ? S.projects[id]?.status || 'active' : 'active',
        nst = val('pS');
      const wasPriv = !!(id && S.projects[id]?.priv),
        isPriv = !!($('#pPriv') && $('#pPriv').checked);
      if (
        isPriv &&
        !wasPriv &&
        id &&
        arr('tasks').some((t) => t.projectId === id && t.assigneeId && t.assigneeId !== myMemberId())
      ) {
        toast('Para hacerlo privado, todas sus tareas deben estar asignadas a ti.');
        return false;
      }
      const o = {
        ...(id ? S.projects[id] : {}),
        name: val('pN'),
        code: (val('pC') || autoCode(val('pN'), id)).toUpperCase(),
        color: $('#pCo').value,
        ownerId: val('pO'),
        status: val('pS'),
        type: val('pTy'),
        program: val('pPg'),
        participants: [...parts].filter((x) => x !== val('pO')),
        start: val('pSt'),
        end: val('pE'),
        description: $('#pD').value,
      };
      delete o.id;
      const tItems = [];
      const PO = id ? projOpen(S.projects[id]) : null;
      if (id && prev !== nst) {
        const now = new Date().toISOString(),
          me_ = ME.memberId || 'pm';
        const T = (tid) => {
          const x = { ...S.tasks[tid] };
          delete x.id;
          x.hist = JSON.parse(JSON.stringify(hist(x)));
          return x;
        };
        const closeGrp = (date, ends) => {
          const out = [];
          for (const t of arr('tasks')) {
            const oe = openEv(t);
            if (!oe || !PO || oe.grp !== PO.grp) continue;
            const x = T(t.id);
            const l = x.hist[x.hist.length - 1];
            l.to = date;
            l.endBefore = x.end;
            l.endAfter = ends ? ends[t.id] || x.end : x.end;
            x.end = l.endAfter;
            out.push([t.id, x]);
          }
          return out;
        };
        o.hist = JSON.parse(JSON.stringify(o.hist || []));
        if (nst === 'paused') {
          if (prev === 'cancelled') {
            toast('Un proyecto cancelado se reactiva primero (estado «Activo»).');
            return false;
          }
          const from = val('pPzD') || todayS(),
            why = val('pPzW'),
            grp = 'pg-' + newId(),
            ids = [...document.querySelectorAll('#pSx [data-pz]:checked')]
              .map((c) => c.dataset.pz)
              .filter((x) => !openEv(S.tasks[x]));
          for (const tid of ids) {
            const x = T(tid);
            x.hist.push({ k: 'pause', from, to: '', why, grp, by: me_, at: now });
            tItems.push([tid, x]);
          }
          o.hist.push({ k: 'pause', from, to: '', why, grp, tasks: ids, by: me_, at: now });
        } else if (nst === 'cancelled') {
          const from = val('pCxD') || todayS(),
            why = val('pCxM'),
            grp = 'pg-' + newId();
          if (prev === 'paused' && PO) {
            for (const [tid, x] of closeGrp(from, null)) tItems.push([tid, x]);
            PO.to = from;
            const l = o.hist[o.hist.length - 1];
            if (l && !l.to) l.to = from;
          }
          const ids = [];
          for (const t of arr('tasks').filter((t) => t.projectId === id && t.status !== 'done')) {
            const ex = tItems.find((z) => z[0] === t.id);
            const x = ex ? ex[1] : T(t.id);
            if (!ex && openEv(t)) continue;
            x.hist.push({ k: 'cancel', from, to: '', why, grp, by: me_, at: now });
            if (!ex) tItems.push([t.id, x]);
            ids.push(t.id);
          }
          o.hist.push({ k: 'cancel', from, to: '', why, grp, tasks: ids, by: me_, at: now });
        } else if ((prev === 'paused' || prev === 'cancelled') && PO) {
          const date = val('pRsD') || todayS();
          if (date < PO.from) {
            toast('La fecha de reanudación no puede ser anterior al ' + fmt(PO.from) + '.');
            return false;
          }
          const ends = {};
          document.querySelectorAll('#pSx [data-rse]').forEach((inp) => (ends[inp.dataset.rse] = inp.value));
          for (const [tid, x] of closeGrp(date, ends)) tItems.push([tid, x]);
          const l = o.hist[o.hist.length - 1];
          if (l && !l.to) {
            l.to = date;
            if (val('pRsW')) l.note = val('pRsW');
          }
        }
      }
      delete o.pausedTasks;
      delete o.pausedAt;
      delete o.pauses;
      delete o.cancelledAt;
      delete o.cancelReason;
      if (isPriv) {
        o.priv = true;
        o.participants = [];
        o.ownerId = myMemberId() || o.ownerId;
      } else delete o.priv;
      if (!o.name) {
        toast('Ponle nombre al proyecto.');
        return false;
      }
      const pid_ = await save('projects', id, o);
      if (!pid_) return false;
      if (id && isPriv !== wasPriv) {
        const ts = isPriv
          ? arr('tasks').filter((t) => t.projectId === id && !t.priv)
          : Object.entries(PRDATA.tasks)
              .filter(([, t]) => t.projectId === id && !t._del)
              .map(([tid, t]) => ({ ...t, id: tid }));
        for (const t of ts) {
          const d = { ...t };
          delete d.id;
          delete d.priv;
          if (isPriv) d.assigneeId = myMemberId() || d.assigneeId;
          await save('tasks', t.id, d);
        }
        toast(
          isPriv
            ? `Proyecto privado: ${ts.length} tarea(s) pasan a ser privadas.`
            : `Proyecto público: ${ts.length} tarea(s) pasan a ser visibles para el equipo.`,
        );
      }
      if (tItems.length) {
        await saveMany('tasks', tItems);
        toast(tItems.length + ' tarea(s) actualizada(s).');
      }
    },
    id
      ? () => {
          if (arr('tasks').some((t) => t.projectId === id)) {
            toast('El proyecto tiene tareas: bórralas o muévelas antes.');
            return;
          }
          del('projects', id);
        }
      : null,
  );
  {
    const prevS = p.status || 'active',
      PO = id ? projOpen(p) : null;
    const sx = () => {
      const v = val('pS'),
        open = id
          ? arr('tasks')
              .filter((t) => t.projectId === id && t.status !== 'done')
              .sort((a, b) => String(a.start).localeCompare(String(b.start)))
          : [];
      let h = '';
      const histT = (p.hist || []).length
        ? `<div style="margin-top:8px"><div class="hint" style="margin-bottom:2px">Historial del proyecto</div><table class="pzt"><thead><tr><th>Registro</th><th>Desde</th><th>Hasta</th><th>Tareas</th><th>Motivo</th></tr></thead><tbody>${p.hist.map((e) => `<tr><td>${e.k === 'pause' ? '⏸ Pausa' : '✕ Cancelación'}</td><td>${fmt(e.from)}</td><td>${e.to ? fmt(e.to) : '<i>en curso</i>'}</td><td>${(e.tasks || []).length || '—'}</td><td>${esc(e.why || '')}${e.note ? ' <span class="mut">· ' + esc(e.note) + '</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '';
      if (id && v === 'paused' && prevS !== 'paused') {
        const free = open.filter((t) => !openEv(t));
        h = `<div class="pzf" style="background:#fffaeb;border-color:#fedf89"><div style="font-weight:600;margin-bottom:6px">Pausar el proyecto</div><div style="display:grid;grid-template-columns:170px 1fr;gap:8px"><label>Fecha de pausa<input type="date" id="pPzD" value="${todayS()}"></label><label>Motivo<input type="text" id="pPzW" placeholder="p. ej. a la espera de financiación"></label></div><div style="margin:8px 0 4px">Tareas que se pausan (cada una guarda la pausa en su historial). <b>Desmarca las que siguen en curso</b>, por ejemplo las que el responsable sigue llevando.</div>${free.length ? free.map((t) => `<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="pz-${t.id}" data-pz="${t.id}" checked style="width:16px;height:16px;flex:0 0 auto;margin:0"><span style="cursor:pointer" onclick="document.getElementById('pz-${t.id}').click()">${esc(t.name)}</span><span class="mut" style="display:flex;gap:6px;align-items:center">· ${who(t.assigneeId, true)} ${fmt(t.start)}–${fmt(t.end)} · ${t.progress || 0}%</span></div>`).join('') : '<span class="hint">No hay tareas abiertas sin pausar.</span>'}${open.length > free.length ? `<div class="hint">${open.length - free.length} tarea(s) ya estaban en pausa o canceladas por su cuenta y no se tocan.</div>` : ''}</div>`;
      } else if (id && v === 'cancelled' && prevS !== 'cancelled')
        h = `<div class="pzf" style="background:#fef3f2;border-color:#fecdca"><div style="font-weight:600;margin-bottom:6px">Cancelar el proyecto</div><div style="display:grid;grid-template-columns:170px 1fr;gap:8px"><label>Fecha de cancelación<input type="date" id="pCxD" value="${todayS()}"></label><label>Motivo<input type="text" id="pCxM" placeholder="p. ej. el cliente retira la financiación"></label></div><div style="margin-top:6px">Las tareas abiertas pasan a <b>canceladas</b>${prevS === 'paused' ? ' (las que estaban en pausa con el proyecto cierran su pausa en esa fecha)' : ''}: dejan de contar en la carga, las fechas previstas, los avisos y el cumplimiento. Las tareas terminadas y sus evaluaciones se conservan. Si reactivas el proyecto, las tareas vuelven a estar abiertas.</div></div>`;
      else if (id && PO && (v === 'active' || v === 'closed')) {
        const aff = arr('tasks')
          .filter((t) => openEv(t)?.grp === PO.grp)
          .sort((a, b) => String(a.start).localeCompare(String(b.start)));
        h = `<div class="pzf"><div style="font-weight:600;margin-bottom:6px">${PO.k === 'pause' ? 'Reanudar el proyecto' : 'Reactivar el proyecto'} <span class="mut" style="font-weight:400">· ${PO.k === 'pause' ? 'en pausa' : 'cancelado'} desde el ${fmt(PO.from)}</span></div><div style="display:grid;grid-template-columns:170px 1fr;gap:8px"><label>Fecha de ${PO.k === 'pause' ? 'reanudación' : 'reactivación'}<input type="date" id="pRsD" value="${todayS()}"></label><label>Nota (opcional)<input type="text" id="pRsW"></label></div>${aff.length ? `<table class="pzt" style="margin-top:8px"><thead><tr><th>Tarea</th><th></th><th>Plan vigente</th><th>Días lab.</th><th>Nuevo fin planificado</th></tr></thead><tbody>${aff.map((t) => `<tr><td>${esc(t.name)}</td><td>${who(t.assigneeId, true)}</td><td>${fmt(t.start)} – ${fmt(t.end)}</td><td data-rsn="${t.id}"></td><td><input type="date" data-rse="${t.id}" style="width:150px"></td></tr>`).join('')}</tbody></table><div class="hint">Cada fin se desplaza los días laborables que ha durado la ${PO.k === 'pause' ? 'pausa' : 'cancelación'} para su responsable; puedes cambiar cualquiera a mano.</div>` : '<div class="hint" style="margin-top:6px">No hay tareas afectadas.</div>'}</div>`;
      } else if (id && PO && v === prevS)
        h = `<div class="note ${PO.k === 'pause' ? 'warn' : 'bad'}" style="margin:0">${PO.k === 'pause' ? '⏸ En pausa' : '✕ Cancelado'} desde el ${fmt(PO.from)}${PO.why ? ' · ' + esc(PO.why) : ''}. Para ${PO.k === 'pause' ? 'reanudarlo' : 'reactivarlo'}, cambia el estado a «Activo».</div>`;
      $('#pSx').innerHTML = h + histT;
      const rs = $('#pRsD');
      if (rs && PO) {
        const touched = new Set();
        const calc = () => {
          document.querySelectorAll('#pSx [data-rse]').forEach((inp) => {
            const t = tk(inp.dataset.rse);
            const n = gapWork(t.assigneeId, PO.from, rs.value);
            document.querySelector(`#pSx [data-rsn="${t.id}"]`).textContent = n;
            if (!touched.has(t.id)) inp.value = iso(addWork(t.assigneeId, dn(t.end), n));
          });
        };
        document
          .querySelectorAll('#pSx [data-rse]')
          .forEach((inp) => inp.addEventListener('input', () => touched.add(inp.dataset.rse)));
        rs.onchange = calc;
        calc();
      }
    };
    $('#pS').addEventListener('change', sx);
    sx();
  }
  {
    let manual = !!(id && p.code && p.code !== autoCode(p.name, id));
    const gen = () => {
      $('#pC').value = val('pN').trim() ? autoCode(val('pN'), id) : '';
    };
    $('#pN').addEventListener('input', () => {
      if (!manual) gen();
    });
    $('#pC').addEventListener('input', () => {
      manual = !!$('#pC').value.trim();
    });
    $('#pCa').onclick = () => {
      manual = false;
      gen();
    };
  }
  if ($('#pPriv'))
    $('#pPriv').onchange = () => {
      $('#pPaW').style.display = $('#pPriv').checked ? 'none' : '';
    };
  $('#pPa')
    ?.querySelectorAll('[data-pa]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          const a = c.dataset.pa;
          parts.has(a) ? parts.delete(a) : parts.add(a);
          c.classList.toggle('on');
        }),
    );
}
function openBulkMeetings(ids) {
  const ms = ids
    .map((id) => (S.meetings[id] ? { id, ...S.meetings[id] } : null))
    .filter((x) => x && canEditMeeting(x));
  if (!ms.length) return;
  const tb = ms.filter((x) => x.source === 'thunderbird').length,
    ds = ms.map((x) => x.date).sort();
  const add = new Set(),
    rem = new Set();
  const chips = (k) =>
    members()
      .map((x) => `<span class="chip" data-${k}="${x.id}">${who(x.id)}</span>`)
      .join('');
  const body = `<div class="full"><p style="margin:0 0 6px"><b>${ms.length}</b> reunión(es) del ${fmt(ds[0])} al ${fmt(ds[ds.length - 1])}${tb ? ` · ${tb} vienen de Thunderbird (en esas solo cambian asistentes, proyecto y tipo)` : ''}. Solo se cambia lo que toques; lo demás se queda como está.</p></div>
   <div class="full"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Añadir como asistentes</div><div id="bA" style="display:flex;gap:6px;flex-wrap:wrap">${chips('ba')}</div></div>
   <div class="full"><div style="font-weight:500;font-size:12px;color:#344054;margin-bottom:6px">Quitar de los asistentes</div><div id="bR" style="display:flex;gap:6px;flex-wrap:wrap">${chips('br')}</div></div>
   <label>Proyecto<select id="bP"><option value="__keep">— No cambiar —</option><option value="">General (varios proyectos)</option>${projects()
     .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
     .join('')}</select></label>
   <label>Tipo<select id="bT"><option value="__keep">— No cambiar —</option>${Object.entries(MTYPE)
     .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`)
     .join('')}</select></label>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Hora de inicio<input type="time" id="bH"></label><label>Hora de fin<input type="time" id="bF"></label></div>
   <div class="hint" style="align-self:end">Horas vacías = no cambiar.${tb ? ' No se aplican a las de Thunderbird.' : ''}</div>
   <div class="full hint" id="bSum"></div>`;
  openDlg('Modificar ' + ms.length + ' reunión(es)', body, async () => {
    const P = val('bP'),
      T = val('bT'),
      H = val('bH'),
      F = val('bF');
    if (!add.size && !rem.size && P === '__keep' && T === '__keep' && !H && !F) {
      toast('No has cambiado nada.');
      return false;
    }
    if (H && F && hm2min(F) <= hm2min(H)) {
      toast('La hora de fin debe ser posterior a la de inicio.');
      return false;
    }
    // new length of a meeting: from its (new) start time to the end time given
    const durOf = (x) => {
      const a = hm2min(H || x.time),
        b = hm2min(F);
      return F && a != null && b > a ? b - a : 0;
    };
    const items = [];
    let empty = 0;
    for (const x of ms) {
      let at = new Set(x.attendees || []);
      for (const a of add) at.add(a);
      for (const r of rem) at.delete(r);
      if (!at.size) {
        empty++;
        continue;
      }
      const ch = { attendees: [...at] };
      if (P !== '__keep') ch.projectId = P;
      if (T !== '__keep') ch.type = T;
      const { id, ...cur } = x;
      if (x.seriesId) {
        const ov = { occOverride: true, createdBy: x.createdBy };
        for (const k of x.overridden || []) ov[k] = x[k];
        if (add.size || rem.size) ov.attendees = ch.attendees;
        if (P !== '__keep') ov.projectId = P;
        if (T !== '__keep') ov.type = T;
        if (H) ov.time = H;
        if (durOf(x)) ov.duration = durOf(x);
        items.push([id, ov]);
        continue;
      }
      if (x.source === 'thunderbird')
        items.push([
          id,
          {
            type: ch.type ?? x.type,
            projectId: ch.projectId ?? x.projectId,
            attendees: ch.attendees,
            notes: x.notes || '',
            tbOverride: true,
            createdBy: x.createdBy,
          },
        ]);
      else {
        if (H) ch.time = H;
        if (durOf(x)) ch.duration = durOf(x);
        items.push([
          id,
          { ...cur, ...ch, createdBy: x.createdBy || ME.memberId, updatedAt: new Date().toISOString() },
        ]);
      }
    }
    if (!items.length) {
      toast('Todas quedarían sin asistentes: no se ha cambiado nada.');
      return false;
    }
    await saveMany('meetings', items);
    UI.meetPick = new Set();
    UI.meetSel = false;
    render();
    toast(
      `${items.length} reunión(es) modificada(s).${empty ? ` ${empty} no se tocaron porque quedarían sin asistentes.` : ''}`,
    );
  });
  const sum = () => {
    const a = [...add].map((x) => mem(x).name),
      r = [...rem].map((x) => mem(x).name);
    $('#bSum').innerHTML =
      (a.length ? `Se añade a <b>${esc(a.join(', '))}</b>. ` : '') +
      (r.length ? `Se quita a <b>${esc(r.join(', '))}</b>.` : '');
  };
  $('#bA')
    .querySelectorAll('[data-ba]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          const k = c.dataset.ba;
          if (add.has(k)) add.delete(k);
          else {
            add.add(k);
            rem.delete(k);
            $(`#bR [data-br="${k}"]`).classList.remove('on');
          }
          c.classList.toggle('on', add.has(k));
          sum();
        }),
    );
  $('#bR')
    .querySelectorAll('[data-br]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          const k = c.dataset.br;
          if (rem.has(k)) rem.delete(k);
          else {
            rem.add(k);
            add.delete(k);
            $(`#bA [data-ba="${k}"]`).classList.remove('on');
          }
          c.classList.toggle('on', rem.has(k));
          sum();
        }),
    );
}

/* ---------- traspasar una tarea a otra persona ---------- */
// The part done so far stays with the current owner (closed on the handover date);
// the rest becomes a linked task for the new owner. Tasks that depended on it follow the new one.
function openHandover(id, backTo) {
  const t = tk(id);
  if (!t || !ME.owner) return;
  const cur = mem(t.assigneeId),
    lf = cur?.leftOn,
    T = todayS();
  const day0 = lf && lf < t.end ? lf : T > t.end ? t.end : T < t.start ? t.start : T;
  const rem = Math.round(remHours(t) * 10) / 10;
  const body = `<div class="full note info">Lo hecho hasta la fecha de traspaso queda a nombre de <b>${esc(cur?.name || '—')}</b> como parte terminada. Lo que falta pasa a otra persona como una tarea enlazada, y las tareas que dependían de esta pasan a depender de la continuación.</div>
   <div class="full"><b data-notr>${esc(t.name)}</b> <span class="mut">· ${fmt(t.start)}–${fmt(t.end)} · ${t.progress || 0} %</span></div>
   <label>Nuevo responsable<select id="hM">${opt(
     activeMembers()
       .filter((m) => m.id !== t.assigneeId)
       .map((m) => [m.id, m.name]),
     '',
     '—',
   )}</select></label>
   <label>Último día de ${esc(cur?.name || '')}<input type="date" id="hD" value="${day0}" min="${esc(t.start)}"></label>
   <label>Inicio de la continuación<input type="date" id="hS"></label>
   <label>Fin planificado<input type="date" id="hE" value="${esc(t.end)}"></label>
   <label>Horas pendientes que se traspasan<input type="number" min="0" step="1" id="hH" value="${rem}"></label>
   <label>Dedicación prevista (% de su jornada)<input type="number" min="5" max="100" step="5" id="hP" value="${t.dedication ?? 100}"></label>
   <div class="full hint" id="hI"></div>`;
  openDlg('Traspasar la tarea', body, async () => {
    const mid = val('hM'),
      d = val('hD'),
      s = val('hS'),
      e = val('hE'),
      h = +val('hH') || 0;
    if (!mid) {
      toast('Elige a quién se traspasa.');
      return false;
    }
    if (!d || d < t.start) {
      toast(
        'El último día no puede ser anterior al inicio de la tarea. Para pasarla entera, cambia el responsable en su ficha.',
      );
      return false;
    }
    if (!s || s <= d || !e || e < s) {
      toast('Revisa las fechas de la continuación.');
      return false;
    }
    const nid = newId(),
      base = { ...t };
    delete base.id;
    const total = estHours(t);
    const first = {
      ...base,
      end: d < t.end ? d : t.end,
      realStart: t.realStart || t.start,
      realEnd: d,
      status: 'done',
      progress: 100,
      estimatedHours: Math.max(0, Math.round((total - h) * 10) / 10) || undefined,
      remainingHours: undefined,
      blockReason: '',
      handover: { to: nid, member: mid, on: d, progress: t.progress || 0, end: t.end },
    };
    const next = {
      projectId: t.projectId,
      name: t.name,
      origin: t.origin || 'plan',
      priority: t.priority || 'media',
      description: t.description || '',
      detectedBy: t.detectedBy,
      detectedOn: t.detectedOn,
      assigneeId: mid,
      start: s,
      end: e,
      dedication: +val('hP') || 100,
      estimatedHours: h || undefined,
      progress: 0,
      status: 'pending',
      deps: [id],
      contOf: id,
    };
    const succ = successors(id);
    if (!(await save('tasks', id, first))) return false;
    await save('tasks', nid, next);
    for (const x of succ) {
      const o = { ...x, deps: (x.deps || []).map((k) => (k === id ? nid : k)) };
      delete o.id;
      await save('tasks', x.id, o);
    }
    toast(`Tarea traspasada a ${mem(mid)?.name || ''}.`);
    if (backTo && leavingTasks(backTo).length) setTimeout(() => openLeaving(backTo), 50);
  });
  $('#mSave').textContent = 'Traspasar';
  const upd = () => {
    const mid = val('hM'),
      d = dn(val('hD'));
    if (d != null && mid && document.activeElement?.id !== 'hS') $('#hS').value = iso(addWork(mid, d, 1));
    else if (d != null && !val('hS')) $('#hS').value = iso(d + 1);
    const s = dn(val('hS'));
    // the original end may already be too close: propose the end the remaining hours need
    if (
      mid &&
      s != null &&
      (dn(val('hE')) == null || dn(val('hE')) < s) &&
      document.activeElement?.id !== 'hE'
    ) {
      const perDay = (capOf(mid) * (+val('hP') || 100)) / 100;
      $('#hE').value = iso(addWork(mid, s - 1, Math.max(1, Math.ceil((+val('hH') || 0) / perDay))));
    }
    const e = dn(val('hE'));
    let info = '';
    if (mid && s != null && e != null && e >= s) {
      const days = workDays(mid, s, e),
        cap = (days * capOf(mid) * (+val('hP') || 100)) / 100,
        h = +val('hH') || 0;
      info = `${esc(mem(mid).name)} tiene ${days} días laborables en ese periodo: unas ${Math.round(cap)} h con esa dedicación, para ${h} h pendientes.`;
      if (h > cap + 0.5)
        info += ' <b style="color:#b42318">No llega al fin planificado: amplía la fecha o la dedicación.</b>';
    }
    $('#hI').innerHTML = info;
  };
  ['hM', 'hD', 'hS', 'hE', 'hH', 'hP'].forEach((i) => $('#' + i).addEventListener('change', upd));
  upd();
}
