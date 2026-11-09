/* ---------- importar festivos oficiales (BOCM) ---------- */
// Lee el texto del decreto de fiestas de la Comunidad de Madrid o de la resolución de fiestas locales
// (desde el PDF o pegado a mano) y propone los festivos; el PM revisa antes de guardar.
const MESES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const NAT_MD = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
const LOCAL_NAMES = { madrid: { '05-15': 'San Isidro Labrador', '11-09': 'Nuestra Señora de la Almudena' } };
function bocmYear(t) {
  const m = /(?:para el|del?)\s+a[ñn]o\s+(20\d\d)/i.exec(t);
  if (m) return +m[1];
  const c = {};
  for (const x of t.match(/\b20\d\d\b/g) || []) c[x] = (c[x] || 0) + 1;
  const y = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return y ? +y[0] : new Date().getFullYear() + 1;
}
function bocmSource(t) {
  const m =
    /(DECRETO\s+\d+\/\d{4},\s+de\s+\d{1,2}\s+de\s+\w+|RESOLUCI[ÓO]N\s+de\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i.exec(
      t,
    );
  return m ? m[1].replace(/\s+/g, ' ').trim().replace(/,$/, '') : 'BOCM';
}
const pad2 = (n) => String(n).padStart(2, '0');
function parseRegional(t, year) {
  const out = [];
  const body = t.replace(/\r/g, '');
  const i = body.search(/ANEXO|FIESTAS LABORALES DE LA COMUNIDAD/i);
  const zone = i >= 0 ? body.slice(i) : body;
  const re =
    /[—–\-•]\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:\(([^)]{3,12})\))?\s*,\s*([^\n.;—–]{3,80})/gi;
  let m;
  while ((m = re.exec(zone))) {
    const md = pad2(MESES[m[2].toLowerCase()]) + '-' + pad2(+m[1]);
    const name = m[4]
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
    const date = year + '-' + md;
    if (out.some((x) => x.date === date)) continue;
    const trasl = /traslado/i.test(name),
      nat = (!trasl && NAT_MD.includes(md)) || /viernes santo/i.test(name);
    out.push({
      date,
      name,
      scope: nat ? 'nacional' : 'comunidad',
      fixed: !trasl && (NAT_MD.includes(md) || md === '05-02') && !/(jueves|viernes) santo/i.test(name),
    });
  }
  return out;
}
function parseLocal(t, year, munis) {
  const out = [],
    found = new Set();
  const body = t.replace(/\r/g, '').replace(/\n(?![—–\-•])/g, ' ');
  const re = /[—–\-•]\s*([A-ZÁÉÍÓÚÑÜ][^:—–\n]{1,70}?)\s*:\s*([^—–\n]{3,120}?)\.(?=\s|$)/g;
  let m;
  const want = {};
  for (const x of munis) want[norm(x)] = x;
  while ((m = re.exec(body))) {
    const muni = m[1].replace(/\s+/g, ' ').trim();
    const key = norm(muni);
    if (!want[key]) continue;
    found.add(want[key]);
    const toks = m[2]
      .split(/\s*,\s*|\s+y\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);
    let month = null;
    const ds = [];
    for (let k = toks.length - 1; k >= 0; k--) {
      const mm = /(\d{1,2})(?:\s+de\s+(\w+))?/i.exec(toks[k]);
      if (!mm) continue;
      if (mm[2] && MESES[mm[2].toLowerCase()]) month = MESES[mm[2].toLowerCase()];
      if (month) ds.unshift(pad2(month) + '-' + pad2(+mm[1]));
    }
    for (const md of ds) {
      const nm = (LOCAL_NAMES[key] || {})[md] || 'Fiesta local de ' + want[key];
      out.push({
        date: year + '-' + md,
        name: nm,
        scope: 'local',
        municipality: want[key],
        fixed: !!(LOCAL_NAMES[key] || {})[md],
      });
    }
  }
  return { list: out, found: [...found], missing: munis.filter((x) => !found.has(x)) };
}
async function pdfToText(file) {
  if (!window.pdfjsLib) {
    await new Promise((ok, ko) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sc.onload = ok;
      sc.onerror = () => ko(new Error('sin conexión'));
      document.head.appendChild(sc);
    });
    try {
      const w = await (
        await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js')
      ).text();
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
        new Blob([w], { type: 'text/javascript' }),
      );
    } catch (e) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let txt = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    for (const it of c.items) {
      txt += it.str + (it.hasEOL ? '\n' : ' ');
    }
    txt += '\n';
  }
  return txt;
}
function openImportHolidays() {
  if (!ME.owner) return;
  const body = `<div class="full hint">Descarga del <a href="https://www.bocm.es" target="_blank" rel="noopener">BOCM</a> el <b>decreto de fiestas laborales de la Comunidad de Madrid</b> (se publica hacia finales de septiembre) o la <b>resolución de fiestas laborales de ámbito local</b> (diciembre). Ábrelo aquí o pega su texto. Verás lo encontrado antes de guardar.</div>
   <label>PDF del BOCM<input type="file" id="hpF" accept=".pdf,application/pdf"></label>
   <label>Enlace a la publicación (opcional)<input type="text" id="hpU" placeholder="https://www.bocm.es/…"></label>
   <label class="full">… o pega aquí el texto del PDF (Ctrl+A, Ctrl+C en el PDF)<textarea id="hpT" style="min-height:90px" placeholder="— 1 de enero (viernes), Año Nuevo.&#10;— 6 de enero (miércoles), Epifanía del Señor.&#10;…"></textarea></label>
   <div class="full" style="display:flex;gap:8px;align-items:center"><button type="button" class="btn pri" id="hpGo">Analizar</button><span class="hint" id="hpMsg"></span></div>
   <div class="full" id="hpRes"></div>`;
  openDlg('Importar festivos oficiales', body, null, null, true);
  $('#hpF').onchange = async () => {
    const f = $('#hpF').files[0];
    if (!f) return;
    $('#hpMsg').textContent = 'Leyendo el PDF…';
    try {
      $('#hpT').value = await pdfToText(f);
      $('#hpMsg').textContent = 'PDF leído.';
      analyze();
    } catch (e) {
      $('#hpMsg').innerHTML =
        '<b style="color:var(--bad)">No se pudo leer el PDF (' +
        esc(e.message || e) +
        ').</b> Ábrelo, selecciona todo el texto (Ctrl+A), cópialo (Ctrl+C) y pégalo en el cuadro.';
    }
  };
  $('#hpGo').onclick = analyze;
  function analyze() {
    const t = $('#hpT').value;
    if (!t.trim()) {
      toast('Abre el PDF o pega su texto.');
      return;
    }
    const year = bocmYear(t),
      src = bocmSource(t);
    const munis = [...new Set(centers().map((c) => c.municipality))];
    const isLocal =
      /[aá]mbito local|fiestas locales/i.test(t) &&
      !/FIESTAS LABORALES DE LA COMUNIDAD DE MADRID PARA/i.test(t);
    let found = [],
      info = '',
      stale = [];
    if (isLocal) {
      const r = parseLocal(t, year, munis);
      found = r.list;
      info = `Resolución de fiestas <b>locales</b> de ${year}. Municipios de tus centros encontrados: ${r.found.map(esc).join(', ') || 'ninguno'}${r.missing.length ? ` · <span style="color:var(--bad)">no aparecen: ${r.missing.map(esc).join(', ')}</span>` : ''}.`;
      stale = arr('holidays').filter(
        (h) =>
          h.date.startsWith(String(year)) &&
          h.scope === 'local' &&
          r.found.some((mu) => norm(mu) === norm(holMuni(h))) &&
          !found.some((f) => f.date === h.date && norm(f.municipality) === norm(holMuni(h))),
      );
    } else {
      found = parseRegional(t, year);
      info = `Decreto de fiestas de la <b>Comunidad de Madrid</b> para ${year}: ${found.length} fecha(s) (${found.filter((x) => x.scope === 'nacional').length} nacionales, ${found.filter((x) => x.scope === 'comunidad').length} autonómicas)${found.length && found.length !== 12 ? ' · <span style="color:var(--bad)">normalmente son 12: revisa el texto</span>' : ''}.`;
      stale = arr('holidays').filter(
        (h) =>
          h.date.startsWith(String(year)) &&
          (h.scope === 'nacional' || h.scope === 'comunidad') &&
          !found.some((f) => f.date === h.date),
      );
    }
    if (!found.length) {
      $('#hpRes').innerHTML =
        `<div class="note warn">No he encontrado fechas de festivos en el texto. Comprueba que es el decreto o la resolución de fiestas laborales y que el texto incluye las líneas del tipo «— 1 de enero (viernes), Año Nuevo.»</div>`;
      return;
    }
    const ex = (h) =>
      arr('holidays').find(
        (x) =>
          x.date === h.date &&
          (h.scope === 'local'
            ? x.scope === 'local' && norm(holMuni(x)) === norm(h.municipality)
            : x.scope !== 'local' && x.scope !== 'empresa'),
      );
    const DW = LAx(
      ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    );
    const rows = found
      .map((h, i) => {
        const e = ex(h);
        const st = !e
          ? '<span class="tag ok">nuevo</span>'
          : e.name !== h.name || e.scope !== h.scope
            ? '<span class="tag warn">se actualiza</span>'
            : '<span class="tag mut">ya está</span>';
        return `<tr><td><input type="checkbox" data-h="${i}" ${e && e.name === h.name && e.scope === h.scope ? '' : 'checked'} style="width:auto"></td><td style="white-space:nowrap">${fmt(h.date)} <span class="mut">${DW[dow(dn(h.date))]}</span></td><td>${esc(h.name)}</td><td><select data-sc="${i}">${opt(
          Object.entries(HSCOPE).filter(([k]) => k !== 'empresa'),
          h.scope,
        )}</select>${h.municipality ? ` <span class="mut">${esc(h.municipality)}</span>` : ''}</td><td>${st}</td></tr>`;
      })
      .join('');
    $('#hpRes').innerHTML = `<div class="note info">${info} Fuente detectada: <b>${esc(src)}</b>.</div>
      <div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:8px"><table><thead><tr><th></th><th>Fecha</th><th>Festivo</th><th>Ámbito</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${stale.length ? `<div class="note warn" style="margin-top:8px">Estos festivos de ${year} que ya tenías <b>no aparecen</b> en el documento: ${stale.map((h) => `<label style="display:inline-flex;flex-direction:row;gap:4px;align-items:center;font-weight:400;margin-right:10px"><input type="checkbox" data-del="${h.id}" style="width:auto"> ${fmt(h.date)} ${esc(h.name)}</label>`).join('')}<br>Marca los que quieras borrar.</div>` : ''}
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn pri" id="hpSave">Guardar festivos</button></div>`;
    $('#hpSave').onclick = async () => {
      const url = val('hpU');
      const items = [];
      $('#hpRes')
        .querySelectorAll('input[data-h]:checked')
        .forEach((c) => {
          const i = +c.dataset.h,
            h = { ...found[i], scope: $('#hpRes').querySelector(`[data-sc="${i}"]`).value };
          const e = ex(found[i]);
          const id = e
            ? e.id
            : h.scope === 'local'
              ? `loc-${slug(h.municipality)}-${h.date}`
              : (h.scope === 'nacional' ? 'nac-' : 'cm-') + h.date;
          items.push([
            id,
            {
              ...(e || {}),
              date: h.date,
              name: h.name,
              scope: h.scope,
              municipality: h.scope === 'local' ? h.municipality : '',
              region: h.scope === 'comunidad' ? 'Comunidad de Madrid' : '',
              fixed: h.fixed,
              memberIds: e?.memberIds || [],
              source: url || e?.source || '',
              sourceName: src + ' (importado ' + fmt(todayS()) + ')',
            },
          ]);
        });
      const dels = [...$('#hpRes').querySelectorAll('input[data-del]:checked')].map((c) => c.dataset.del);
      if (!items.length && !dels.length) {
        toast('No hay nada marcado.');
        return;
      }
      if (items.length) await saveMany('holidays', items);
      for (const d of dels) await del('holidays', d);
      closeDlg();
      UI.year = year;
      toast(
        `Guardados ${items.length} festivo(s) de ${year}${dels.length ? ` y borrados ${dels.length}` : ''}.`,
      );
      render();
    };
  }
}
// Aviso anual: qué festivos faltan para este año y, desde octubre, para el siguiente.
function holidayGaps() {
  const now = new Date(),
    Y = now.getFullYear(),
    years = [Y].concat(now.getMonth() >= 9 ? [Y + 1] : []),
    gaps = [];
  for (const y of years) {
    const ys = String(y),
      reg = arr('holidays').filter(
        (h) => h.date.startsWith(ys) && (h.scope === 'nacional' || h.scope === 'comunidad'),
      ).length;
    if (reg < 12)
      gaps.push({
        y,
        kind: 'reg',
        n: reg,
        text: `${y}: ${reg ? `solo ${reg} de 12` : 'ninguno de los 12'} festivos nacionales y autonómicos`,
        when: 'el decreto de la Comunidad de Madrid se publica en el BOCM hacia finales de septiembre del año anterior',
      });
    for (const c of centers()) {
      const nl = arr('holidays').filter(
        (h) => h.date.startsWith(ys) && h.scope === 'local' && norm(holMuni(h)) === norm(c.municipality),
      ).length;
      if (nl < 2 && (y === Y || now.getMonth() >= 11))
        gaps.push({
          y,
          kind: 'loc',
          n: nl,
          text: `${y}: ${nl} de 2 festivos locales de ${c.municipality}`,
          when: 'la resolución de fiestas locales sale en el BOCM en diciembre; Madrid capital las aprueba antes, en el Pleno de finales de septiembre',
        });
    }
  }
  return gaps;
}
function gapsNote() {
  const g = holidayGaps();
  if (!g.length) return '';
  return `<div class="note warn" style="margin-bottom:12px">📅 <b>Faltan festivos oficiales:</b><ul style="margin:4px 0 4px 18px;padding:0">${g.map((x) => `<li>${esc(x.text)} <span class="mut">(${esc(x.when)})</span></li>`).join('')}</ul>${ME.owner ? 'Pulsa <b>Importar festivos (BOCM)</b> en la pestaña Ausencias.' : 'Avisa al project manager.'}</div>`;
}

async function copyHolidays() {
  const y = UI.year,
    next = y + 1;
  const src = arr('holidays').filter((x) => x.fixed && (x.date || '').startsWith(String(y)));
  const have = new Set(
    arr('holidays')
      .filter((x) => (x.date || '').startsWith(String(next)))
      .map((x) => x.date.slice(5) + '|' + x.name),
  );
  let n = 0;
  for (const x of src) {
    const md = x.date.slice(5);
    if (have.has(md + '|' + x.name)) continue;
    const o = { ...x, date: next + '-' + md, source: '', sourceName: '', copiedFrom: x.date };
    delete o.id;
    if (await save('holidays', null, o)) n++;
  }
  toast(
    n
      ? `Copiados ${n} festivos a ${next}. Revisa Semana Santa, traslados y fiestas locales cuando se publique el calendario oficial.`
      : `No había festivos nuevos que copiar a ${next}.`,
  );
}
