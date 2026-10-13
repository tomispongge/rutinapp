// Cálculos puros sobre el estado: no modifican nada y no tocan el DOM.
import { addDays, daysBetween, fromMin, toMin, weekday, weekStart, mediana } from './util.js';

export const nino = (S, id) => S.ninos.find(k => k.id === id);
export const esFinde = dia => [0, 6].includes(weekday(dia));
// Noches antes de un día sin colegio (viernes y sábado).
export const nocheLibre = dia => [5, 6].includes(weekday(dia));

const vivos = (S, ninoId, tipo, dia) => S.eventos.filter(e =>
  !e.anulado && e.ninoId === ninoId && (!tipo || e.tipo === tipo) && (!dia || e.dia === dia));

// ---------------- Sueño ----------------
// Plan gradual: adelanta la hora de dormir `pasoMin` minutos cada `cadaDias`
// días, desde la hora actual hasta la meta. El primer adelanto parte el día 1.
export function lucesApagadas(S, k, dia) {
  const p = k.sueno;
  if (!p || !p.actual || !p.meta) return null;
  const actual = toMin(p.actual);
  const total = Math.max(0, actual - toMin(p.meta));
  const n = Math.max(0, daysBetween(p.inicio || dia, dia));
  const adelanto = Math.min(total, (Math.floor(n / Math.max(1, p.cadaDias)) + 1) * (p.pasoMin || 15));
  let m = actual - adelanto;
  if (nocheLibre(dia)) m += S.ajustes.findeExtraMin || 0;
  return fromMin(m);
}

export function fechaMetaSueno(k) {
  const p = k.sueno;
  if (!p) return null;
  const total = Math.max(0, toMin(p.actual) - toMin(p.meta));
  const saltos = Math.ceil(total / (p.pasoMin || 15));
  return addDays(p.inicio, Math.max(0, saltos - 1) * Math.max(1, p.cadaDias));
}

// Minutos de sueño estimados en una noche de colegio.
export function suenoEstimado(S, k, dia) {
  const luces = lucesApagadas(S, k, dia);
  if (!luces) return null;
  return 1440 - toMin(luces) + toMin(S.ajustes.despertar || '06:30');
}

// ---------------- Rutinas ----------------
export const duracion = r => r.pasos.reduce((a, p) => a + (Number(p.min) || 0), 0);

export function horaRutina(S, r, k, dia) {
  if (r.tipo === 'noche') {
    const luces = lucesApagadas(S, k, dia);
    // Redondeado a 5 minutos hacia antes: "21:00" se entiende mejor que "21:01".
    return luces ? fromMin(Math.floor((toMin(luces) - duracion(r)) / 5) * 5) : '20:00';
  }
  const porDia = r.horaPorDia || {};
  return porDia[weekday(dia)] || r.hora || '';
}

// Incluye las rutinas agregadas solo para ese día (evento 'extra'), p. ej. un
// estudio de plan B cuando se suspende un taller.
export function rutinasDelDia(S, k, dia) {
  const wd = weekday(dia);
  const lista = S.rutinas
    .filter(r => r.ninos.includes(k.id) && r.dias.includes(wd))
    .map(r => ({ r, hora: horaRutina(S, r, k, dia) }));
  for (const e of vivos(S, k.id, 'extra', dia)) {
    const r = S.rutinas.find(x => x.id === e.rutinaId);
    if (r && r.ninos.includes(k.id) && !lista.some(x => x.r.id === r.id)) lista.push({ r, hora: e.hora || '', extra: e.id });
  }
  return lista.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
}

