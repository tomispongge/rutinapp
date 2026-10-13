// Sincronización con Supabase usando su API REST (sin librerías: si no hay
// internet, la app sigue funcionando igual y sincroniza cuando vuelva).
//
// Qué se sincroniza:
// - Eventos (pasos, pantalla, estudio, guías, canjes…): se unen por id; si el
//   mismo evento cambió en dos equipos, gana la versión más nueva (u || ts).
// - Configuración (ajustes, niños, rutinas, talleres, premios, libros, pruebas):
//   mezcla de 3 vías contra la última versión sincronizada ("base"), así los
//   cambios hechos en equipos distintos se combinan en vez de pisarse.
// - Los cronómetros en curso quedan solo en el equipo donde corren.
import { S, guardar, alGuardar } from './store.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const K_SESION = 'rutinapp.nube.sesion';
const K_META = 'rutinapp.nube.meta';
const CLAVES = ['ajustes', 'ninos', 'rutinas', 'actividades', 'premios', 'juegos', 'libros', 'pruebas', 'desbloqueos', 'creado'];
const POR_ID = ['ninos', 'rutinas', 'actividades', 'premios', 'libros', 'pruebas'];
const POR_CAMPO = ['ajustes', 'desbloqueos'];

const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const escribir = (k, v) => {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ }
};

let sesion = leer(K_SESION); // { access_token, refresh_token, expires_at, email, familia_id }
let meta = leer(K_META) || {}; // { base, cursor, ultima, error }
let enCurso = null;
let otraVez = false;
let temporizador = null;
let refrescando = null;
let alCambiosRemotos = () => {};
const oyentes = new Set();

export const configurada = () => !!(SUPABASE_URL && SUPABASE_KEY);

export function estado() {
  return {
    configurada: configurada(), conectado: !!sesion, email: sesion && sesion.email,
    ultima: meta.ultima || null, error: meta.error || null, sincronizando: !!enCurso,
  };
}
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
const avisar = () => oyentes.forEach(fn => { try { fn(estado()); } catch { /* ignorar */ } });

// ---------------- HTTP ----------------
const TRADUCCIONES = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Falta confirmar el correo: revisa tu bandeja de entrada (y spam).'],
  [/already registered|already been registered/i, 'Ese correo ya tiene cuenta: usa «Entrar».'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/rate limit/i, 'Se enviaron demasiados correos. Espera un rato y vuelve a intentar.'],
  [/unable to validate email|invalid format/i, 'Revisa que el correo esté bien escrito.'],
  [/refresh token|jwt expired|invalid jwt/i, 'Tu sesión expiró: vuelve a entrar.'],
  [/failed to fetch|networkerror|load failed/i, 'Sin conexión: se sincroniza cuando vuelva internet.'],
];
const traducir = msg => (TRADUCCIONES.find(([re]) => re.test(msg)) || [null, msg])[1];

async function api(ruta, opciones = {}) {
  try {
    return await llamar(ruta, opciones);
  } catch (e) {
    // Token rechazado antes de su vencimiento (p. ej. revocado): se renueva y se reintenta una vez.
    if (e.status !== 401 || opciones.auth === false || !sesion) throw e;
    sesion.expires_at = 0;
    await asegurarToken();
    return llamar(ruta, opciones);
  }
}

async function llamar(ruta, { method = 'GET', body, auth = true, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  if (auth) {
    await asegurarToken();
    headers.Authorization = `Bearer ${sesion.access_token}`;
  }
  let res;
  try {
    res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + ruta, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new Error(traducir(String(e && e.message)));
  }
  const texto = await res.text();
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `Error ${res.status}`;
    const err = new Error(traducir(String(msg)));
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------- Sesión ----------------
function guardarSesion(d, email) {
  sesion = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    email: (d.user && d.user.email) || email || (sesion && sesion.email),
    familia_id: (sesion && sesion.familia_id) || null,
  };
  escribir(K_SESION, sesion);
}

function olvidarSesion() {
  sesion = null;
  meta = {};
  escribir(K_SESION, null);
  escribir(K_META, null);
  for (const e of S.eventos) delete e._s;
  guardar({ silencioso: true });
}

async function asegurarToken() {
  if (!sesion) throw new Error('Sin sesión');
  if (sesion.expires_at - 60 > Date.now() / 1000) return;
  if (!refrescando) {
    refrescando = api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sesion.refresh_token }, auth: false })
      .then(d => guardarSesion(d))
      .catch(e => {
        if (e.status === 400 || e.status === 401) olvidarSesion();
        throw e;
      })
      .finally(() => { refrescando = null; });
  }
  await refrescando;
}

async function prepararFamilia() {
  sesion.familia_id = await api('/rest/v1/rpc/mi_familia', { method: 'POST', body: {} });
  escribir(K_SESION, sesion);
}

