/* ---------- vista: ajustes ---------- */
function vAjustes() {
  const w = weights();
  let h = '';
  h += `<div class="grid2"><div class="card"><h3 style="display:flex">Proyectos<span class="sp"></span>${ME.owner ? '<button class="btn sm pri" id="addProj">+ Proyecto</button>' : ''}</h3>`;
  const ps = projects();
  h += ps.length
    ? ps
        .map((p) => {
          const n = arr('tasks').filter((t) => t.projectId === p.id).length;
          return `<div class="list-row" ${ME.owner ? `data-editproj="${p.id}" style="cursor:pointer"` : ''}><span class="dot" style="background:${esc(p.color)}"></span><div style="flex:1"><b>${esc(p.name)}</b> <span class="mut">${esc(p.code || '')}</span>${ptypeTag(p.type)}${pstatusTag(p)}<div class="mut">${p.program ? esc(p.program) + ' · ' : ''}${fmt(p.start)} – ${fmt(p.end)} · ${n} tareas · ${pstatusLbl(p.status)}${(() => {
            const o = projOpen(p);
            if (!o) return '';
            const n = arr('tasks').filter((t) => openEv(t)?.grp === o.grp).length;
            return (
              (o.k === 'pause' ? ' desde ' : ' el ') +
              fmt(o.from) +
              (n ? ' · ' + n + ' tarea(s) ' + (o.k === 'pause' ? 'pausada(s)' : 'cancelada(s)') : '')
            );
          })()}</div></div><div style="display:flex;gap:2px;align-items:center" title="Responsable y participantes">${projPeople(
            p,
          )
            .map(
              (m) =>
                who(m, true) +
                (m === p.ownerId
                  ? '<span class="mut" style="font-size:10px;margin-right:4px">resp.</span>'
                  : ''),
            )
            .join('')}</div></div>`;
        })
        .join('')
    : '<div class="hint">Sin proyectos todavía.</div>';
  h += `</div><div class="card"><h3 style="display:flex">Equipo<span class="sp"></span>${ME.owner ? '<button class="btn sm pri" id="addMem">+ Miembro</button>' : ''}</h3>`;
  const ms = members();
  h += ms.length
    ? ms
        .map(
          (m) =>
            `<div class="list-row" ${ME.owner ? `data-editmem="${m.id}" style="cursor:pointer"` : ''}>${who(m.id)}<span class="mut" style="flex:1">${esc(m.role || '')}${schedLbl(m.id) || (+m.hoursPerDay && +m.hoursPerDay !== 8) ? ` <span class="tag mut" title="Jornada">${schedLbl(m.id) ? schedLbl(m.id) + ' · ' : ''}${+m.hoursPerDay || 8} h/día</span>` : ''}${(() => {
              const ps = projectsOf(m.id);
              return ps.length
                ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">${ps.map((p) => `<span class="tag" style="background:${esc(p.color || '#98a2b3')}22;color:#344054" title="${esc(p.name)}${p.ownerId === m.id ? ' · responsable' : ''}">${esc(p.code || p.name)}${p.ownerId === m.id ? ' ★' : ''}</span>`).join('')}</div>`
                : '';
            })()}</span>${m.isPM ? '<span class="tag lv3">PM</span>' : ''}${m.email ? (ME.owner ? `<span class="mut" style="font-size:12px">${esc(m.email)}</span>` : '') : '<span class="tag warn" title="Sin correo no puede iniciar sesión">sin correo</span>'}</div>`,
        )
        .join('')
    : '<div class="hint">Añade a tu equipo, incluido tú como project manager.</div>';
  h += `</div></div>`;
  h += `<div class="card" style="margin-top:14px"><h3 style="display:flex">Centros de trabajo y calendario laboral<span class="sp"></span>${ME.owner ? '<button class="btn sm pri" id="addCenter">+ Centro</button>' : ''}</h3>
   <p class="hint">Cada persona tiene tres niveles de días no laborables: los <b>festivos nacionales</b> (todo el equipo), los <b>autonómicos y locales</b> de su centro de trabajo y sus <b>ausencias personales</b> (pestaña Ausencias).</p>
   ${centers()
     .map((c, i) => {
       const ms = members().filter((m) => centerOf(m.id).id === c.id);
       const y = String(UI.year);
       const nl = arr('holidays').filter(
         (x) =>
           (x.date || '').startsWith(y) && x.scope === 'local' && norm(holMuni(x)) === norm(c.municipality),
       ).length;
       return `<div class="list-row" ${ME.owner ? `data-center="${i}" style="cursor:pointer"` : ''}><div style="flex:1"><b>${esc(c.name)}</b> <span class="mut">· ${esc(c.municipality)} · ${esc(c.region || 'Comunidad de Madrid')}</span><div class="mut" style="font-size:12px">${nl} festivo(s) local(es) en ${y}${nl < 2 ? ' <span class="tag warn">faltan festivos locales</span>' : ''}</div></div><div style="display:flex;gap:2px">${ms.map((m) => who(m.id, true)).join('') || '<span class="mut">sin personas</span>'}</div></div>`;
     })
     .join('')}</div>`;
  if (ME.owner)
    h += `<div class="card" style="margin-top:14px"><h3>Índice de calidad de cumplimiento 🔒</h3><p class="hint">Solo tú lo ves y lo editas. Cada tarea completada recibe un índice de 0 a 100 que combina cuatro componentes.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:10px 0">
   <label class="hint"><b>Plazo</b> · peso <input type="number" min="0" max="100" id="wPlazo" value="${w.plazo}" style="width:70px"><br>100 si termina en fecha; baja en proporción al retraso respecto a la duración planificada (mín. 5 días).</label>
   <label class="hint"><b>Calidad</b> · peso <input type="number" min="0" max="100" id="wCal" value="${w.calidad}" style="width:70px"><br>Tu valoración 1–5 ★ (×20).</label>
   <label class="hint"><b>Alcance</b> · peso <input type="number" min="0" max="100" id="wAlc" value="${w.alcance}" style="width:70px"><br>% de lo comprometido que se entregó realmente.</label>
   <label class="hint"><b>Retrabajo</b> · peso <input type="number" min="0" max="100" id="wRet" value="${w.retrabajo}" style="width:70px"><br>−30 puntos por cada vez que hubo que rehacerla.</label></div>
  <div style="display:flex;gap:10px;align-items:center"><button class="btn pri" id="saveW">Guardar pesos</button><span class="hint">Niveles: <span class="tag lv4">Excelente ≥ 90</span> <span class="tag lv3">Bueno 75–89</span> <span class="tag lv2">Aceptable 60–74</span> <span class="tag lv1">Deficiente &lt; 60</span></span></div></div>`;
  if (ME.owner) {
    const pt = ptypes();
    h += `<div class="card" style="margin-top:14px"><h3 style="display:flex">Tipos de proyecto<span class="sp"></span><button class="btn sm" id="addPt">+ Tipo</button></h3><p class="hint">Lista que aparece en la ficha de cada proyecto. Cambia los nombres, los colores o el orden (↑) como quieras. Al cambiar un nombre, se actualiza en todos los proyectos que lo usan. Solo se puede quitar un tipo que no esté en uso.</p><table id="ptT">${
      pt
        .map((t, i) => {
          const n = arr('projects').filter((p) => p.type === t.id).length;
          return `<tr data-pt="${esc(t.id)}"><td style="width:46px"><input type="color" class="ptC" value="${esc(t.color || '#667085')}" style="height:30px;width:40px;border:1px solid var(--line);border-radius:6px;padding:1px"></td><td><input type="text" class="ptN" value="${esc(t.name)}" style="width:100%"></td><td class="mut" style="width:110px;white-space:nowrap">${n} proyecto(s)</td><td style="width:80px;white-space:nowrap">${i ? `<button class="btn sm ptUp" title="Subir">↑</button>` : ''}<button class="btn sm ptDel" ${n ? 'disabled title="En uso: cambia antes el tipo de esos proyectos"' : 'title="Quitar"'}>✕</button></td></tr>`;
        })
        .join('') || '<tr><td class="hint">Sin tipos. Pulsa + Tipo.</td></tr>'
    }</table><div style="margin-top:10px"><button class="btn pri" id="savePt">Guardar tipos</button></div></div>`;
  }
  if (ME.owner)
    h += `<div class="card" style="margin-top:14px"><h3>Escala de calidad (estrellas) 🔒</h3><p class="hint">Es la referencia que verás al evaluar cada tarea. Ajusta los textos a vuestros criterios.</p><table>${[5, 4, 3, 2, 1].map((i) => `<tr><td style="white-space:nowrap;color:#f5a524;width:90px">${'★'.repeat(i)}<span style="color:#d0d5dd">${'★'.repeat(5 - i)}</span></td><td style="width:100px"><b>${RLBL[i - 1]}</b></td><td><input type="text" id="rb${i}" value="${esc(rubric()[i - 1])}" style="width:100%"></td></tr>`).join('')}</table><div style="margin-top:10px;display:flex;gap:8px"><button class="btn pri" id="saveRb">Guardar escala</button><button class="btn" id="resetRb">Restaurar textos por defecto</button></div></div>`;
  if (ME.owner && EVKEY)
    h += `<div class="card" style="margin-top:14px"><h3>Proyectos privados 🔒</h3><p class="hint">Marca un proyecto como «Privado (solo yo)» en su ficha. Solo tú lo ves (cifrado con tu contraseña en «privado-pm.json»); el equipo no ve nada en ninguna vista, cálculo ni calendario .ics. Sus tareas no cuentan en tu jornada laboral y su fecha prevista se calcula con este calendario propio, todos los días (también fines de semana y festivos).</p><div style="display:flex;gap:8px;align-items:end"><label style="max-width:200px">Horas al día para lo privado<input type="number" id="pvH" min="0.5" max="16" step="0.5" value="${privH()}"></label><button class="btn" id="pvHs">Guardar</button><span class="hint">${Object.values(PRDATA.projects).filter((x) => !x._del).length} proyecto(s) privado(s) · ${Object.values(PRDATA.tasks).filter((x) => !x._del).length} tarea(s)</span></div></div>`;
  h += `<div class="card" style="margin-top:14px"><h3>Versión de la herramienta</h3><p style="margin:4px 0"><b>Versión ${esc(APP_BUILD)}</b> <span class="mut">(fecha y hora de publicación, hora de Madrid)</span></p><p class="hint">Para actualizar, sustituye solo el archivo .html de la herramienta en la carpeta de OneDrive; los datos de la carpeta «datos» se conservan. Si alguien tiene la herramienta abierta, que recargue la página (F5).</p>${APP_NEWS.length ? `<div style="font-weight:600;font-size:12.5px;margin-top:8px">Novedades de esta versión</div><ul style="margin:4px 0 0 18px;padding:0;font-size:12.5px;line-height:1.6">${APP_NEWS.map((x) => `<li${typeof x === 'object' ? ' data-notr' : ''}>${esc(typeof x === 'string' ? x : (LANG === 'en' && x.en) || x.es)}</li>`).join('')}</ul>` : ''}</div>`;
  if (ME.owner)
    h += `<div class="card" style="margin-top:14px"><h3>Copia de seguridad 🔒</h3><p class="hint">OneDrive guarda versiones anteriores de cada archivo (clic derecho → Historial de versiones). Además, puedes descargar una copia completa de vez en cuando. Incluye las evaluaciones <b>sin cifrar</b>: guárdala en un sitio privado, no en la carpeta compartida.</p><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn pri" id="bkExp">Descargar copia (.json)</button><label class="btn" style="cursor:pointer">Restaurar desde copia…<input type="file" id="bkImp" accept=".json,application/json" style="display:none"></label></div></div>`;
  {
    const tbf = tbName(ME.memberId),
      fk = Object.keys(FILES).find((n) => n.toLowerCase() === tbf.toLowerCase()),
      has = !!fk,
      F = fk ? FILES[fk] : null,
      mine = arr('meetings')
        .filter((x) => x.source === 'thunderbird' && x.createdBy === ME.memberId)
        .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || ''))),
      nev = mine.length;
    const owners = {};
    for (const id of Object.keys(S.members)) owners[tbName(id).toLowerCase()] = id;
    const tbFiles = Object.keys(FILES).filter((n) => /^thunderbird-.*\.ics$/i.test(n));
    const unknown = tbFiles.filter((n) => !owners[n.toLowerCase()]);
    const up = mine.filter((x) => x.date >= todayS()).slice(0, 5),
      noProj = mine.filter((x) => !x.projectId).length;
    const fmtTs = (t) => {
      const d = new Date(t);
      return (
        d.toLocaleDateString(LOC()) +
        ' ' +
        d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })
      );
    };
    const status = has
      ? `<div class="note ${F.events.length ? 'info' : 'warn'}" style="margin:8px 0">
    <b>Archivo leído:</b> <code>${esc(fk)}</code><br>
    <b>Última modificación del archivo:</b> ${fmtTs(F.lastModified)} · <b>leído por la herramienta:</b> ${lastSync ? fmtTs(lastSync) : '—'}<br>
    <b>Contenido:</b> ${F.events.length} evento(s) en el archivo → <b>${nev}</b> reunión(es) registradas entre ${fmt(iso(todayN() - 400))} y ${fmt(iso(todayN() + 400))}${noProj ? ` · <b>${noProj}</b> sin proyecto asignado` : ''}
    ${F.events.length ? '' : '<br>El archivo existe pero está vacío: Thunderbird aún no ha guardado ninguna convocatoria en este calendario.'}
    ${up.length ? `<div style="margin-top:6px"><b>Próximas:</b><ul style="margin:4px 0 0 16px;padding:0">${up.map((x) => `<li><a href="#" data-meetlink="${x.id}">${fmt(x.date)} ${esc(x.time || '')} · ${esc(x.title)}</a>${x.projectId ? ` <span class="mut">(${esc(S.projects[x.projectId]?.code || S.projects[x.projectId]?.name || '')})</span>` : ' <span class="tag warn">sin proyecto</span>'}</li>`).join('')}</ul></div>` : ''}</div>`
      : `<div class="note warn" style="margin:8px 0">No encuentro <code>${esc(tbf)}</code> en la carpeta de datos.${unknown.length ? ` Sí hay ${unknown.map((n) => `<code>${esc(n)}</code>`).join(', ')}, pero con ese nombre no sé de quién es: cámbialo a <code>${esc(tbf)}</code> (con Thunderbird cerrado).` : ''}</div>`;
    h += `<div class="card" style="margin-top:14px"><h3>Thunderbird: convocatorias que llegan por correo</h3><div class="hint">
  <p>Thunderbird guarda las convocatorias que aceptas en un archivo de la carpeta <code>datos</code> y la herramienta las registra solas como reuniones, también las periódicas. ${has ? (nev ? `<span class="tag ok">Conectado: ${nev} reunión(es) desde Thunderbird</span>` : '<span class="tag warn">Archivo encontrado, sin reuniones</span>') : '<span class="tag warn">Aún no configurado</span>'} <button class="btn sm" id="tbReload">↻ Volver a leer ahora</button></p>${status}
  <ol style="padding-left:18px;margin:6px 0">
   <li>${has ? `Archivo creado: <b>${esc(tbf)}</b>.` : 'Pulsa <b>Crear mi archivo para Thunderbird</b> (abajo).'}</li>
   <li>En Thunderbird, pulsa <b>Alt</b> → <b>Archivo → Abrir → Archivo de calendario…</b> y elige <b>${esc(tbf)}</b> en la carpeta <code>datos</code>. <b>No</b> lo pongas en «Solo lectura».</li>
   <li>Clic derecho sobre ese calendario → <b>Propiedades</b> → en «Correo electrónico» elige la cuenta en la que te llegan las convocatorias. Así, al pulsar <b>Aceptar</b> en un correo de convocatoria, Thunderbird la guarda en este calendario.</li>
   <li>Para que la herramienta reconozca a los demás asistentes, pon el correo de cada miembro en su ficha del equipo.</li></ol>
  ${ME.owner && tbFiles.length ? `<p><b>Archivos de Thunderbird en la carpeta:</b> ${tbFiles.map((n) => `<code>${esc(n)}</code> → ${owners[n.toLowerCase()] ? esc(mem(owners[n.toLowerCase()])?.name) : '<span class="tag bad">sin dueño reconocido</span>'} (${FILES[n].events?.length || 0} eventos)`).join(' · ')}</p>` : ''}
  <p>La herramienta solo lee ese archivo, nunca lo modifica. Si cambias la fecha en Thunderbird, cambia aquí; si la borras o la cancelas allí, desaparece aquí.</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">${has ? '' : '<button class="btn pri" id="tbCreate">Crear mi archivo para Thunderbird</button>'}</div></div>`;
  }
  h += `<div class="card" style="margin-top:14px"><h3>Ver el plan en tu calendario (solo lectura)</h3><div class="hint">
  <p>La herramienta mantiene <b>${esc(icsName(ME.memberId))}</b> (tus reuniones, ausencias, entregas y festivos)${ME.owner ? ` y <b>${esc(icsName(null))}</b> (todo el equipo)` : ''} en la carpeta <code>datos</code>. En Thunderbird se añade igual (Alt → Archivo → Abrir → Archivo de calendario…), esta vez poniéndolo en «Solo lectura» desde Propiedades. <b>No confundas los dos archivos</b> y no guardes nunca una descarga encima de <code>${esc(tbName(ME.memberId))}</code>. Las reuniones que ya vienen de tu Thunderbird no se repiten en tu calendario personal.</p>
  <p><b>Outlook:</b> descarga el archivo y ábrelo con doble clic (copia puntual).</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="icsMe">Descargar mi calendario (.ics)</button>${ME.owner ? '<button class="btn" id="icsTeam">Descargar calendario del equipo (.ics)</button>' : ''}</div></div>`;
  h += `<div class="card" style="margin-top:14px"><h3>Quién puede hacer qué</h3><div class="hint">
  <p><b>Project manager</b> (entra con su contraseña): crea proyectos y miembros, asigna y reasigna tareas, edita cualquier tarea y ausencia, gestiona los festivos y es el único que ve las evaluaciones, que se guardan cifradas.</p>
  <p><b>Miembro del equipo</b> (elige su nombre al entrar): ve todo el plan, crea y edita solo sus tareas y ausencias y registra reuniones. Sus cambios se guardan en su propio archivo de la carpeta <code>datos</code>.</p>
  <p><b>Para incorporar a alguien:</b> añádelo aquí, comparte con esa persona la carpeta de OneDrive con permiso de edición y pídele que abra el archivo HTML con Edge o Chrome.</p>
  <p><b>Importante:</b> sin servidor, estas reglas las aplica la propia herramienta. Quien tenga acceso de edición a la carpeta podría modificar los archivos a mano. Las evaluaciones sí están protegidas por el cifrado.</p></div></div>`;
  return h;
}