// Si hoy no hay estudio programado, ofrece agregarlo. Es "urgente" si hay
// prueba en los próximos 3 días o si se suspendió un taller.
export function estudioSugerido(S, k, dia) {
  if (rutinasDelDia(S, k, dia).some(({ r }) => r.tipo === 'estudio')) return null;
  const rutina = S.rutinas.find(r => r.tipo === 'estudio' && r.ninos.includes(k.id));
  if (!rutina) return null;
  const prueba = pruebasProximas(S, k.id, dia, 3)[0];
  const suspendida = actividadesDelDia(S, k, dia).find(a => estadoActividad(S, k.id, a.id, dia) === 'suspendida');
  const motivo = prueba ? `Tienes prueba de ${prueba.materia} ${cuandoEs(dia, prueba.fecha)}. ¿Repasamos hoy?`
    : suspendida ? `Se suspendió ${suspendida.nombre}: hoy hay tiempo para estudiar.`
      : 'Hoy no te toca estudio. Si tienes tiempo, puedes agregarlo.';
  return { rutina, motivo, urgente: !!(prueba || suspendida) };
}

export function actividadesDelDia(S, k, dia) {
  const wd = weekday(dia);
  return S.actividades.filter(a => a.ninoId === k.id && Number(a.dia) === wd)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

export function estadoActividad(S, ninoId, actividadId, dia) {
  const evs = vivos(S, ninoId, 'actividad', dia).filter(e => e.actividadId === actividadId);
  return evs.length ? evs[evs.length - 1].estado : null;
}

export function pasosHechos(S, ninoId, rutinaId, dia) {
  return new Set(vivos(S, ninoId, 'paso', dia).filter(e => e.rutinaId === rutinaId).map(e => e.pasoId));
}
export const pasoHecho = (S, ninoId, rutinaId, pasoId, dia) => pasosHechos(S, ninoId, rutinaId, dia).has(pasoId);
export const eventoRutina = (S, ninoId, rutinaId, dia) =>
  vivos(S, ninoId, 'rutina', dia).find(e => e.rutinaId === rutinaId);

export function progresoRutina(S, ninoId, r, dia) {
  const hechos = pasosHechos(S, ninoId, r.id, dia);
  const n = r.pasos.filter(p => hechos.has(p.id)).length;
  return { n, total: r.pasos.length, completa: r.pasos.length > 0 && n === r.pasos.length };
}

export function progresoDia(S, k, dia) {
  let n = 0;
  let total = 0;
  for (const { r } of rutinasDelDia(S, k, dia)) {
    const p = progresoRutina(S, k.id, r, dia);
    n += p.n;
    total += p.total;
  }
  return { n, total, pct: total ? n / total : null };
}

// Primer paso de hoy que dispara una acción (p. ej. 'applicatzo').
export function pasoConAccion(S, ninoId, dia, accion) {
  const k = nino(S, ninoId);
  if (!k) return null;
  for (const { r } of rutinasDelDia(S, k, dia)) {
    const p = r.pasos.find(x => x.accion === accion);
    if (p) return { rutina: r, paso: p };
  }
  return null;
}

// ---------------- Estudio ----------------
export function pruebasProximas(S, ninoId, dia, horizonte = 30) {
  return S.pruebas
    .filter(p => p.ninoId === ninoId && p.fecha >= dia && daysBetween(dia, p.fecha) <= horizonte)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function cuandoEs(dia, fecha) {
  const n = daysBetween(dia, fecha);
  return n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`;
}

// Si hay prueba en los próximos 3 días, esa materia va primero; si no, la rotación semanal.
export function materiaSugerida(S, k, dia) {
  const urgente = pruebasProximas(S, k.id, dia, 3)[0];
  if (urgente) {
    return { texto: `${urgente.materia} (prueba ${cuandoEs(dia, urgente.fecha)})`, materia: urgente.materia, prueba: true };
  }
  const rot = (S.ajustes.rotacion || {})[k.curso] || {};
  const m = rot[weekday(dia)];
  return { texto: m || 'Repaso libre', materia: m || null, prueba: false };
}

export function textoPaso(S, k, p, dia) {
  let t = p.texto || '';
  if (t.includes('{materia}')) t = t.replace('{materia}', materiaSugerida(S, k, dia).texto);
  if (p.accion === 'lector') {
    const libro = libroActivo(S, k.id);
    if (libro) {
      const plan = planLector(S, libro, dia);
      if (!plan.terminado) t += ` · hasta la pág. ${plan.metaHoy}`;
    }
  }
  return t;
}

// ---------------- Plan lector ----------------
export const libroActivo = (S, ninoId) => S.libros.find(b => b.ninoId === ninoId && b.activo !== false);

export function paginaActual(S, libro, antesDe = null) {
  const pags = S.eventos
    .filter(e => !e.anulado && e.tipo === 'lectura' && e.libroId === libro.id && (!antesDe || e.dia < antesDe))
    .map(e => e.pagina);
  return pags.length ? Math.max(...pags) : (Number(libro.paginaInicial) || 0);
}

// La meta del día se calcula con la página en que amaneció, para que no se mueva
// mientras lee. Se apunta a terminar el día antes del control.
export function planLector(S, libro, dia) {
  const total = Number(libro.paginas) || 0;
  const inicioHoy = paginaActual(S, libro, dia);
  const ahora = paginaActual(S, libro);
  const dias = daysBetween(dia, libro.fechaControl);
  const restantesInicio = Math.max(0, total - inicioHoy);
  const porDia = dias > 0 ? Math.ceil(restantesInicio / dias) : restantesInicio;
  const metaHoy = Math.min(total, inicioHoy + porDia);
  const minPorPagina = Number(S.ajustes.minPorPagina) || 2.5;
  return {
    total, inicioHoy, ahora, dias, porDia, metaHoy,
    restantes: Math.max(0, total - ahora),
    minutosDia: Math.round(porDia * minPorPagina),
    cumpleHoy: ahora >= metaHoy,
    terminado: total > 0 && ahora >= total,
    pct: total ? Math.min(1, ahora / total) : 0,
  };
}

// ---------------- Pantalla ----------------
export function transcurridoMs(t, now = Date.now()) {
  if (!t) return 0;
  return (t.acumMs || 0) + (t.inicio ? now - t.inicio : 0);
}

export function minutosPantalla(S, ninoId, dia) {
  return vivos(S, ninoId, 'pantalla', dia).reduce((a, e) => a + (e.minutos || 0), 0);
}

export function minutosEstudio(S, ninoId, dia) {
  return vivos(S, ninoId, 'cronometro', dia).reduce((a, e) => a + (e.minutos || 0), 0);
}

export function excesoDia(S, ninoId, dia) {
  return vivos(S, ninoId, 'pantalla', dia).reduce((a, e) => a + (e.exceso || 0), 0);
}

export function presupuestoPantalla(S, k, dia) {
  const base = Number(esFinde(dia) ? k.pantallaFinde : k.pantallaHabil) || 0;
  const desc = S.ajustes.descontarExceso ? Math.min(base, excesoDia(S, k.id, addDays(dia, -1))) : 0;
  return { base, desc, total: Math.max(0, base - desc) };
}

// "Primero estudio, después pantalla": la pantalla se abre cuando el estudio de hoy está completo.
export function estudioPendiente(S, k, dia) {
  if ((S.desbloqueos || {})[k.id] === dia) return null;
  const est = rutinasDelDia(S, k, dia).find(({ r }) => r.tipo === 'estudio');
  if (!est) return null;
  const p = progresoRutina(S, k.id, est.r, dia);
  return p.completa ? null : { rutina: est.r, ...p };
}

// ---------------- Estrellas, meta semanal y logros ----------------
export function estrellas(S, ninoId) {
  return S.eventos.reduce((a, e) => a + (!e.anulado && e.ninoId === ninoId ? (e.estrellas || 0) : 0), 0);
}

export function canjesPendientes(S, ninoId) {
  return S.eventos.filter(e => !e.anulado && e.tipo === 'canje' && e.estado === 'pendiente' && (!ninoId || e.ninoId === ninoId));
}

export function disponibles(S, ninoId) {
  return estrellas(S, ninoId) - canjesPendientes(S, ninoId).reduce((a, e) => a + e.costo, 0);
}

export function semana(S, k, dia) {
  const ini = weekStart(dia);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ini, i);
    // Días antes de instalar la app o futuros: sin datos, se muestran como "—".
    return {
      dia: d, futuro: d > dia || d < S.creado, ...progresoDia(S, k, d),
      pantalla: minutosPantalla(S, k.id, d), estudio: minutosEstudio(S, k.id, d),
    };
  });
}

// La meta es de días buenos en la semana (≥80 %), no una racha perfecta:
// un mal día no borra el esfuerzo.
export function metaSemanal(S, k, dia) {
  const sem = semana(S, k, dia);
  const cumplidos = sem.filter(x => !x.futuro && x.pct != null && x.pct >= 0.8).length;
  return { cumplidos, meta: S.ajustes.metaSemanal || 5, sem };
}

function semanasCumplidas(S, k, dia) {
  let n = 0;
  let ini = weekStart(dia);
  for (let i = 0; i < 26 && ini >= weekStart(S.creado); i++) {
    const fin = addDays(ini, 6);
    const m = metaSemanal(S, k, fin < dia ? fin : dia);
    if (m.cumplidos >= m.meta) n++;
    ini = addDays(ini, -7);
  }
  return n;
}

export function resumenApplicatzo(S, ninoId) {
  const por = {};
  for (const e of vivos(S, ninoId, 'applicatzo')) {
    const m = (por[e.modulo] = por[e.modulo] || { modulo: e.modulo, sesiones: [] });
    m.sesiones.push(e);
  }
  return Object.values(por).map(m => {
    const conNota = m.sesiones.filter(e => e.total > 0);
    const pcts = conNota.map(e => e.correctas / e.total);
    const ult = m.sesiones[m.sesiones.length - 1];
    const ult3 = pcts.slice(-3);
    return {
      modulo: m.modulo,
      n: m.sesiones.length,
      ultimaDia: ult.dia,
      ultima: ult.total > 0 ? `${ult.correctas}/${ult.total}` : '✓',
      prom3: ult3.length ? ult3.reduce((a, b) => a + b, 0) / ult3.length : null,
      dominio: pcts.filter(p => p >= 0.9).length >= 3,
    };
  }).sort((a, b) => b.ultimaDia.localeCompare(a.ultimaDia));
}

export function logros(S, k, dia) {
  const ev = S.eventos.filter(e => !e.anulado && e.ninoId === k.id);
  const tipoRutina = id => (S.rutinas.find(r => r.id === id) || {}).tipo;
  const completas = ev.filter(e => e.tipo === 'rutina');
  const mananas = completas.filter(e => tipoRutina(e.rutinaId) === 'manana').length;
  const noches = completas.filter(e => tipoRutina(e.rutinaId) === 'noche').length;
  const aTiempo = ev.filter(e => e.tipo === 'pantalla' && e.aTiempo).length;
  const guias = ev.filter(e => e.tipo === 'applicatzo').length;
  const lecturas = new Set(ev.filter(e => e.tipo === 'lectura' && e.meta).map(e => e.dia)).size;
  const semanas = semanasCumplidas(S, k, dia);

  const lista = [
    { emoji: '🌱', nombre: 'Primer paso', desc: 'Completa tu primera rutina', n: completas.length, meta: 1 },
    { emoji: '🌅', nombre: 'Mañanas en orden', desc: '5 rutinas de mañana completas', n: mananas, meta: 5 },
    { emoji: '🌙', nombre: 'Buenas noches', desc: '7 rutinas de noche completas', n: noches, meta: 7 },
    { emoji: '⏰', nombre: 'Apagado a tiempo', desc: 'Apaga la pantalla a tiempo 5 veces', n: aTiempo, meta: 5 },
    { emoji: '🧠', nombre: 'Practicante', desc: 'Termina 10 guías de Applicatzo', n: guias, meta: 10 },
    { emoji: '🏆', nombre: 'Semana cumplida', desc: 'Cumple la meta de una semana', n: semanas, meta: 1 },
    { emoji: '👑', nombre: 'Un mes constante', desc: 'Cumple 4 semanas', n: semanas, meta: 4 },
  ];
  if (S.libros.some(b => b.ninoId === k.id)) {
    lista.push({ emoji: '📚', nombre: 'Lectura al día', desc: '7 días cumpliendo tu meta de lectura', n: lecturas, meta: 7 });
  }
  for (const m of resumenApplicatzo(S, k.id).filter(x => x.dominio)) {
    lista.push({ emoji: '🎓', nombre: `Dominio: ${m.modulo}`, desc: '3 guías con 90 % o más', n: 1, meta: 1 });
  }
  return lista.map(l => ({ ...l, ok: l.n >= l.meta }));
}

// ---------------- Sugerencias para el adulto ----------------
export function sugerencias(S, k, dia) {
  const out = [];
  const desde = addDays(dia, -14);
  const misRutinas = S.rutinas.filter(r => r.ninos.includes(k.id));

  // Tiempos reales vs. planificados (solo pasos hechos en modo "paso a paso").
  const durs = {};
  for (const e of S.eventos) {
    if (e.anulado || e.ninoId !== k.id || e.tipo !== 'paso' || !e.durSeg || e.dia < desde) continue;
    (durs[`${e.rutinaId}:${e.pasoId}`] = durs[`${e.rutinaId}:${e.pasoId}`] || []).push(e.durSeg / 60);
  }
  for (const r of misRutinas) {
    for (const p of r.pasos) {
      const arr = durs[`${r.id}:${p.id}`];
      if (!arr || arr.length < 3 || !p.min) continue;
      const med = mediana(arr);
      if (med > p.min * 1.5 && med - p.min >= 2) {
        out.push(`⏱️ «${p.texto}» (${r.nombre}) toma ${Math.round(med)} min y tenía ${p.min}. ¿Le das más tiempo o lo divides en dos pasos?`);
      } else if (p.min >= 5 && med < p.min * 0.5) {
        out.push(`⏱️ «${p.texto}» (${r.nombre}) toma solo ${Math.round(med)} min de ${p.min} planificados. Puedes acortarlo.`);
      }
    }
  }

  // Pasos que casi nunca se completan / hábitos listos para "graduarse".
  for (const r of misRutinas) {
    const diasProg = [];
    for (let i = 1; i <= 21; i++) {
      const d = addDays(dia, -i);
      if (d < S.creado) break;
      if (r.dias.includes(weekday(d))) diasProg.push(d);
    }
    if (diasProg.length < 5) continue;
    for (const p of r.pasos) {
      const hechos = diasProg.filter(d => pasoHecho(S, k.id, r.id, p.id, d)).length;
      const tasa = hechos / diasProg.length;
      if (diasProg.length >= 5 && tasa < 0.5) {
        out.push(`🧩 «${p.texto}» (${r.nombre}) se hizo ${hechos} de ${diasProg.length} días. ¿Es muy difícil, está a mala hora o conviene conversarlo en la reunión familiar?`);
      } else if (diasProg.length >= 10 && tasa >= 0.9) {
        out.push(`🎓 «${p.texto}» se cumplió el ${Math.round(tasa * 100)} % de los días: parece hábito. Puedes "graduarlo" (sacarlo de la lista) y elegir una meta nueva.`);
      }
    }
  }

  // Pantalla.
  const sem = semana(S, k, dia).filter(d => !d.futuro);
  const excesos = sem.filter(d => excesoDia(S, k.id, d.dia) > 0).length;
  if (excesos >= 3) out.push(`🎮 Esta semana se pasó del tiempo de pantalla ${excesos} días. Revisen juntos qué hace difícil apagar (¿aviso?, ¿qué viene después?).`);

  // Lectura.
  const libro = libroActivo(S, k.id);
  if (libro) {
    const plan = planLector(S, libro, dia);
    if (!plan.terminado && plan.dias > 0 && plan.minutosDia > 30) {
      out.push(`📖 Para llegar al control de «${libro.titulo}» necesita ~${plan.porDia} págs/día (≈${plan.minutosDia} min). Considera sumar lectura el fin de semana o conversar con el colegio.`);
    }
  }

  // Sueño.
  const sueno = suenoEstimado(S, k, dia);
  if (sueno != null && sueno < 540) {
    out.push(`😴 Hoy dormiría ≈${Math.floor(sueno / 60)} h ${sueno % 60} min. Entre los 6 y 12 años se recomiendan 9 a 12 h: el plan gradual lo irá corrigiendo.`);
  }
  return out;
}