// Al conectar un equipo: todo lo local se considera pendiente de subir y,
// si la nube ya tiene datos de la familia, su configuración manda.
async function conectado() {
  await prepararFamilia();
  meta = {};
  escribir(K_META, meta);
  for (const e of S.eventos) delete e._s;
  await sincronizar();
}

export async function entrar(email, password) {
  const d = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
  guardarSesion(d, email);
  await conectado();
}

// Devuelve { confirmar: true } si Supabase pide confirmar el correo.
export async function registrar(email, password) {
  const volver = encodeURIComponent(location.origin + location.pathname);
  const d = await api(`/auth/v1/signup?redirect_to=${volver}`, { method: 'POST', body: { email, password }, auth: false });
  if (d && d.access_token) {
    guardarSesion(d, email);
    await conectado();
    return { confirmar: false };
  }
  return { confirmar: true };
}

export async function salir() {
  try { if (sesion) await api('/auth/v1/logout', { method: 'POST' }); } catch { /* igual se cierra aquí */ }
  olvidarSesion();
  avisar();
}

// Borra la configuración y los eventos de la familia en la nube y cierra la sesión.
// Lo guardado en este dispositivo se mantiene.
export async function borrarDatosNube() {
  if (!sesion) return;
  const fid = sesion.familia_id || await api('/rest/v1/rpc/mi_familia', { method: 'POST', body: {} });
  await api(`/rest/v1/eventos?familia_id=eq.${fid}`, { method: 'DELETE' });
  await api(`/rest/v1/estado?familia_id=eq.${fid}`, { method: 'DELETE' });
  await salir();
}

// Tras "Borrar progreso": borra también los eventos de la nube (los otros
// equipos limpian los suyos al ver ajustes.progresoDesde).
export async function borrarEventosNube() {
  if (!sesion || !sesion.familia_id) return;
  // Los mensajes se conservan: solo se borra el progreso.
  await api(`/rest/v1/eventos?familia_id=eq.${sesion.familia_id}&data-%3E%3Etipo=neq.mensaje`, { method: 'DELETE' });
  meta.cursor = null;
  escribir(K_META, meta);
}

// ---------------- Mezcla ----------------
const json = v => JSON.stringify(v === undefined ? null : v);
const igual = (a, b) => json(a) === json(b);
const copia = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Valor atómico: si solo cambió un lado, gana ese; si cambiaron ambos, gana este equipo.
function mezclarValor(b, l, r) {
  if (igual(l, r)) return l;
  if (igual(l, b)) return r;
  return l;
}

