/* ---------- idioma / language (ES · EN) ----------
   The app is written in Spanish. When English is chosen, every visible text
   is translated on the fly with the dictionary in i18n/en.tsv (embedded at
   build time as I18N_EN). Stored data (JSON files) is never translated. */
let LANG = (() => {
  try {
    return localStorage.getItem('gantt.lang') === 'en' ? 'en' : 'es';
  } catch (e) {
    return 'es';
  }
})();
const I18N_EN = __I18N_EN__;
const LOC = () => (LANG === 'en' ? 'en-GB' : 'es-ES');
const _LA = [];
// language-aware arrays (month and weekday names): same array object, contents swapped on change
function LA(es, en) {
  const a = [...(LANG === 'en' ? en : es)];
  _LA.push([a, es, en]);
  return a;
}
const LAx = (es, en) => (LANG === 'en' ? en : es);
const I18N = (() => {
  const D = new Map(),
    keys = [];
  // keys starting with "=" match only a whole text; single words too (so names are left alone).
  // "#" in a key stands for a number: "Modificar # reunión(es)" -> "Modify # meeting(s)".
  const NK = [];
  for (let [k, v] of Object.entries(I18N_EN)) {
    let exact = false;
    if (k[0] === '=') {
      k = k.slice(1);
      exact = true;
    }
    if (k.includes('#')) {
      NK.push([k, v]);
      continue;
    }
    D.set(k, v);
    if (!exact && /[\s(),:;.«»·…!?¿¡\/–—+]/.test(k) && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(k)) keys.push(k);
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const L = /[\p{L}\p{N}]/u;
  const alt = (k) =>
    (L.test(k[0]) ? '(?<![\\p{L}\\p{N}])' : '') + escRe(k) + (L.test(k[k.length - 1]) ? '(?![\\p{L}])' : '');
  const RE = keys.length ? new RegExp(keys.map(alt).join('|'), 'gu') : null;
  const NRE = NK.map(([k, v]) => [
    new RegExp('^' + escRe(k).replace(/#/g, '(\\d+(?:[.,]\\d+)?)') + '$', 'u'),
    v,
  ]);
  // counted words after a number ("3 días", "2 festivos"…)
  const NUMW = {
    'días lab.': 'working days',
    días: 'days',
    día: 'day',
    festivos: 'holidays',
    festivo: 'holiday',
    tareas: 'tasks',
    tarea: 'task',
    personas: 'people',
    persona: 'person',
    reuniones: 'meetings',
    reunión: 'meeting',
    semanas: 'weeks',
    semana: 'week',
    meses: 'months',
    mes: 'month',
    años: 'years',
    año: 'year',
    horas: 'hours',
    hora: 'hour',
    proyectos: 'projects',
    proyecto: 'project',
    miembros: 'members',
    miembro: 'member',
    avisos: 'alerts',
    aviso: 'alert',
    ausencias: 'absences',
    ausencia: 'absence',
    'reun.': 'mtg',
    'h/día': 'h/day',
  };
  const NUMRE = new RegExp(
    '(\\d+(?:[.,]\\d+)?\\s*)(' +
      Object.keys(NUMW)
        .sort((a, b) => b.length - a.length)
        .map(escRe)
        .join('|') +
      ')(?![\\p{L}])',
    'gu',
  );
  // words right before a number ("Versión 09/11", "Tareas 4 h")
  const PREW = {
    Versión: 'Version',
    versión: 'version',
    Tareas: 'Tasks',
    Reuniones: 'Meetings',
    Capacidad: 'Capacity',
    Prevista: 'Forecast',
    Semana: 'Week',
    Hoy: 'Today',
    terminada: 'finished',
    Terminada: 'Finished',
    desde: 'since',
    hasta: 'until',
    en: 'in',
  };
  const PRERE = new RegExp('(?<![\\p{L}])(' + Object.keys(PREW).join('|') + ')(?=\\s+[\\d+−-])', 'gu');
  const cache = new Map();
  const HAS = /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/;
  function tr(s) {
    if (LANG !== 'en' || s == null) return s;
    s = String(s);
    if (!HAS.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    let core = m[2],
      out;
    if (D.has(core)) out = D.get(core);
    else if (
      NRE.some(([r, v]) => {
        const x = core.match(r);
        if (x) {
          let i = 1;
          out = v.replace(/#/g, () => x[i++]);
          return true;
        }
      })
    );
    else {
      const c2 = core.replace(/\s+/g, ' ');
      if (D.has(c2)) out = D.get(c2);
      else {
        out = RE ? c2.replace(RE, (k) => D.get(k)) : c2;
        out = out
          .replace(NUMRE, (m, n, w) => n + NUMW[w])
          .replace(PRERE, (w) => PREW[w])
          .replace(/(\d+) de (\d+)/g, '$1 of $2');
      }
      if (c2 === core && out === c2) out = core;
    }
    out = m[1] + out + m[3];
    if (cache.size > 20000) cache.clear();
    cache.set(s, out);
    return out;
  }
  const ATTR = ['title', 'placeholder', 'aria-label', 'data-tip'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
  const ES = new WeakMap(); // text node -> [original, translated]
  const ESA = new WeakMap(); // element -> {attr:[original, translated]}
  function skip(el) {
    for (let e = el; e; e = e.parentElement) {
      if (SKIP.has(e.tagName) || e.isContentEditable) return true;
      if (e.hasAttribute && e.hasAttribute('data-notr')) return true;
    }
    return false;
  }
  function txt(n) {
    const v = n.nodeValue,
      st = ES.get(n);
    if (st && v === st[1]) return; // our own translation
    const t = tr(v);
    if (t !== v) {
      ES.set(n, [v, t]);
      n.nodeValue = t;
    } else ES.delete(n);
  }
  function attrs(el) {
    for (const a of ATTR) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      let st = ESA.get(el);
      if (st && st[a] && st[a][1] === v) continue;
      const t = tr(v);
      if (t !== v) {
        if (!st) {
          st = {};
          ESA.set(el, st);
        }
        st[a] = [v, t];
        el.setAttribute(a, t);
      }
    }
  }
  function walk(root) {
    if (LANG !== 'en' || !root) return;
    if (root.nodeType === 3) {
      if (!skip(root.parentElement)) txt(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (skip(root)) return;
      attrs(root);
    }
    const w = document.createTreeWalker(root, 5, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-notr')) ? 2 : 1),
    });
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) txt(n);
      else attrs(n);
    }
  }
  function restore(root) {
    const w = document.createTreeWalker(root, 5);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        const st = ES.get(n);
        if (st && n.nodeValue === st[1]) n.nodeValue = st[0];
        ES.delete(n);
      } else {
        const st = ESA.get(n);
        if (st) {
          for (const a in st) if (n.getAttribute(a) === st[a][1]) n.setAttribute(a, st[a][0]);
          ESA.delete(n);
        }
      }
    }
  }
  let mo = null;
  function observe() {
    if (mo) return;
    mo = new MutationObserver((list) => {
      if (LANG !== 'en') return;
      for (const r of list) {
        if (r.type === 'childList') r.addedNodes.forEach(walk);
        else if (r.type === 'characterData') {
          if (!skip(r.target.parentElement)) txt(r.target);
        } else if (r.type === 'attributes' && ATTR.includes(r.attributeName)) attrs(r.target);
      }
    });
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTR,
    });
  }
  return { tr, walk, restore, observe };
})();
const T = I18N.tr;
// native dialogs
for (const k of ['alert', 'confirm', 'prompt']) {
  const f = window[k].bind(window);
  window[k] = (m, ...r) => f(T(m), ...r);
}

