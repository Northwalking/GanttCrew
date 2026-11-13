/* ---------- convocatorias desde Thunderbird ---------- */
// Cada persona puede tener en la carpeta de datos un archivo thunderbird-<nombre>.ics en el que
// Thunderbird guarda (lectura y escritura) las convocatorias que acepta. La herramienta solo lo lee:
// fecha, hora, duración y título mandan desde Thunderbird; proyecto, tipo, asistentes y notas se
// pueden completar aquí y se guardan como un ajuste de la reunión.
const tbName = (mid) => `thunderbird-${slug(S.members[mid]?.name)}.ics`;
function hashStr(t) {
  let h = 2166136261;
  for (const c of t) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function icsUnesc(t) {
  return String(t || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1');
}
const madridFmt = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch (e) {
    return null;
  }
})();
function icsTime(v, params) {
  // -> {date:'YYYY-MM-DD',time:'HH:MM'|'',n:día,min:minutos desde 00:00}
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || '');
  if (!m) return null;
  let [_, y, mo, d, hh, mi, ss, z] = m;
  if (!hh || params.VALUE === 'DATE') return { date: `${y}-${mo}-${d}`, time: '', allDay: true };
  if (z && madridFmt) {
    const p = {};
    for (const x of madridFmt.formatToParts(new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +(ss || 0)))))
      p[x.type] = x.value;
    y = p.year;
    mo = p.month;
    d = p.day;
    hh = p.hour;
    mi = p.minute;
  }
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mi}`, allDay: false };
}
function icsDur(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v || '');
  if (!m) return null;
  return (+m[2] || 0) * 7 * 1440 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0);
}
const minOf = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0);
function parseICS(text) {
  const raw = String(text || '')
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
  const evs = [];
  let cur = null,
    depth = 0;
  for (const line of raw) {
    if (line === 'BEGIN:VEVENT') {
      cur = { props: {}, attendees: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) evs.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    if (/^BEGIN:VALARM/.test(line)) {
      depth++;
      continue;
    }
    if (/^END:VALARM/.test(line)) {
      depth--;
      continue;
    }
    if (depth) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const head = line.slice(0, i),
      value = line.slice(i + 1);
    const [name, ...ps] = head.split(';');
    const params = {};
    for (const p of ps) {
      const j = p.indexOf('=');
      if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, '');
    }
    const N = name.toUpperCase();
    if (N === 'ATTENDEE' || N === 'ORGANIZER')
      cur.attendees.push({
        email: value.replace(/^mailto:/i, '').toLowerCase(),
        name: icsUnesc(params.CN || ''),
        org: N === 'ORGANIZER',
        part: params.PARTSTAT || '',
      });
    else if (N === 'EXDATE')
      (cur.props.EXDATE = cur.props.EXDATE || []).push(
        ...value.split(',').map((v) => icsTime(v, params)?.date),
      );
    else cur.props[N] = { value, params };
  }
  return evs;
}
function expandEvent(e, from, to) {
  // fechas (YYYY-MM-DD) de las ocurrencias entre from y to (números de día)
  const st = icsTime(e.props.DTSTART?.value, e.props.DTSTART?.params || {});
  if (!st) return [];
  const start = dn(st.date),
    rr = e.props.RRULE?.value;
  if (!rr) return start >= from && start <= to ? [st.date] : [];
  const R = {};
  for (const kv of rr.split(';')) {
    const [k, v] = kv.split('=');
    R[k.toUpperCase()] = v;
  }
  const freq = R.FREQ,
    iv = Math.max(1, +R.INTERVAL || 1),
    count = +R.COUNT || 0;
  const until = R.UNTIL ? dn(icsTime(R.UNTIL, {}).date) : Infinity;
  const ex = new Set(e.props.EXDATE || []);
  const out = [];
  let k = 0;
  const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const push = (d) => {
    if (d < start || d > until) return false;
    k++;
    if (count && k > count) return true;
    const s = iso(d);
    if (d >= from && d <= to && !ex.has(s)) out.push(s);
    return false;
  };
  const limit = Math.min(to, until);
  if (freq === 'DAILY') {
    for (let d = start; d <= limit; d += iv) if (push(d)) break;
  } else if (freq === 'WEEKLY') {
    const days = R.BYDAY
      ? R.BYDAY.split(',')
          .map((x) => WD[x.slice(-2)])
          .filter((x) => x != null)
      : [dow(start)];
    outer: for (let w = monday(start); w <= limit; w += 7 * iv)
      for (const wd of days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = w + ((wd + 6) % 7);
        if (d < start) continue;
        if (d > limit) break outer;
        if (push(d)) break outer;
      }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    const [y0, m0, d0] = st.date.split('-').map(Number);
    const step = freq === 'YEARLY' ? 12 * iv : iv;
    for (let i = 0; i < 600; i++) {
      const mm = m0 - 1 + i * step,
        yy = y0 + Math.floor(mm / 12),
        mon = mm % 12;
      let d;
      if (freq === 'MONTHLY' && R.BYDAY) {
        const mt = /^(-?\d)?([A-Z]{2})$/.exec(R.BYDAY.split(',')[0]);
        if (!mt) break;
        const n = +(mt[1] || 1),
          wd = WD[mt[2]];
        if (n > 0) {
          const f = dn(`${yy}-${String(mon + 1).padStart(2, '0')}-01`);
          d = f + ((wd - dow(f) + 7) % 7) + 7 * (n - 1);
        } else {
          const l =
            dn(`${yy + (mon === 11 ? 1 : 0)}-${String(mon === 11 ? 1 : mon + 2).padStart(2, '0')}-01`) - 1;
          d = l - ((dow(l) - wd + 7) % 7);
        }
      } else {
        const md = +(R.BYMONTHDAY || d0);
        const t = new Date(Date.UTC(yy, mon, md));
        if (t.getUTCMonth() !== mon) continue;
        d = dn(t.toISOString().slice(0, 10));
      }
      if (d > limit) break;
      if (push(d)) break;
    }
  }
  return out;
}
function mergeThunderbird(meet) {
  const T = todayN(),
    from = T - 400,
    to = T + 400,
    byEmail = {},
    byName = {};
  for (const [id, m] of Object.entries(S.members || {})) {
    if (m.email) byEmail[String(m.email).trim().toLowerCase()] = id;
    byName[
      String(m.name || '')
        .trim()
        .toLowerCase()
    ] = id;
  }
  const fileOwner = {};
  for (const id of Object.keys(S.members || {})) fileOwner[tbName(id).toLowerCase()] = id;
  const acc = {};
  for (const [name, f] of Object.entries(FILES)) {
    if (!f.events) continue;
    const owner = fileOwner[name.toLowerCase()];
    if (!owner) continue;
    const moved = {};
    for (const e of f.events)
      if (e.props['RECURRENCE-ID']) {
        const r = icsTime(e.props['RECURRENCE-ID'].value, e.props['RECURRENCE-ID'].params || {});
        if (r) moved[(e.props.UID?.value || '') + '|' + r.date] = 1;
      }
    for (const e of f.events) {
      if ((e.props.STATUS?.value || '').toUpperCase() === 'CANCELLED') continue;
      const uid =
        e.props.UID?.value || hashStr(JSON.stringify(e.props.SUMMARY || '') + e.props.DTSTART?.value);
      const st = icsTime(e.props.DTSTART?.value, e.props.DTSTART?.params || {});
      if (!st) continue;
      let dur = null;
      if (e.props.DURATION) dur = icsDur(e.props.DURATION.value);
      else if (e.props.DTEND) {
        const en = icsTime(e.props.DTEND.value, e.props.DTEND.params || {});
        if (en) dur = st.allDay ? 0 : (dn(en.date) - dn(st.date)) * 1440 + minOf(en.time) - minOf(st.time);
      }
      const dates = e.props['RECURRENCE-ID']
        ? (() => {
            const d = dn(st.date);
            return d >= from && d <= to ? [st.date] : [];
          })()
        : expandEvent(e, from, to).filter((d) => !moved[uid + '|' + d]);
      const atts = new Set([owner]);
      for (const a of e.attendees) {
        if ((a.part || '').toUpperCase() === 'DECLINED') continue;
        const m = byEmail[a.email] || byName[a.name.toLowerCase()];
        if (m) atts.add(m);
      }
      const loc = e.props.LOCATION ? icsUnesc(e.props.LOCATION.value) : '',
        desc = e.props.DESCRIPTION ? icsUnesc(e.props.DESCRIPTION.value) : '';
      for (const d of dates) {
        const id = 'tb-' + hashStr(uid + '|' + d);
        const prev = acc[id];
        if (prev) {
          for (const a of atts) if (!prev.attendees.includes(a)) prev.attendees.push(a);
          continue;
        }
        acc[id] = {
          title: icsUnesc(e.props.SUMMARY?.value || '(sin título)'),
          date: d,
          time: st.time,
          duration: st.allDay ? 0 : Math.max(0, dur ?? 60),
          type: 'otra',
          projectId: '',
          attendees: [...atts],
          notes: [loc && 'Lugar: ' + loc, desc].filter(Boolean).join('\n'),
          createdBy: owner,
          source: 'thunderbird',
          tbUid: uid,
          allDay: !!st.allDay,
        };
      }
    }
  }
  for (const [id, b] of Object.entries(acc)) {
    const ov = meet[id];
    if (ov && ov.hidden) {
      delete meet[id];
      continue;
    }
    meet[id] = ov
      ? {
          ...b,
          projectId: ov.projectId ?? b.projectId,
          type: ov.type || b.type,
          attendees: ov.attendees?.length ? ov.attendees : b.attendees,
          notes: ov.notes ?? b.notes,
        }
      : b;
  }
  for (const [id, m] of Object.entries(meet)) if (id.startsWith('tb-') && !acc[id]) delete meet[id]; // borrada en Thunderbird
}
/* ---------- reuniones periódicas ---------- */
let SERIES = {};
const REPEAT = [
  ['', 'No se repite'],
  ['workdays', 'Cada día laborable (lunes a viernes)'],
  ['daily', 'Cada día (también fines de semana)'],
  ['weekly', 'Cada semana'],
  ['biweekly', 'Cada dos semanas'],
  ['monthly', 'Cada mes (mismo día)'],
];
const WDL = LA(['L', 'M', 'X', 'J', 'V', 'S', 'D'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
const ATTM = [
  ['list', 'Elegir personas'],
  ['team', 'Todo el equipo'],
  ['project', 'Participantes del proyecto'],
];
function repeatLbl(r) {
  if (!r || !r.freq) return '';
  let t = (REPEAT.find((x) => x[0] === r.freq) || [, ''])[1];
  if ((r.freq === 'weekly' || r.freq === 'biweekly') && r.days?.length)
    t += ': ' + r.days.map((d) => WDL[d]).join(', ');
  return t;
}
function seriesDates(sr, from, to) {
  const r = sr.repeat || {},
    st = dn(sr.date);
  if (st == null) return [];
  const until = r.until ? dn(r.until) : Infinity;
  const a = Math.max(from, st),
    b = Math.min(to, until),
    out = [];
  const days = r.days?.length ? r.days : [(dow(st) + 6) % 7];
  for (let d = a; d <= b; d++) {
    const w = (dow(d) + 6) % 7;
    let ok = false;
    if (r.freq === 'daily') ok = true;
    else if (r.freq === 'workdays') ok = w < 5;
    else if (r.freq === 'weekly') ok = days.includes(w);
    else if (r.freq === 'biweekly')
      ok = days.includes(w) && Math.floor((monday(d) - monday(st)) / 7) % 2 === 0;
    else if (r.freq === 'monthly') ok = iso(d).slice(8) === sr.date.slice(8);
    if (ok && r.skipHol !== false && r.freq !== 'daily' && holAll(d).length) ok = false;
    if (ok) out.push(d);
  }
  return out;
}
function seriesAtt(sr, date) {
  const joined = (m) => (!m.joinedAt || date >= m.joinedAt) && inTeam(m, date);
  if (sr.attMode === 'team')
    return members()
      .filter(joined)
      .map((m) => m.id);
  if (sr.attMode === 'project') {
    const ids = projPeople(S.projects[sr.projectId]);
    return ids.filter((id) => S.members[id] && joined(S.members[id]));
  }
  return (sr.attendees || []).filter((id) => S.members[id] && inTeam(S.members[id], date));
}
const occId = (sid, d) => 'rs-' + sid + '-' + iso(d).replace(/-/g, '');
function expandSeries(meet) {
  resetCal();
  SERIES = {};
  const T = todayN(),
    from = T - 400,
    to = T + 400,
    made = new Set();
  for (const [id, m] of Object.entries(meet))
    if (m.isSeries) {
      SERIES[id] = m;
      delete meet[id];
    }
  for (const [sid, sr] of Object.entries(SERIES)) {
    for (const d of seriesDates(sr, from, to)) {
      const oid = occId(sid, d);
      made.add(oid);
      const ov = meet[oid];
      if (ov && ov.hidden) {
        delete meet[oid];
        continue;
      }
      const date = ov?.date || iso(d);
      const base = {
        title: sr.title,
        type: sr.type,
        projectId: sr.projectId,
        date,
        time: sr.time,
        duration: sr.duration,
        notes: sr.notes || '',
        createdBy: sr.createdBy,
        seriesId: sid,
        occDate: iso(d),
        attendees: seriesAtt(sr, date),
      };
      const o = { ...base };
      if (ov)
        for (const k of ['title', 'type', 'projectId', 'date', 'time', 'duration', 'notes', 'attendees'])
          if (ov[k] !== undefined) o[k] = ov[k];
      if (ov)
        o.overridden = Object.keys(ov).filter((k) =>
          ['title', 'type', 'projectId', 'date', 'time', 'duration', 'notes', 'attendees'].includes(k),
        );
      meet[oid] = o;
    }
  }
  for (const id of Object.keys(meet)) if (id.startsWith('rs-') && !made.has(id)) delete meet[id];
}
async function createTBFile() {
  const name = tbName(ME.memberId);
  try {
    await dirH.getFileHandle(name);
    toast('El archivo ya existe: ' + name);
    return;
  } catch (e) {}
  const txt = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GanttCrew//ES',
    'X-WR-CALNAME:Convocatorias · ' + icsEsc(mem(ME.memberId)?.name || ''),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  try {
    const h = await dirH.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(txt);
    await w.close();
    toast('Creado ' + name + '. Ahora añádelo en Thunderbird (pasos en esta misma tarjeta).');
    render();
  } catch (e) {
    dbErr(e);
  }
}

/* ---------- importar un .ics (Outlook, correo, otros calendarios) ---------- */
const MADRID_TZ =
  /madrid|romance|central europe|w\. europe|europe\/(paris|brussels|berlin|rome|vienna|amsterdam)|cet/i;
function icsOccurrences(events, from, to) {
  const byEmail = {},
    byName = {};
  for (const [id, m] of Object.entries(S.members || {})) {
    if (m.email) byEmail[String(m.email).trim().toLowerCase()] = id;
    byName[
      String(m.name || '')
        .trim()
        .toLowerCase()
    ] = id;
  }
  const moved = {};
  for (const e of events)
    if (e.props['RECURRENCE-ID']) {
      const r = icsTime(e.props['RECURRENCE-ID'].value, e.props['RECURRENCE-ID'].params || {});
      if (r) moved[(e.props.UID?.value || '') + '|' + r.date] = 1;
    }
  const out = [];
  for (const e of events) {
    if ((e.props.STATUS?.value || '').toUpperCase() === 'CANCELLED') continue;
    const uid = e.props.UID?.value || hashStr(JSON.stringify(e.props.SUMMARY || '') + e.props.DTSTART?.value);
    const sp = e.props.DTSTART?.params || {},
      st = icsTime(e.props.DTSTART?.value, sp);
    if (!st) continue;
    let dur = null;
    if (e.props.DURATION) dur = icsDur(e.props.DURATION.value);
    else if (e.props.DTEND) {
      const en = icsTime(e.props.DTEND.value, e.props.DTEND.params || {});
      if (en) dur = st.allDay ? 0 : (dn(en.date) - dn(st.date)) * 1440 + minOf(en.time) - minOf(st.time);
    }
    const dates = e.props['RECURRENCE-ID']
      ? ((d) => (d >= from && d <= to ? [st.date] : []))(dn(st.date))
      : expandEvent(e, from, to).filter((d) => !moved[uid + '|' + d]);
    const atts = new Set(ME.memberId ? [ME.memberId] : []);
    for (const a of e.attendees) {
      if ((a.part || '').toUpperCase() === 'DECLINED') continue;
      const m = byEmail[a.email] || byName[(a.name || '').toLowerCase()];
      if (m) atts.add(m);
    }
    const loc = e.props.LOCATION ? icsUnesc(e.props.LOCATION.value) : '',
      desc = e.props.DESCRIPTION ? icsUnesc(e.props.DESCRIPTION.value) : '';
    const tz = sp.TZID || '';
    const tzWarn = !st.allDay && tz && !MADRID_TZ.test(tz) && !/Z$/.test(e.props.DTSTART.value);
    for (const d of dates)
      out.push({
        key: uid + '|' + d,
        uid,
        date: d,
        time: st.time,
        allDay: !!st.allDay,
        duration: st.allDay ? 0 : Math.max(0, dur ?? 60),
        title: icsUnesc(e.props.SUMMARY?.value || '(sin título)'),
        notes: [loc && 'Lugar: ' + loc, desc.length > 1500 ? desc.slice(0, 1500) + '…' : desc]
          .filter(Boolean)
          .join('\n'),
        attendees: [...atts],
        tz,
        tzWarn,
        organizer: (e.attendees.find((a) => a.org) || {}).name || '',
      });
  }
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
// Saca el calendario de un correo guardado (.eml): la convocatoria va en una parte text/calendar,
// a menudo codificada en base64 o quoted-printable.
function calendarFromEML(raw) {
  const direct = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i.exec(raw);
  if (direct) return direct[0];
  const dec = (body, enc, cs) => {
    enc = (enc || '').toLowerCase();
    let bytes;
    if (enc === 'base64') {
      const b = atob(body.replace(/[^A-Za-z0-9+/=]/g, ''));
      bytes = Uint8Array.from(b, (c) => c.charCodeAt(0));
    } else if (enc === 'quoted-printable') {
      const t = body.replace(/=\r?\n/g, '');
      const out = [];
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '=' && /^[0-9A-F]{2}$/i.test(t.substr(i + 1, 2))) {
          out.push(parseInt(t.substr(i + 1, 2), 16));
          i += 2;
        } else out.push(t.charCodeAt(i) & 255);
      }
      bytes = new Uint8Array(out);
    } else bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 255);
    try {
      return new TextDecoder(cs || 'utf-8').decode(bytes);
    } catch (e) {
      return new TextDecoder('utf-8').decode(bytes);
    }
  };
  const parts = raw.split(/\r?\n--[^\r\n]+\r?\n/);
  for (const p of parts) {
    const i = p.search(/\r?\n\r?\n/);
    if (i < 0) continue;
    const head = p.slice(0, i),
      body = p.slice(i).replace(/^\r?\n\r?\n/, '');
    if (!/content-type:\s*(text\/calendar|application\/ics)/i.test(head)) continue;
    const enc = (/content-transfer-encoding:\s*([\w-]+)/i.exec(head) || [])[1],
      cs = (/charset="?([\w-]+)/i.exec(head) || [])[1];
    const txt = dec(body.replace(/\r?\n--[\s\S]*$/, ''), enc, cs);
    const m = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i.exec(txt);
    if (m) return m[0];
  }
  return '';
}
function openImportICS() {
  if (!ME.memberId) {
    toast('Elige primero quién eres.');
    return;
  }
  const body = `<div class="full hint">Elige un archivo <b>.ics</b> (convocatoria o calendario exportado) o un <b>correo guardado .eml</b> que contenga una convocatoria. Verás sus reuniones antes de registrarlas.</div>
   <label class="full">Archivo .ics o .eml<input type="file" id="iF" accept=".ics,.eml,text/calendar,message/rfc822"></label>
   <div class="full" id="iList"></div>`;
  openDlg('Importar reuniones desde un .ics o un correo (.eml)', body, null, null, true);
  $('#iF').onchange = async () => {
    const f = $('#iF').files[0];
    if (!f) return;
    let txt = '';
    try {
      txt = await f.text();
    } catch (e) {
      toast('No se pudo leer el archivo.');
      return;
    }
    if (/\.eml$/i.test(f.name) || !/BEGIN:VCALENDAR/i.test(txt)) {
      const c = calendarFromEML(txt);
      if (c) txt = c;
    }
    const evs = parseICS(txt);
    if (!evs.length) {
      $('#iList').innerHTML =
        '<div class="note warn">No encuentro ninguna convocatoria en este archivo. Si es un correo, comprueba que es el de la invitación (el que tiene los botones Aceptar / Rechazar).</div>';
      return;
    }
    const T = todayN(),
      occ = icsOccurrences(evs, T - 365, T + 400);
    const existing = new Set(
      arr('meetings')
        .map((m) => m.icsKey || (m.tbUid ? m.tbUid + '|' + m.date : ''))
        .filter(Boolean),
    );
    const rows = occ
      .map((o, i) => {
        const dup =
          existing.has(o.key) ||
          arr('meetings').some(
            (m) =>
              m.date === o.date &&
              (m.time || '') === (o.time || '') &&
              String(m.title || '')
                .trim()
                .toLowerCase() === o.title.trim().toLowerCase(),
          );
        return `<tr><td><input type="checkbox" data-i="${i}" ${dup || o.date < todayS() ? '' : 'checked'} ${dup ? 'disabled' : ''} style="width:auto"></td><td style="white-space:nowrap">${fmt(o.date)} ${o.allDay ? '<span class="mut">día completo</span>' : esc(o.time) + ' · ' + o.duration + ' min'}</td><td>${esc(o.title)}${o.organizer ? `<div class="mut" style="font-size:11.5px">Organiza: ${esc(o.organizer)}</div>` : ''}${o.tzWarn ? `<div class="tag warn" title="La hora se toma tal cual">zona ${esc(o.tz)}: revisa la hora</div>` : ''}</td><td>${o.attendees.map((a) => who(a, true)).join('')}</td><td>${dup ? '<span class="tag mut">ya registrada</span>' : ''}</td></tr>`;
      })
      .join('');
    $('#iList').innerHTML =
      `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:8px"><label>Proyecto<select id="iP">${opt(
        projects().map((p) => [p.id, p.name]),
        '',
        'General (varios proyectos)',
      )}</select></label><label>Tipo<select id="iT">${opt(Object.entries(MTYPE), 'otra')}</select></label><span class="hint">${occ.length} reunión(es) en el archivo${occ.length && occ[0].date < todayS() ? ' · las pasadas salen sin marcar' : ''}</span></div>
      <div style="max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:8px"><table><thead><tr><th><input type="checkbox" id="iAll" style="width:auto"></th><th>Fecha</th><th>Reunión</th><th>Asistentes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn pri" id="iGo">Registrar las marcadas</button></div>`;
    $('#iAll').onchange = (e) =>
      $('#iList')
        .querySelectorAll('input[data-i]:not([disabled])')
        .forEach((c) => (c.checked = e.target.checked));
    $('#iGo').onclick = async () => {
      const sel = [...$('#iList').querySelectorAll('input[data-i]:checked')].map((c) => occ[+c.dataset.i]);
      if (!sel.length) {
        toast('Marca al menos una reunión.');
        return;
      }
      const pj = val('iP'),
        ty = val('iT');
      await saveMany(
        'meetings',
        sel.map((o) => [
          'ics-' + hashStr(o.key),
          {
            title: o.title,
            date: o.date,
            time: o.allDay ? '' : o.time,
            duration: o.duration,
            type: ty,
            projectId: pj,
            attendees: o.attendees,
            notes: o.notes,
            createdBy: ME.memberId,
            source: 'ics',
            icsKey: o.key,
            updatedAt: new Date().toISOString(),
          },
        ]),
      );
      closeDlg();
      toast(`Registradas ${sel.length} reunión(es). Puedes abrir cada una para ajustarla.`);
    };
  };
}

