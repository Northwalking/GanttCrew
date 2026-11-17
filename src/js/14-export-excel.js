/* ---------- exportar el Gantt a Excel (.xlsx) ---------- */
// A real workbook built in the browser (no libraries): sheet "Gantt" with one row per task, its owner
// and a timeline of coloured cells; sheet "Tareas" with the same tasks as a plain, filterable table.
// Private projects are never exported.
const XL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const xlCol = (n) => {
  let s = '';
  for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const xlDate = (isoDay) => (dn(isoDay) == null ? null : dn(isoDay) + 25569); // Excel serial number
// mix a "#rrggbb" colour with white: k = 0 keeps it, k = 1 gives white
function xlTint(hex, k) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex || '') ? hex.replace('#', '') : '98A2B3';
  return [0, 2, 4]
    .map((i) =>
      Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k) + 255 * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
}
// Collects cell styles and writes styles.xml. style({b, sz, color, fill, fmt, al, wrap, bd}) -> index
function xlStyles() {
  const fonts = ['<font><sz val="10"/><name val="Calibri"/></font>'],
    fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
    ],
    borders = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FFE4E7EC"/></left><right style="thin"><color rgb="FFE4E7EC"/></right><top style="thin"><color rgb="FFE4E7EC"/></top><bottom style="thin"><color rgb="FFE4E7EC"/></bottom><diagonal/></border>',
    ],
    xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'],
    cache = { fonts: {}, fills: {}, xfs: {} };
  const idx = (kind, list, xml) => (cache[kind][xml] ??= list.push(xml) - 1);
  const style = (o = {}) => {
    const font = idx(
      'fonts',
      fonts,
      `<font>${o.b ? '<b/>' : ''}<sz val="${o.sz || 10}"/>${o.color ? `<color rgb="FF${o.color}"/>` : ''}<name val="Calibri"/></font>`,
    );
    const fill = o.fill
      ? idx(
          'fills',
          fills,
          `<fill><patternFill patternType="solid"><fgColor rgb="FF${o.fill}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      : 0;
    const fmt = o.fmt === 'date' ? 164 : o.fmt === 'pct' ? 9 : o.fmt === 'num' ? 165 : 0;
    const al =
      o.al || o.wrap
        ? `<alignment${o.al ? ` horizontal="${o.al}"` : ''} vertical="center"${o.wrap ? ' wrapText="1"' : ''}/>`
        : '<alignment vertical="center"/>';
    return idx(
      'xfs',
      xfs,
      `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${o.bd ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${fmt ? ' applyNumberFormat="1"' : ''}>${al}</xf>`,
    );
  };
  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.#"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { style, xml };
}
// One worksheet: rows are arrays of cells; a cell is null, a value, or {v, s} (s = style index)
function xlSheet(rows, o = {}) {
  let body = '';
  rows.forEach((row, r) => {
    let cells = '';
    row.forEach((c, i) => {
      if (c == null) return;
      const v = typeof c === 'object' ? c.v : c,
        s = typeof c === 'object' && c.s ? ` s="${c.s}"` : '',
        ref = xlCol(i) + (r + 1);
      if (v == null || v === '') cells += `<c r="${ref}"${s}/>`;
      else if (typeof v === 'number') cells += `<c r="${ref}"${s}><v>${v}</v></c>`;
      else cells += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    });
    body += `<row r="${r + 1}"${o.heights?.[r] ? ` ht="${o.heights[r]}" customHeight="1"` : ''}>${cells}</row>`;
  });
  const pane = o.freeze
    ? `<pane${o.freeze[0] ? ` xSplit="${o.freeze[0]}"` : ''}${o.freeze[1] ? ` ySplit="${o.freeze[1]}"` : ''} topLeftCell="${xlCol(o.freeze[0])}${o.freeze[1] + 1}" activePane="${o.freeze[0] && o.freeze[1] ? 'bottomRight' : o.freeze[0] ? 'topRight' : 'bottomLeft'}" state="frozen"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="${o.grid ? 1 : 0}" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/>${
    o.cols
      ? `<cols>${o.cols.map(([a, b, w]) => `<col min="${a + 1}" max="${b + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : ''
  }<sheetData>${body}</sheetData>${o.filter ? `<autoFilter ref="${o.filter}"/>` : ''}${
    o.merges?.length
      ? `<mergeCells count="${o.merges.length}">${o.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : ''
  }<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function xlBook(sheets, stylesXml) {
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    files = {
      '[Content_Types].xml': `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
      '_rels/.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name).replace(/"/g, '')}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': stylesXml,
    };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = s.xml));
  return zipStore(files, XL_MIME);
}

