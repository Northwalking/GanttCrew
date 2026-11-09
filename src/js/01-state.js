/* ---------- estado ---------- */
// Demo build (GitHub Pages): data lives in the browser's private storage instead of a shared folder
const DEMO = '__DEMO__',
  DEMO_PW = 'demo-1234';
const TABLES = {
  projects: 'projects',
  members: 'members',
  tasks: 'tasks',
  meetings: 'meetings',
  settings: 'config',
  evals: 'evals',
  absences: 'absences',
  holidays: 'holidays',
  extras: 'extras',
};
const S = {
  projects: {},
  members: {},
  tasks: {},
  meetings: {},
  config: {},
  evals: {},
  absences: {},
  holidays: {},
  extras: {},
};
const ME = { memberId: null, owner: false };
let mode = 'loading',
  dragging = false,
  pendingRender = false,
  firstGantt = true,
  started = false;
const now = new Date();
const UI = {
  groupBy: (() => {
    try {
      return localStorage.getItem('gantt.group') || 'project';
    } catch (e) {
      return 'project';
    }
  })(),
  calMode: 'mes',
  calMonth: null,
  calDay: null,
  calMember: '',
  showPriv: (() => {
    try {
      return localStorage.getItem('gantt.showPriv') !== '0';
    } catch (e) {
      return true;
    }
  })(),
  span: (() => {
    try {
      return localStorage.getItem('gantt.span') || 'auto';
    } catch (e) {
      return 'auto';
    }
  })(),
  meetQ: '',
  meetSel: false,
  meetPick: new Set(),
  view: 'gantt',
  year: now.getFullYear(),
  ppd: (() => {
    try {
      const v = +localStorage.getItem('gantt.zoom');
      return v === 8 || v === 1 || v === 3 ? 8 : 22;
    } catch (e) {
      return 22;
    }
  })(),
  proj: new Set(),
  member: '',
  origin: '',
  showDone: true,
  collapsed: new Set(),
  sort: 'end',
  meetPeriod: now.toISOString().slice(0, 7),
  meetMember: '',
};
const LBL = 340,
  DAY = 864e5;
let GBT = 8;
const MES3S = LA(
  ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
);
const fmtS = (d) => (d ? `${+d.slice(8, 10)} ${MES3S[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '');
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESL = LA(
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
const ORIG = {
  plan: { t: 'Planificada', c: 'mut' },
  found: { t: 'Detectada en desarrollo', c: 'found' },
  inc: { t: 'Incidencia', c: 'inc' },
  chg: { t: 'Cambio solicitado', c: 'chg' },
};
const STAT = { pending: 'Pendiente', doing: 'En curso', blocked: 'Bloqueada', done: 'Completada' };
const MTYPE = {
  seguimiento: 'Seguimiento',
  tecnica: 'Técnica',
  cliente: 'Con cliente',
  planificacion: 'Planificación',
  otra: 'Otra',
};
const RUBRIC = [
  'No cumple los criterios de aceptación: hay que rehacerla.',
  'Incumple algún criterio importante: necesita correcciones relevantes.',
  'Cumple lo esencial, con defectos menores que se corrigen sin rehacerla.',
  'Cumple todos los criterios, con observaciones menores que no requieren cambios.',
  'Cumple todos los criterios sin observaciones; puede servir de referencia.',
];
const RLBL = ['Deficiente', 'Insuficiente', 'Aceptable', 'Bueno', 'Excelente'];
const PALETTE = [
  '#2f5bea',
  '#0e9384',
  '#c11574',
  '#dc6803',
  '#6941c6',
  '#1570ef',
  '#039855',
  '#b42318',
  '#7a5af8',
  '#475467',
];