/* ---------- calendarios .ics (Thunderbird / Outlook) ---------- */
// La herramienta escribe en la carpeta de datos un .ics por persona (lo regenera su propio
// navegador) y el PM, además, el del equipo. Cada archivo tiene un solo escritor: sin conflictos.
const slug = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'x';
const icsName = (mid) => (mid ? `calendario-${slug(S.members[mid]?.name)}.ics` : 'calendario-equipo.ics');
function icsEsc(t) {
  return String(t ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
function icsFold(l) {
  const out = [];
  let cur = '',
    n = 0;
  for (const ch of l) {
    const b = new TextEncoder().encode(ch).length;
    if (n + b > 74) {
      out.push(cur);
      cur = ' ';
      n = 1;
    }
    cur += ch;
    n += b;
  }
  out.push(cur);
  return out.join('\r\n');
}
function buildICS(mid) {
  const L = [],
    D = (s) => String(s).replace(/-/g, ''),
    next = (s) => D(iso(dn(s) + 1));
  const ev = (uid, sum, when, desc, cat) => {
    L.push(
      'BEGIN:VEVENT',
      'UID:' + uid + '@gantt-equipo',
      'DTSTAMP:20260101T000000Z',
      ...when,
      'SUMMARY:' + icsEsc(T(sum)),
    );
    if (desc) L.push('DESCRIPTION:' + icsEsc(T(desc)));
    if (cat) L.push('CATEGORIES:' + icsEsc(T(cat)));
    L.push('TRANSP:' + (cat === 'Tarea' ? 'TRANSPARENT' : 'OPAQUE'), 'END:VEVENT');
  };
  const allDay = (a, b) => ['DTSTART;VALUE=DATE:' + D(a), 'DTEND;VALUE=DATE:' + next(b || a)];
  for (const h of arr('holidays')) {
    if (mid && !holApplies(h, mid)) continue;
    ev('hol-' + h.id, 'Festivo: ' + h.name, allDay(h.date), holScopeLabel(h), 'Festivo');
  }
  for (const x of arr('extras')) {
    if (mid && x.memberId !== mid) continue;
    const t = x.taskId ? S.tasks[x.taskId] : null;
    if (t && S.projects[t.projectId]?.priv) continue;
    ev(
      'ext-' + x.id,
      (mid ? '' : (mem(x.memberId)?.name || '?') + ' · ') + 'Jornada extra (' + x.hours + ' h)',
      allDay(x.date),
      [t ? 'Tarea: ' + t.name : '', x.note].filter(Boolean).join('\n'),
      'Jornada extra',
    );
  }
  for (const a of arr('absences')) {
    if (mid && a.memberId !== mid) continue;
    const lbl = a.type === 'baja' && a.memberId !== mid ? 'Ausente' : ABS[a.type]?.t || 'Ausencia';
    ev(
      'abs-' + a.id,
      (mid ? '' : (mem(a.memberId)?.name || '?') + ' · ') + lbl,
      allDay(a.start, a.end),
      a.type === 'baja' ? '' : a.note || '',
      'Ausencia',
    );
  }
  for (const m of arr('meetings')) {
    if (mid && !(m.attendees || []).includes(mid)) continue;
    if (m.source === 'thunderbird' && mid && m.createdBy === mid) continue;
    if (!m.date) continue;
    const p = S.projects[m.projectId];
    const when = m.time
      ? (() => {
          const [hh, mm] = m.time.split(':').map(Number);
          const st = new Date(Date.UTC(2000, 0, 1, hh, mm));
          const en = new Date(st.getTime() + (+m.duration || 60) * 60000);
          const f = (d) =>
            String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + '00';
          const endDay = en.getUTCDate() > 1 ? next(m.date) : D(m.date);
          return [
            'DTSTART;TZID=Europe/Madrid:' + D(m.date) + 'T' + f(st),
            'DTEND;TZID=Europe/Madrid:' + endDay + 'T' + f(en),
          ];
        })()
      : allDay(m.date);
    ev(
      'mtg-' + m.id,
      'Reunión: ' + m.title,
      when,
      [
        MTYPE[m.type],
        p?.name,
        'Asistentes: ' +
          (m.attendees || [])
            .map((x) => mem(x)?.name)
            .filter(Boolean)
            .join(', '),
        m.notes,
      ]
        .filter(Boolean)
        .join('\n'),
      'Reunión',
    );
  }
  for (const t of arr('tasks')) {
    if (t.priv || t.status === 'done' || !t.end || inact(t)) continue;
    if (mid && t.assigneeId !== mid) continue;
    const p = S.projects[t.projectId];
    ev(
      'task-' + t.id,
      'Entrega: ' + t.name + (mid ? '' : ' · ' + (mem(t.assigneeId)?.name || 'sin asignar')),
      allDay(t.end),
      [
        p?.name,
        `Plan: ${fmt(t.start)}–${fmt(t.end)} · avance ${t.progress || 0}%`,
        blockers(t).length ? 'Bloqueada por: ' + blockers(t).map(tlabel).join(', ') : '',
      ]
        .filter(Boolean)
        .join('\n'),
      'Tarea',
    );
  }
  const name = mid ? 'Gantt · ' + (mem(mid)?.name || '') : 'Gantt · Equipo';
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GanttCrew//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc(name),
    'X-WR-TIMEZONE:Europe/Madrid',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Madrid',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  return [...head, ...L, 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}
const lastICS = {};
let icsTimer = null;
function scheduleICS() {
  if (!started || !dirH) return;
  clearTimeout(icsTimer);
  icsTimer = setTimeout(writeICSFiles, 2500);
}
async function writeICSFiles() {
  const jobs = [[ME.memberId, icsName(ME.memberId)]];
  if (ME.owner) jobs.push([null, icsName(null)]);
  for (const [mid, name] of jobs) {
    const txt = buildICS(mid);
    if (lastICS[name] === txt) continue;
    try {
      const h = await dirH.getFileHandle(name, { create: true });
      const w = await h.createWritable();
      await w.write(txt);
      await w.close();
      lastICS[name] = txt;
    } catch (e) {}
  }
}
function downloadICS(mid) {
  const blob = new Blob([buildICS(mid)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = icsName(mid);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

/* ---------- lectura periódica ---------- */
async function refresh(manual) {
  if (!started || dragging) return;
  try {
    const ch = await readDir();
    if (ch) {
      MINE = null;
      if (ME.owner) {
        await loadEvals();
        await loadPriv();
      }
      rebuild();
      render();
    } else meBox();
    if (badFiles.length && manual)
      toast('Algunos archivos se están sincronizando; se volverán a leer en unos segundos.');
    if (mode !== 'live') {
      mode = 'live';
      banner();
    }
  } catch (e) {
    mode = 'error';
    banner();
  }
}
setInterval(() => {
  if (document.visibilityState === 'visible') refresh();
}, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh();
});
function banner() {
  const b = $('#banner');
  let t = '',
    c = 'info';
  if (mode === 'error') {
    t =
      'No se puede leer la carpeta de datos. Comprueba que OneDrive está en marcha y que la carpeta sigue en su sitio; después pulsa ↻.';
    c = 'warn';
  }
  b.className = t ? 'show ' + c : '';
  b.textContent = t;
  meBox();
}
