// Persistencia local. Fase 1: todo vive en este dispositivo (localStorage).
// Los eventos son inmutables salvo la marca `anulado`, para que la futura
// sincronización en la nube pueda unirlos sin conflictos.
import { seedState } from './seed.js';

const KEY = 'rutinapp.v1';
// Applicatzo deja aquí sus resultados; Rutinapp los recoge al volver.
export const INBOX = 'rutinapp.inbox';

export let S = null;

export function cargar() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* almacenamiento bloqueado */ }
  try {
    S = raw ? migrar(JSON.parse(raw)) : seedState();
  } catch {
    S = seedState();
  }
  return S;
}

// La sincronización se suscribe aquí para subir cambios unos segundos después.
let oyenteGuardar = null;
export function alGuardar(fn) { oyenteGuardar = fn; }

// { silencioso: true } lo usa la propia sincronización, para no dispararse a sí misma.
export function guardar({ silencioso = false } = {}) {
  S.actualizado = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    // Sin datos personales en la consola: solo el tipo de error.
    console.warn('Rutinapp: no se pudo guardar', e && e.name);
  }
  if (!silencioso && oyenteGuardar) oyenteGuardar();
}

function migrar(s) {
  const base = seedState();
  s.version = s.version || 1;
  s.ajustes = { ...base.ajustes, ...(s.ajustes || {}) };
  for (const k of ['ninos', 'rutinas', 'actividades', 'premios', 'juegos', 'libros', 'pruebas', 'eventos']) {
    if (!Array.isArray(s[k])) s[k] = base[k];
  }
  s.timers = s.timers || {};
  s.cronos = s.cronos || {};
  s.desbloqueos = s.desbloqueos || {};
  return s;
}

export function exportar() {
  return JSON.stringify(S, null, 2);
}

export function importar(texto) {
  const s = JSON.parse(texto);
  if (!s || !Array.isArray(s.ninos) || !Array.isArray(s.eventos) || !Array.isArray(s.rutinas)) {
    throw new Error('El archivo no es un respaldo de Rutinapp');
  }
  // Marcas de sincronización fuera: lo restaurado se vuelve a subir completo.
  for (const e of s.eventos) delete e._s;
  S = migrar(s);
  guardar();
}

// Para empezar de cero después de probar: borra estrellas, historial,
// cronómetros y desbloqueos, pero conserva apodos, PIN, rutinas, talleres,
// premios, libros (vuelven a su página inicial) y pruebas anotadas.
export function borrarProgreso(hoy) {
  // Los mensajes no son progreso: se conservan.
  S.eventos = S.eventos.filter(e => e.tipo === 'mensaje');
  // Los otros equipos sincronizados borran sus eventos anteriores a esta marca.
  S.ajustes.progresoDesde = Date.now();
  S.timers = {};
  S.cronos = {};
  S.desbloqueos = {};
  S.ajustes.siestaHasta = null;
  S.creado = hoy;
  try { localStorage.removeItem(INBOX); } catch { /* nada */ }
  guardar();
}

export function borrarTodo() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(INBOX);
  } catch { /* nada que borrar */ }
  S = seedState();
  guardar();
}
