// Utilidades sin estado: DOM, fechas, identificadores y sonidos.

// Crea un elemento. Todo el texto entra como nodos de texto (nunca innerHTML),
// así lo que escriban niños o adultos no puede inyectar HTML.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
}

// crypto.randomUUID solo existe en contextos seguros (https); en la red local
// (http://192.168…) usamos getRandomValues, que sí está disponible.
export function uuid() {
  if (crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* contexto no seguro */ }
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// ---------- Fechas (siempre hora local, días como 'AAAA-MM-DD') ----------
export const pad = n => String(n).padStart(2, '0');
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Orden de la semana chilena: lunes primero.
export const SEMANA = [1, 2, 3, 4, 5, 6, 0];

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
// Math.round absorbe los cambios de horario de verano.
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}
export function weekday(key) {
  return parseDay(key).getDay();
}
export function weekStart(key) {
  return addDays(key, -((weekday(key) + 6) % 7));
}
export function toMin(hhmm) {
  if (!hhmm) return null;
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
}
export function fromMin(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function nowMin(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}
export function fechaLarga(key) {
  const d = parseDay(key);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
export function fechaCorta(key) {
  const d = parseDay(key);
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
export function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
export function horasMin(min) {
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
}

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function mediana(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// El PIN es un candado para niños, no una medida de seguridad: 4 dígitos se
// adivinan rápido con cualquier algoritmo. Se guarda con hash solo para que
// no quede a la vista. FNV-1a funciona igual en http (red local) y https.
export function hashPin(pin, salt) {
  let x = 0x811c9dc5;
  for (const ch of `${salt}:${pin}`) {
    x ^= ch.charCodeAt(0);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(16);
}

// ---------- Audio (iOS exige un toque del usuario antes de sonar) ----------
let audioCtx = null;
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}
export function chime(notas = 3) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [660, 880, 1100].slice(0, notas).forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t = t0 + i * 0.18;
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.45);
  });
}