function mezclarCampos(b = {}, l = {}, r = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(l || {}), ...Object.keys(r || {})])) {
    const v = mezclarValor((b || {})[k], (l || {})[k], (r || {})[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Listas con id: se mezcla elemento por elemento (agregar, editar y borrar en
// equipos distintos se combinan). Mantiene el orden local y agrega al final lo nuevo remoto.
function mezclarLista(b = [], l = [], r = []) {
  const mapa = arr => new Map((arr || []).filter(x => x && x.id).map(x => [x.id, x]));
  const B = mapa(b);
  const R = mapa(r);
  const out = [];
  for (const x of l || []) {
    if (!x || !x.id) continue;
    if (R.has(x.id)) out.push(mezclarValor(B.get(x.id), x, R.get(x.id)));
    else if (!B.has(x.id) || !igual(x, B.get(x.id))) out.push(x); // nuevo aquí, o editado aquí y borrado allá
    // si no: se borró en otro equipo y aquí no se tocó → se borra
  }
  const L = mapa(l);
  for (const [id, x] of R) {
    if (L.has(id)) continue;
    if (!B.has(id) || !igual(x, B.get(id))) out.push(x); // nuevo allá, o editado allá y borrado aquí
  }
  return out;
}

function mezclar3(b, l, r) {
  const out = {};
  for (const k of CLAVES) {
    if (POR_ID.includes(k)) out[k] = mezclarLista(b && b[k], l[k], r[k]);
    else if (POR_CAMPO.includes(k)) out[k] = mezclarCampos(b && b[k], l[k], r[k]);
    else out[k] = mezclarValor(b && b[k], l[k], r[k]);
  }
  return out;
}

const instantanea = () => copia(Object.fromEntries(CLAVES.map(k => [k, S[k]])));

function aplicar(doc) {
  for (const k of CLAVES) {
    if (doc[k] === undefined) continue;
    S[k] = k === 'ajustes' ? { ...S.ajustes, ...doc.ajustes } : copia(doc[k]);
  }
  const desde = S.ajustes.progresoDesde || 0;
  if (desde) S.eventos = S.eventos.filter(e => e.tipo === 'mensaje' || (e.ts || 0) >= desde);
}

const version = e => e.u || e.ts || 0;
const sinMarca = e => { const { _s, ...resto } = e; return resto; };

// ---------------- Sincronizar ----------------
// Cada revisión es liviana: pregunta solo lo nuevo (eventos desde el cursor y la
// fecha de la configuración) y descarga la configuración completa solo si cambió.
export function sincronizar() {
  if (!configurada() || !sesion) return Promise.resolve(false);
  if (enCurso) { otraVez = true; return enCurso; }
  enCurso = (async () => {
    avisar();
    const nuevos = [];
    let cambio = false;
    let tocado = false;
    try {
      if (!sesion.familia_id) await prepararFamilia();
      const fid = sesion.familia_id;

      // 1) Subir eventos nuevos o modificados en este equipo.
      const sucios = S.eventos.filter(e => e._s !== version(e));
      for (let i = 0; i < sucios.length; i += 500) {
        const lote = sucios.slice(i, i + 500);
        await api('/rest/v1/eventos', {
          method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
          body: lote.map(e => ({ familia_id: fid, id: String(e.id), data: sinMarca(e) })),
        });
        for (const e of lote) e._s = version(e);
        tocado = true;
      }

      // 2) Bajar eventos de otros equipos (2 min de margen; los repetidos se ignoran).
      const indice = new Map(S.eventos.map((e, i) => [e.id, i]));
      const desdeMs = meta.cursor ? Date.parse(String(meta.cursor).replace(/(\.\d{3})\d+/, '$1')) - 120000 : 0;
      const desde = new Date(Math.max(0, desdeMs || 0)).toISOString();
      const progresoDesde = S.ajustes.progresoDesde || 0;
      for (let offset = 0; ; offset += 1000) {
        const filas = await api(`/rest/v1/eventos?familia_id=eq.${fid}&recibido=gt.${encodeURIComponent(desde)}`
          + `&select=id,data,recibido&order=recibido.asc,id.asc&limit=1000&offset=${offset}`);
        for (const f of filas) {
          meta.cursor = f.recibido;
          const r = f.data;
          if (!r || typeof r !== 'object' || !r.id) continue;
          if (r.tipo !== 'mensaje' && (r.ts || 0) < progresoDesde) continue;
          const i = indice.get(r.id);
          if (i === undefined) {
            indice.set(r.id, S.eventos.push({ ...r, _s: version(r) }) - 1);
            nuevos.push(r);
            cambio = true;
          } else if (version(r) > version(S.eventos[i])) {
            S.eventos[i] = { ...r, _s: version(r) };
            cambio = true;
          } else if (version(r) === version(S.eventos[i]) && S.eventos[i]._s !== version(r)) {
            S.eventos[i]._s = version(r);
            tocado = true;
          }
        }
        if (filas.length < 1000) break;
      }

      // 3) Configuración: primero solo la fecha; el documento, si cambió.
      const cab = await api(`/rest/v1/estado?familia_id=eq.${fid}&select=actualizado`);
      const remotoAct = cab[0] ? cab[0].actualizado : null;
      const local = instantanea();
      let remoto = null;
      if (remotoAct && meta.base && remotoAct === meta.estadoAct) remoto = meta.base; // la nube no cambió
      else if (remotoAct) remoto = (await api(`/rest/v1/estado?familia_id=eq.${fid}&select=doc`))[0].doc;

      let final;
      if (!remoto) final = local; // primera vez de la familia: sube lo de este equipo
      else if (!meta.base) final = copia(remoto); // equipo nuevo: manda la nube
      else final = mezclar3(meta.base, local, remoto);

      if (!igual(final, local)) {
        aplicar(final);
        cambio = true;
      }
      if (!remoto || !igual(final, remoto)) {
        const r = await api('/rest/v1/estado?select=actualizado', {
          method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
          body: { familia_id: fid, doc: final },
        });
        meta.estadoAct = r && r[0] ? r[0].actualizado : null;
      } else {
        meta.estadoAct = remotoAct;
      }
      meta.base = final;
      meta.ultima = Date.now();
      meta.error = null;
    } catch (e) {
      meta.error = e.message || 'Error al sincronizar';
    } finally {
      escribir(K_META, meta);
      if (cambio || tocado) guardar({ silencioso: true });
      enCurso = null;
      avisar();
    }
    if (cambio) alCambiosRemotos(nuevos);
    if (otraVez) { otraVez = false; programar(300); }
    return cambio;
  })();
  return enCurso;
}

export function programar(ms = 1000) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { sincronizar(); }, ms);
}

// Arranca la sincronización automática: al abrir, al volver a la app, cada
// 10 segundos con la app visible y 1 segundo después de cada cambio.
const CADA_MS = 10000;
export function iniciar(onCambiosRemotos) {
  alCambiosRemotos = onCambiosRemotos || (() => {});
  if (!configurada()) return;
  alGuardar(() => { if (sesion) programar(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  window.addEventListener('online', () => sincronizar());
  setInterval(() => { if (!document.hidden) sincronizar(); }, CADA_MS);
  sincronizar();
}
