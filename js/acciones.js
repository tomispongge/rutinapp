// Todas las modificaciones del estado pasan por aquí.
import { S, guardar, INBOX } from './store.js';
import { uuid, dayKey, clamp, hashPin, toMin, fromMin, nowMin } from './util.js';
import * as L from './logic.js';

function push(ev) {
  const e = { id: uuid(), ts: Date.now(), dia: dayKey(), estrellas: 0, ...ev };
  S.eventos.push(e);
  return e;
}

// ---------------- Pasos y rutinas ----------------
// Cada paso vale 1 ⭐; completar la rutina suma 2 ⭐ más.
export function marcarPaso(ninoId, rutinaId, pasoId, extra = {}) {
  const dia = extra.dia || dayKey();
  if (L.pasoHecho(S, ninoId, rutinaId, pasoId, dia)) return { nuevo: false, estrellas: 0 };
  const ev = { tipo: 'paso', ninoId, rutinaId, pasoId, dia, estrellas: 1 };
  if (extra.durSeg) ev.durSeg = Math.round(extra.durSeg);
  if (extra.ts) ev.ts = extra.ts;
  push(ev);
  let bonus = 0;
  let minutosEstudio = null;
  const r = S.rutinas.find(x => x.id === rutinaId);
  if (r && L.progresoRutina(S, ninoId, r, dia).completa && !L.eventoRutina(S, ninoId, rutinaId, dia)) {
    push({ tipo: 'rutina', ninoId, rutinaId, dia, estrellas: 2 });
    bonus = 2;
    // Al completar el estudio, el cronómetro se detiene y guarda los minutos.
    const c = S.cronos[ninoId];
    if (c && c.rutinaId === rutinaId) {
      const e = terminarCrono(ninoId);
      if (e) minutosEstudio = e.minutos;
    }
  }
  guardar();
  return { nuevo: true, estrellas: 1 + bonus, completa: bonus > 0, minutosEstudio };
}

// ---------------- Cronómetro de estudio ----------------
// Uno por niño. Usa marcas de tiempo: sigue contando mientras el niño está en
// Applicatzo o con el iPad bloqueado.
export function crono(ninoId) {
  return S.cronos[ninoId] || null;
}

export function iniciarCrono(ninoId, rutinaId) {
  const dia = dayKey();
  const c = S.cronos[ninoId];
  if (c && (c.dia !== dia || c.rutinaId !== rutinaId)) terminarCrono(ninoId);
  if (!S.cronos[ninoId]) S.cronos[ninoId] = { rutinaId, dia, inicio: null, acumMs: 0 };
  const c2 = S.cronos[ninoId];
  if (!c2.inicio) c2.inicio = Date.now();
  guardar();
}

export function pausarCrono(ninoId) {
  const c = S.cronos[ninoId];
  if (c && c.inicio) {
    c.acumMs += Date.now() - c.inicio;
    c.inicio = null;
    guardar();
  }
}

// Vuelve a cero sin guardar el tiempo que llevaba.
export function reiniciarCrono(ninoId) {
  delete S.cronos[ninoId];
  guardar();
}

// Guarda los minutos estudiados. Tope: el doble de lo planificado (mínimo 30 min),
// por si el cronómetro quedó corriendo olvidado.
export function terminarCrono(ninoId) {
  const c = S.cronos[ninoId];
  if (!c) return null;
  delete S.cronos[ninoId];
  const r = S.rutinas.find(x => x.id === c.rutinaId);
  const tope = Math.max(30, 2 * (r ? L.duracion(r) : 30));
  const min = Math.min(tope, Math.round(L.transcurridoMs(c) / 60000));
  const e = min > 0 ? push({ tipo: 'cronometro', ninoId, rutinaId: c.rutinaId, dia: c.dia, minutos: min }) : null;
  guardar();
  return e;
}

export function cerrarCronosViejos() {
  for (const [id, c] of Object.entries(S.cronos)) {
    if (c.dia !== dayKey()) terminarCrono(id);
  }
}