function setLang(l) {
  l = l === 'en' ? 'en' : 'es';
  if (l === LANG) return;
  try {
    localStorage.setItem('gantt.lang', l);
  } catch (e) {}
  I18N.restore(document.body);
  LANG = l;
  for (const [a, es, en] of _LA) a.splice(0, a.length, ...(l === 'en' ? en : es));
  document.documentElement.lang = l;
  langSw();
  try {
    if (typeof started !== 'undefined' && started) render();
    else if (typeof renderGateAgain === 'function') renderGateAgain();
  } catch (e) {}
  I18N.walk(document.body);
  try {
    if (typeof renderBell === 'function') renderBell();
  } catch (e) {}
}
function langSw() {
  // one switch next to the version (top-left corner) and one on the start screens (top-right)
  const mk = (id, host) => {
    let b = document.getElementById(id);
    if (!b) {
      if (!host) return;
      b = document.createElement('span');
      b.id = id;
      b.className = 'langsw';
      b.setAttribute('data-notr', '');
      host.appendChild(b);
      b.onclick = (e) => {
        const x = e.target.closest('[data-lang]');
        if (x) setLang(x.dataset.lang);
      };
    }
    b.innerHTML = ['es', 'en']
      .map(
        (x) =>
          `<button type="button" data-lang="${x}" class="${x === LANG ? 'on' : ''}" title="${x === 'es' ? 'Español' : 'English'}">${x.toUpperCase()}</button>`,
      )
      .join('');
  };
  mk('langSw', document.querySelector('header .brandbox .ver')?.parentElement);
  mk('langSwG', document.body);
}
document.documentElement.lang = LANG;
// this script sits at the end of <body>: the static page already exists
langSw();
I18N.walk(document.body);
I18N.observe();