// Status of a task in words, as in the tool
function xlStatus(t) {
  const st = inact(t);
  if (st === 'cancelled') return T('Cancelada');
  if (st) return T('En pausa');
  if (t.handover) return `${T('Traspasada')} → ${S.members[t.handover.member]?.name || ''}`;
  return T(STAT[t.status] || 'Pendiente');
}
/* o = { pid: '' | projectId, from, to (ISO), unit: 'week' | 'day', done: boolean } */
function ganttWorkbook(o) {
  const st = xlStyles(),
    S_ = st.style;
  const name = (id) => S.members[id]?.name || '',
    T0 = todayN();
  const projs = projects().filter((p) => !p.priv && (!o.pid || p.id === o.pid));
  const tasksOf = (p) =>
    arr('tasks')
      .filter((t) => t.projectId === p.id && !t.priv && (o.done || t.status !== 'done'))
      .sort(
        (a, b) =>
          String(a.start).localeCompare(String(b.start)) || String(a.end).localeCompare(String(b.end)),
      );
  // timeline columns
  const F = dn(o.from),
    L = dn(o.to),
    cols = [];
  if (o.unit === 'day') for (let d = F; d <= L; d++) cols.push([d, d]);
  else for (let d = monday(F); d <= L; d += 7) cols.push([d, d + 6]);
  const FIX = 6, // fixed columns before the timeline
    hd = { b: 1, color: 'FFFFFF', fill: '1C2230', al: 'center', bd: 1 },
    sH = S_(hd),
    sHl = S_({ ...hd, al: 'left' }),
    sToday = S_({ ...hd, fill: 'F79009' }),
    sMonth = S_({ b: 1, fill: 'EAECF0', al: 'center', bd: 1 }),
    sWe = S_({ fill: 'F2F4F7', bd: 1 }),
    sEmpty = S_({ bd: 1 }),
    sLate = S_({ fill: 'FECDCA', bd: 1 }),
    sOff = S_({ fill: 'D0D5DD', bd: 1 });
  const rows = [],
    merges = [];
  // row 1: title
  rows.push([
    {
      v: `${T('Diagrama Gantt')}${o.pid ? ' · ' + (S.projects[o.pid]?.name || '') : ''} — ${T('fecha del informe')}: ${dfmt(todayS())}`,
      s: S_({ b: 1, sz: 14 }),
    },
  ]);
  // rows 2-3: months and weeks/days
  const r2 = [
      T('Proyecto / tarea'),
      T('Responsable'),
      T('Inicio'),
      T('Fin planificado'),
      T('Avance'),
      T('Estado'),
    ].map((v, i) => ({
      v,
      s: i < 2 ? sHl : sH,
    })),
    r3 = Array.from({ length: FIX }, () => ({ v: '', s: sH }));
  let mStart = 0;
  cols.forEach(([a, b], i) => {
    const d = new Date(a * DAY),
      key = d.getUTCFullYear() * 12 + d.getUTCMonth(),
      prev = i ? new Date(cols[i - 1][0] * DAY) : null,
      pkey = prev ? prev.getUTCFullYear() * 12 + prev.getUTCMonth() : null;
    if (i && key !== pkey) {
      if (i - 1 > mStart) merges.push(`${xlCol(FIX + mStart)}2:${xlCol(FIX + i - 1)}2`);
      mStart = i;
    }
    const first = !i || key !== pkey;
    r2.push({
      v: first ? `${MES3S[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : '',
      s: sMonth,
    });
    r3.push({ v: d.getUTCDate(), s: T0 >= a && T0 <= b ? sToday : sH });
  });
  if (cols.length - 1 > mStart) merges.push(`${xlCol(FIX + mStart)}2:${xlCol(FIX + cols.length - 1)}2`);
  // a month with a single column only has room for its short name
  for (let i = 0; i < cols.length; i++) {
    const c = r2[FIX + i];
    if (c.v && (i === cols.length - 1 || r2[FIX + i + 1].v)) c.v = c.v.split(' ')[0];
  }
  rows.push(r2, r3);
  merges.push(`A1:${xlCol(FIX + Math.min(cols.length, 12) - 1)}1`);
  const used = new Set(),
    flat = [];
  for (const p of projs) {
    const ts = tasksOf(p);
    if (!ts.length && o.pid !== p.id && !o.done) continue;
    const pc = p.color || '#667085',
      sP = S_({ b: 1, fill: xlTint(pc, 0.82), bd: 1 }),
      sPd = S_({ b: 1, fill: xlTint(pc, 0.82), fmt: 'date', al: 'center', bd: 1 }),
      sPp = S_({ b: 1, fill: xlTint(pc, 0.82), fmt: 'pct', al: 'center', bd: 1 }),
      sPb = S_({ fill: xlTint(pc, 0.55), bd: 1 }),
      people = projPeople(p).map(name).filter(Boolean);
    const open = ts.filter((t) => inact(t) !== 'cancelled'),
      avg = open.length
        ? open.reduce((a, t) => a + (t.status === 'done' ? 100 : +t.progress || 0), 0) / open.length / 100
        : null;
    const row = [
      { v: `${p.code ? p.code + ' · ' : ''}${p.name}`, s: sP },
      { v: people.join(', '), s: sP },
      { v: xlDate(p.start), s: sPd },
      { v: xlDate(p.end), s: sPd },
      { v: avg, s: sPp },
      { v: T(PSTATUS[p.status || 'active']?.t || 'Activo'), s: sP },
    ];
    const ps = dn(p.start),
      pe = dn(p.end);
    for (const [a, b] of cols)
      row.push({ v: '', s: ps != null && pe != null && ps <= b && pe >= a ? sPb : sP });
    rows.push(row);
    for (const t of ts) {
      const m = S.members[t.assigneeId],
        mc = m?.color || '#98A2B3',
        off = inact(t),
        sDone = S_({ fill: xlTint(mc, 0), bd: 1 }),
        sTodo = S_({ fill: xlTint(mc, 0.6), bd: 1 }),
        s = dn(t.start),
        e = dn(t.end),
        fc = t.status === 'done' || off ? null : fcOf(t).end,
        prog = t.status === 'done' ? 1 : (+t.progress || 0) / 100;
      if (m) used.add(t.assigneeId);
      const span = cols.filter(([a, b]) => s <= b && e >= a).length,
        doneCols = Math.round(span * prog);
      let k = 0;
      const row = [
        { v: '    ' + t.name, s: sEmpty },
        { v: teamNames(t) || T('sin asignar'), s: sEmpty },
        { v: xlDate(t.start), s: S_({ fmt: 'date', al: 'center', bd: 1 }) },
        { v: xlDate(t.end), s: S_({ fmt: 'date', al: 'center', bd: 1 }) },
        { v: prog, s: S_({ fmt: 'pct', al: 'center', bd: 1 }) },
        { v: xlStatus(t), s: sEmpty },
      ];
      for (const [a, b] of cols) {
        let sx = o.unit === 'day' && !isWork(a) ? sWe : sEmpty;
        if (s != null && e != null && s <= b && e >= a) sx = off ? sOff : k++ < doneCols ? sDone : sTodo;
        else if (fc != null && e != null && a > e && a <= fc) sx = sLate; // forecast beyond the planned end
        row.push({ v: '', s: sx });
      }
      rows.push(row);
      flat.push({ p, t, fc });
    }
  }
  // legend
  rows.push([]);
  const lg = rows.length;
  rows.push([{ v: T('Leyenda'), s: S_({ b: 1 }) }]);
  for (const id of used) {
    const c = S.members[id].color || '#98A2B3';
    rows.push([
      name(id),
      { v: T('Avance'), s: S_({ fill: xlTint(c, 0), color: 'FFFFFF', al: 'center', bd: 1 }) },
      { v: T('Pendiente'), s: S_({ fill: xlTint(c, 0.6), al: 'center', bd: 1 }) },
    ]);
  }
  for (const [c, t] of [
    ['FECDCA', T('Hasta la fin prevista (retraso)')],
    ['D0D5DD', T('En pausa') + ' / ' + T('Cancelada')],
    ['F79009', T('Hoy')],
  ])
    rows.push([t, { v: '', s: S_({ fill: c, bd: 1 }) }]);
  const gantt = xlSheet(rows, {
    freeze: [FIX, 3],
    cols: [
      [0, 0, 46],
      [1, 1, 24],
      [2, 3, 14],
      [4, 4, 9],
      [5, 5, 16],
      [FIX, FIX + cols.length, o.unit === 'day' ? 3.2 : 3.6],
    ],
    merges,
    heights: { 0: 24 },
  });
  // sheet 2: the same tasks as a table
  const sD = S_({ fmt: 'date', al: 'center' }),
    sN = S_({ fmt: 'num', al: 'center' }),
    sPc = S_({ fmt: 'pct', al: 'center' }),
    head = [
      'Proyecto',
      'Código corto',
      'Tarea',
      'Responsable',
      'Colaboradores',
      'Origen',
      'Prioridad',
      'Inicio planificado',
      'Fin planificado',
      'Inicio real',
      'Fin real',
      'Fin previsto',
      'Avance',
      'Estado',
      'Horas estimadas (total)',
      'Horas pendientes',
      'Depende de',
    ];
  const PR = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const trows = [head.map((h) => ({ v: T(h), s: sHl }))];
  for (const { p, t, fc } of flat)
    trows.push([
      p.name,
      p.code || '',
      t.name,
      name(t.assigneeId),
      collabOf(t)
        .map((c) => `${name(c.id)} (${c.ded} %)`)
        .join(', '),
      T(ORIG[t.origin || 'plan']?.t || ''),
      T(PR[t.priority || 'media']),
      { v: xlDate(t.start), s: sD },
      { v: xlDate(t.end), s: sD },
      { v: t.realStart ? xlDate(t.realStart) : null, s: sD },
      { v: t.realEnd ? xlDate(t.realEnd) : null, s: sD },
      { v: fc != null ? fc + 25569 : null, s: sD },
      { v: t.status === 'done' ? 1 : (+t.progress || 0) / 100, s: sPc },
      xlStatus(t),
      { v: Math.round(estHours(t) * 10) / 10, s: sN },
      { v: t.status === 'done' ? 0 : Math.round(remHours(t) * 10) / 10, s: sN },
      (t.deps || [])
        .map((id) => S.tasks[id]?.name)
        .filter(Boolean)
        .join('; '),
    ]);
  const table = xlSheet(trows, {
    grid: true,
    freeze: [0, 1],
    filter: `A1:${xlCol(head.length - 1)}${trows.length}`,
    cols: [
      [0, 0, 26],
      [1, 1, 12],
      [2, 2, 44],
      [3, 3, 18],
      [4, 4, 26],
      [5, 6, 16],
      [7, 11, 13],
      [12, 12, 9],
      [13, 13, 18],
      [14, 15, 12],
      [16, 16, 40],
    ],
  });
  return {
    blob: xlBook(
      [
        { name: 'Gantt', xml: gantt },
        { name: T('Tareas'), xml: table },
      ],
      st.xml(),
    ),
    tasks: flat.length,
    columns: cols.length,
    legendRow: lg,
  };
}
function openExportExcel() {
  const ps = projects().filter((p) => !p.priv);
  if (!ps.length) return toast('No hay proyectos.');
  const range = (pid) => {
    const ts = arr('tasks').filter((t) => !t.priv && (!pid || t.projectId === pid));
    const ds = [
      ...ts.flatMap((t) => [t.start, t.end]),
      ...ps.filter((p) => !pid || p.id === pid).flatMap((p) => [p.start, p.end]),
    ]
      .filter(Boolean)
      .sort();
    return ds.length ? [ds[0], ds[ds.length - 1]] : [todayS(), iso(todayN() + 90)];
  };
  const pid0 = UI.proj.size === 1 ? [...UI.proj][0] : '',
    [f0, t0] = range(S.projects[pid0] && !S.projects[pid0].priv ? pid0 : '');
  openDlg(
    'Exportar el Gantt a Excel',
    `<div class="full hint">Genera una hoja de Excel con el diagrama Gantt (una fila por tarea, con su responsable y una celda coloreada por semana o por día) y una segunda hoja con las mismas tareas en forma de tabla. Sirve para compartir el plan con quien no usa la herramienta.</div>
     <label class="full">Proyecto<select id="eP"><option value="">Todos los proyectos</option>${ps.map((p) => `<option value="${p.id}" ${p.id === pid0 ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
     <label>Desde<input type="date" id="eF" value="${f0}"></label><label>Hasta<input type="date" id="eT" value="${t0}"></label>
     <label>Escala<select id="eU"><option value="week">Semanas</option><option value="day">Días</option></select></label>
     <label style="flex-direction:row;align-items:center;gap:8px;font-weight:400;align-self:end;padding-bottom:8px"><input type="checkbox" id="eD" style="width:auto" checked> Incluir las tareas completadas</label>
     <div class="full hint" id="eI"></div>
     <div class="full note info">No se exportan los proyectos privados, las evaluaciones ni los diarios.</div>`,
    async () => {
      const o = { pid: val('eP'), from: val('eF'), to: val('eT'), unit: val('eU'), done: $('#eD').checked };
      if (!o.from || !o.to || o.to < o.from) {
        toast('Revisa las fechas.');
        return false;
      }
      const n =
        o.unit === 'day' ? dn(o.to) - dn(o.from) + 1 : Math.ceil((dn(o.to) - monday(dn(o.from)) + 1) / 7);
      if (n > 800) {
        toast('El periodo es demasiado largo para esa escala: acórtalo o usa semanas.');
        return false;
      }
      const w = ganttWorkbook(o);
      if (!w.tasks) {
        toast('No hay tareas en esa selección.');
        return false;
      }
      dDownload(
        w.blob,
        `Gantt ${o.pid ? (S.projects[o.pid].code || S.projects[o.pid].name) + ' ' : ''}${todayS()}.xlsx`,
      );
      toast(`Excel descargado: ${w.tasks} tareas.`);
    },
  );
  $('#mSave').textContent = 'Descargar Excel';
  const info = () => {
    const f = dn(val('eF')),
      t = dn(val('eT'));
    if (f == null || t == null || t < f) return ($('#eI').textContent = '');
    const n = val('eU') === 'day' ? t - f + 1 : Math.ceil((t - monday(f) + 1) / 7);
    $('#eI').textContent = `${n} columnas en el diagrama.`;
  };
  $('#eP').onchange = () => {
    const [a, b] = range(val('eP'));
    $('#eF').value = a;
    $('#eT').value = b;
    info();
  };
  ['eF', 'eT', 'eU'].forEach((i) => ($('#' + i).onchange = info));
  info();
}