export function desmarcarPaso(ninoId, rutinaId, pasoId, dia = dayKey()) {
  const now = Date.now();
  for (const e of S.eventos) {
    if (e.anulado || e.ninoId !== ninoId || e.dia !== dia || e.rutinaId !== rutinaId) continue;
    if (e.tipo === 'rutina' || (e.tipo === 'paso' && e.pasoId === pasoId)) {
      e.anulado = true;
      e.u = now;
    }
  }
  guardar();
}

// Marca un taller como "fui" o "suspendida" y recalcula el plan B del día.
// Devuelve los nombres de las rutinas que el plan B agregó.
export function marcarActividad(ninoId, actividadId, estado) {
  const dia = dayKey();
  for (const e of S.eventos) {
    if (!e.anulado && e.tipo === 'actividad' && e.ninoId === ninoId && e.actividadId === actividadId && e.dia === dia) {
      e.anulado = true;
      e.u = Date.now();
    }
  }
  if (estado) push({ tipo: 'actividad', ninoId, actividadId, estado });
  const agregadas = aplicarPlanB(ninoId, dia);
  guardar();
  return agregadas;
}

// Plan B, recalculado desde cero cada vez que cambia el estado de un taller:
// - Si se suspende el PRIMER taller del día, el niño llega a la hora normal del
//   colegio: se agrega "Llegada del colegio" con todos sus pasos.
// - Si se suspenden TODOS, se quita la llegada programada después de los talleres
//   ("Llegada del taller").
// - Si ese día no había estudio, se agrega.
// Los cambios llevan origen 'planB' para poder deshacerlos si después marca "Fui".
function aplicarPlanB(ninoId, dia) {
  const k = L.nino(S, ninoId);
  for (const e of S.eventos) {
    if (!e.anulado && e.ninoId === ninoId && e.dia === dia && e.origen === 'planB') {
      e.anulado = true;
      e.u = Date.now();
    }
  }
  const acts = L.actividadesDelDia(S, k, dia);
  const susp = acts.filter(a => L.estadoActividad(S, ninoId, a.id, dia) === 'suspendida');
  if (!susp.length) return [];

  const agregadas = [];
  const primera = acts[0];
  const inicioTalleres = toMin(primera.desde);
  const primeraSuspendida = susp.includes(primera);
  const hoy = L.rutinasDelDia(S, k, dia);

  if (primeraSuspendida && !hoy.some(x => x.r.tipo === 'llegada' && x.hora && toMin(x.hora) < inicioTalleres)) {
    const candidatas = S.rutinas
      .filter(r => r.tipo === 'llegada' && r.ninos.includes(ninoId) && !hoy.some(x => x.r.id === r.id))
      .sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
    const colegio = candidatas.find(r => /colegio/i.test(r.nombre)) || candidatas[0];
    if (colegio) {
      push({ tipo: 'extra', ninoId, rutinaId: colegio.id, dia, hora: colegio.hora || '13:30', origen: 'planB' });
      agregadas.push(colegio.nombre);
    }
  }
  const llegadasTaller = hoy.filter(x => x.r.tipo === 'llegada' && x.hora && toMin(x.hora) >= inicioTalleres);
  const ultimoQueFue = [...acts].reverse().find(a => !susp.includes(a));
  if (!ultimoQueFue) {
    for (const x of llegadasTaller) push({ tipo: 'omitir', ninoId, rutinaId: x.r.id, dia, origen: 'planB' });
  } else if (susp.includes(acts[acts.length - 1])) {
    // Fue a los primeros talleres pero se suspendieron los últimos: llega antes.
    for (const x of llegadasTaller) {
      if (toMin(x.hora) > toMin(ultimoQueFue.hasta)) {
        push({ tipo: 'omitir', ninoId, rutinaId: x.r.id, dia, origen: 'planB' });
        push({ tipo: 'extra', ninoId, rutinaId: x.r.id, dia, hora: ultimoQueFue.hasta, origen: 'planB' });
      }
    }
  }
  if (!hoy.some(x => x.r.tipo === 'estudio')) {
    const estudio = S.rutinas.find(r => r.tipo === 'estudio' && r.ninos.includes(ninoId));
    if (estudio) {
      const hora = primeraSuspendida ? (estudio.hora || primera.desde) : susp[0].desde;
      push({ tipo: 'extra', ninoId, rutinaId: estudio.id, dia, hora, origen: 'planB' });
      agregadas.push(estudio.nombre);
    }
  }
  return agregadas;
}

export function agregarRutinaHoy(ninoId, rutinaId, hora) {
  const dia = dayKey();
  const ya = S.eventos.some(e => !e.anulado && e.tipo === 'extra' && e.ninoId === ninoId && e.rutinaId === rutinaId && e.dia === dia);
  if (ya) return;
  push({ tipo: 'extra', ninoId, rutinaId, hora: hora || fromMin(Math.ceil(nowMin() / 5) * 5) });
  guardar();
}

export function quitarRutinaHoy(ninoId, rutinaId) {
  const dia = dayKey();
  for (const e of S.eventos) {
    if (!e.anulado && e.tipo === 'extra' && e.ninoId === ninoId && e.rutinaId === rutinaId && e.dia === dia) {
      e.anulado = true;
      e.u = Date.now();
    }
  }
  guardar();
}

// ---------------- Pantalla ----------------
// El cronómetro usa marcas de tiempo, así sigue contando aunque el iPad se
// bloquee o el niño cambie de app.
export function timer(ninoId) {
  if (!S.timers[ninoId]) S.timers[ninoId] = { inicio: null, acumMs: 0, dia: dayKey() };
  return S.timers[ninoId];
}

export function iniciarPantalla(ninoId) {
  const t = timer(ninoId);
  if (t.dia !== dayKey() && L.transcurridoMs(t) > 0) terminarPantalla(ninoId);
  const t2 = timer(ninoId);
  if (!t2.inicio) {
    t2.inicio = Date.now();
    t2.dia = dayKey();
  }
  guardar();
}

export function pausarPantalla(ninoId) {
  const t = timer(ninoId);
  if (t.inicio) {
    t.acumMs += Date.now() - t.inicio;
    t.inicio = null;
  }
  guardar();
}

export function terminarPantalla(ninoId) {
  const t = timer(ninoId);
  const ms = L.transcurridoMs(t);
  const dia = t.dia || dayKey();
  S.timers[ninoId] = { inicio: null, acumMs: 0, dia: dayKey() };
  // Tope de 4 h por si el cronómetro quedó corriendo toda la noche.
  const min = Math.min(240, Math.round(ms / 60000));
  if (min <= 0) {
    guardar();
    return null;
  }
  const k = L.nino(S, ninoId);
  const pres = L.presupuestoPantalla(S, k, dia).total;
  const antes = L.minutosPantalla(S, ninoId, dia);
  const exceso = Math.max(0, antes + min - pres) - Math.max(0, antes - pres);
  const aTiempo = exceso <= 1;
  const e = push({ tipo: 'pantalla', ninoId, dia, minutos: min, exceso: aTiempo ? 0 : exceso, aTiempo, estrellas: aTiempo ? 1 : 0 });
  guardar();
  return e;
}

export function cerrarTimersViejos() {
  for (const [id, t] of Object.entries(S.timers)) {
    if (t.dia !== dayKey() && L.transcurridoMs(t) > 0 && L.nino(S, id)) terminarPantalla(id);
  }
}

export function desbloquearPantallaHoy(ninoId) {
  S.desbloqueos[ninoId] = dayKey();
  guardar();
}

// ---------------- Lectura y pruebas ----------------
export function registrarLectura(ninoId, libroId, pagina) {
  const libro = S.libros.find(b => b.id === libroId);
  if (!libro) return null;
  const dia = dayKey();
  const pag = clamp(Math.round(Number(pagina) || 0), 0, Number(libro.paginas) || 0);
  const plan = L.planLector(S, libro, dia);
  const meta = pag >= plan.metaHoy;
  const yaMeta = S.eventos.some(e => !e.anulado && e.tipo === 'lectura' && e.libroId === libroId && e.dia === dia && e.meta);
  push({ tipo: 'lectura', ninoId, libroId, pagina: pag, meta, estrellas: meta && !yaMeta ? 1 : 0 });
  const pc = L.pasoConAccion(S, ninoId, dia, 'lector');
  if (pc) marcarPaso(ninoId, pc.rutina.id, pc.paso.id);
  guardar();
  return { meta, nuevaMeta: meta && !yaMeta, terminado: pag >= (Number(libro.paginas) || 0) };
}

export function agregarPrueba(ninoId, materia, fecha) {
  S.pruebas.push({ id: uuid(), ninoId, materia: String(materia).slice(0, 60), fecha });
  guardar();
}

export function borrarPrueba(id) {
  S.pruebas = S.pruebas.filter(p => p.id !== id);
  guardar();
}

// ---------------- Premios ----------------
export function pedirCanje(ninoId, premioId) {
  const p = S.premios.find(x => x.id === premioId);
  if (!p || L.disponibles(S, ninoId) < p.costo) return false;
  push({ tipo: 'canje', ninoId, premioId, nombre: p.nombre, emoji: p.emoji, costo: p.costo, estado: 'pendiente' });
  guardar();
  return true;
}

export function resolverCanje(eventoId, aprobar) {
  const e = S.eventos.find(x => x.id === eventoId);
  if (!e || e.estado !== 'pendiente') return;
  e.estado = aprobar ? 'aprobado' : 'rechazado';
  e.estrellas = aprobar ? -e.costo : 0;
  e.u = Date.now();
  guardar();
}

// ---------------- Adulto ----------------
const SESION_ADULTO = 'rutinapp.adulto';

export function fijarPin(pin) {
  S.ajustes.pinHash = hashPin(pin, S.ajustes.pinSalt);
  guardar();
}
export function verificarPin(pin) {
  return !S.ajustes.pinHash || hashPin(pin, S.ajustes.pinSalt) === S.ajustes.pinHash;
}
export function adultoActivo() {
  try { return Number(sessionStorage.getItem(SESION_ADULTO)) > Date.now(); } catch { return false; }
}
export function activarAdulto() {
  try { sessionStorage.setItem(SESION_ADULTO, String(Date.now() + 15 * 60000)); } catch { /* sin sesión */ }
}
export function cerrarAdulto() {
  try { sessionStorage.removeItem(SESION_ADULTO); } catch { /* sin sesión */ }
}

export function fijarSiesta(hhmm) {
  if (!hhmm) {
    S.ajustes.siestaHasta = null;
  } else {
    const d = new Date();
    const m = toMin(hhmm);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    S.ajustes.siestaHasta = d.getTime();
  }
  guardar();
}

// ---------------- Resultados de Applicatzo ----------------
// Se premia terminar la guía (2 ⭐), no cada respuesta correcta: así la
// recompensa no compite con las ganas de aprender.
export function ingerirInbox() {
  let items = [];
  try { items = JSON.parse(localStorage.getItem(INBOX) || '[]'); } catch { items = []; }
  if (!Array.isArray(items) || !items.length) return 0;
  let n = 0;
  for (const it of items) {
    if (!it || !L.nino(S, it.nino) || S.eventos.some(e => e.id === it.id)) continue;
    const ts = Number(it.ts) || Date.now();
    const dia = dayKey(new Date(ts));
    const correctas = clamp(Math.round(Number(it.correctas) || 0), 0, 500);
    const total = clamp(Math.round(Number(it.total) || 0), 0, 500);
    S.eventos.push({
      id: typeof it.id === 'string' ? it.id.slice(0, 40) : uuid(),
      ts, dia, tipo: 'applicatzo', ninoId: it.nino,
      modulo: String(it.modulo || 'Guía').slice(0, 80),
      correctas, total, estrellas: 2,
    });
    const pc = L.pasoConAccion(S, it.nino, dia, it.copia ? 'copia' : 'applicatzo')
      || (it.copia ? null : L.pasoConAccion(S, it.nino, dia, 'materia'));
    if (pc) marcarPaso(it.nino, pc.rutina.id, pc.paso.id, { dia, ts });
    n++;
  }
  try { localStorage.removeItem(INBOX); } catch { /* nada */ }
  guardar();
  return n;
}
