// Vistas de los niños: elegir perfil, "Mi día", rutinas, pantalla, lectura, pruebas, premios y juego.
import { S } from './store.js';
import * as A from './acciones.js';
import * as L from './logic.js';
import { MATERIAS } from './seed.js';
import { h, dayKey, nowMin, toMin, fromMin, fechaLarga, fechaCorta, speak, chime, DIAS_CORTOS, weekday, addDays } from './util.js';
import { ir, rerender, intervalo, toast, modal, celebrar, pinPad, disco, barra } from './ui.js';

const volver = (k, texto = '← Mi día') =>
  h('button', { class: 'btn ghost volver', onclick: () => ir(`#/n/${k.id}`) }, texto);

function cabeceraNino(k, titulo) {
  return h('header', { class: 'cab', style: { '--kc': k.color } },
    h('span', { class: 'cab-avatar' }, k.avatar),
    h('div', { class: 'cab-texto' }, h('h1', {}, titulo), h('p', { class: 'muted' }, fechaLarga(dayKey()))),
    h('button', { class: 'pildora estrellas', onclick: () => ir(`#/n/${k.id}/premios`) }, `⭐ ${L.estrellas(S, k.id)}`));
}

export function bannerSiesta(k) {
  const hasta = S.ajustes.siestaHasta;
  if (!hasta || hasta < Date.now()) return null;
  const hora = fromMin(nowMin(new Date(hasta)));
  const plan = k
    ? `Plan: ${L.estudioPendiente(S, k, dayKey()) ? '1) Estudio · 2) Pantalla · 3) Menú de juego' : '1) Pantalla · 2) Menú de juego'}`
    : 'Jueguen tranquilos y sigan su plan.';
  return h('div', { class: 'aviso siesta' }, h('strong', {}, `🤫 Siesta en casa hasta las ${hora}`), h('span', {}, plan));
}

// ---------------- Inicio: ¿quién eres? ----------------
export function vistaInicio() {
  return h('div', { class: 'inicio' },
    h('div', { class: 'inicio-top' },
      h('h1', { class: 'logo' }, '☀️ Rutinapp'),
      h('button', { class: 'btn ghost', onclick: () => ir('#/adulto') }, '👤 Adultos')),
    bannerSiesta(null),
    h('p', { class: 'muted centro grande' }, '¿Quién eres?'),
    h('div', { class: 'perfiles' }, S.ninos.map(k =>
      h('button', { class: 'perfil', style: { '--kc': k.color }, onclick: () => ir(`#/n/${k.id}`) },
        h('span', { class: 'perfil-avatar' }, k.avatar),
        h('span', { class: 'perfil-nombre' }, k.apodo),
        h('span', { class: 'perfil-estrellas' }, `⭐ ${L.estrellas(S, k.id)}`)))));
}

// ---------------- Mi día ----------------
function itemsDelDia(k, dia) {
  const items = [];
  let finEstudio = null;
  let finLlegada = null;
  for (const { r, hora } of L.rutinasDelDia(S, k, dia)) {
    const p = L.progresoRutina(S, k.id, r, dia);
    const fin = hora ? fromMin(toMin(hora) + L.duracion(r)) : null;
    if (r.tipo === 'estudio') finEstudio = fin;
    if (r.tipo === 'llegada') finLlegada = fin;
    items.push({
      hora, fin, emoji: r.emoji, titulo: r.nombre, hecho: p.completa, prog: p.total ? p.n / p.total : 0,
      sub: r.tipo === 'noche' ? `${p.n}/${p.total} · luces ${L.lucesApagadas(S, k, dia)}` : `${p.n}/${p.total} pasos`,
      abrir: () => ir(`#/n/${k.id}/r/${r.id}`),
    });
  }
  for (const a of L.actividadesDelDia(S, k, dia)) {
    const est = L.estadoActividad(S, k.id, a.id, dia);
    items.push({
      hora: a.desde, fin: a.hasta, emoji: a.emoji, titulo: a.nombre, hecho: !!est,
      sub: `${a.desde}–${a.hasta}${est === 'fui' ? ' · ✓ fui' : est === 'suspendida' ? ' · se suspendió' : ''}`,
      abrir: () => modalActividad(k, a),
    });
  }
  const pres = L.presupuestoPantalla(S, k, dia);
  const usado = L.minutosPantalla(S, k.id, dia) + L.transcurridoMs(S.timers[k.id]) / 60000;
  items.push({
    // Después del estudio; si ese día no hay estudio (p. ej. días de taller), después de llegar.
    hora: finEstudio || finLlegada || '15:30', fin: null, emoji: '🎮', titulo: 'Pantalla', hecho: false, pantalla: true,
    sub: `${Math.round(usado)} de ${pres.total} min`,
    abrir: () => ir(`#/n/${k.id}/pantalla`),
  });
  return items.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
}

function itemAhora(items) {
  const ahora = nowMin();
  const pend = items.filter(i => !i.hecho && !i.pantalla && i.hora);
  const enCurso = pend.filter(i => toMin(i.hora) <= ahora && (!i.fin || ahora <= toMin(i.fin) + 60));
  if (enCurso.length) return { item: enCurso[enCurso.length - 1], cuando: 'Ahora' };
  const prox = pend.find(i => toMin(i.hora) > ahora);
  if (prox) return { item: prox, cuando: `A las ${prox.hora}` };
  const atrasado = pend[pend.length - 1];
  if (atrasado) return { item: atrasado, cuando: 'Pendiente' };
  return null;
}

export function vistaDia(k) {
  const dia = dayKey();
  const items = itemsDelDia(k, dia);
  const ahora = itemAhora(items);
  const meta = L.metaSemanal(S, k, dia);
  const libro = L.libroActivo(S, k.id);
  const pruebas = L.pruebasProximas(S, k.id, dia, 14);
  const pres = L.presupuestoPantalla(S, k, dia);
  const usado = L.minutosPantalla(S, k.id, dia) + L.transcurridoMs(S.timers[k.id]) / 60000;

  intervalo(() => rerender(), 60000);

  return h('div', { class: 'dia' },
    h('div', { class: 'fila-top' },
      h('button', { class: 'btn ghost', onclick: () => ir('#/') }, '← Cambiar'),
      h('button', { class: 'pildora', onclick: () => ir(`#/n/${k.id}/premios`), title: 'Meta de la semana' },
        `🏆 ${meta.cumplidos}/${meta.meta} días`)),
    cabeceraNino(k, `Hola, ${k.apodo}`),
    bannerSiesta(k),
    h('div', { class: 'semana-puntos', 'aria-label': 'Días buenos de la semana' },
      meta.sem.map(d => h('span', {
        class: `sp ${d.futuro ? 'futuro' : d.pct == null ? 'vacio' : d.pct >= 0.8 ? 'ok' : d.pct > 0 ? 'medio' : 'nada'} ${d.dia === dia ? 'hoy' : ''}`,
      }, DIAS_CORTOS[weekday(d.dia)]))),
    ahora
      ? h('button', { class: 'ahora', style: { '--kc': k.color }, onclick: ahora.item.abrir },
        h('span', { class: 'ahora-cuando' }, ahora.cuando),
        h('span', { class: 'ahora-emoji' }, ahora.item.emoji),
        h('span', { class: 'ahora-titulo' }, ahora.item.titulo),
        h('span', { class: 'ahora-sub' }, ahora.item.sub),
        h('span', { class: 'btn big', style: { background: k.color } }, '▶ Vamos'))
      : h('div', { class: 'ahora listo' }, h('span', { class: 'ahora-emoji' }, '🎉'), h('span', { class: 'ahora-titulo' }, '¡Todo listo por hoy!')),
    h('h2', { class: 'seccion' }, 'Mi día'),
    h('div', { class: 'linea' }, items.map(i =>
      h('button', { class: `item ${i.hecho ? 'hecho' : ''}`, onclick: i.abrir },
        h('span', { class: 'item-hora' }, i.hora || ''),
        h('span', { class: 'item-emoji' }, i.emoji),
        h('span', { class: 'item-texto' }, h('strong', {}, i.titulo), h('small', {}, i.sub),
          i.prog != null && !i.pantalla ? barra(i.prog, k.color) : null),
        h('span', { class: 'item-check' }, i.hecho ? '✅' : '›')))),
    h('div', { class: 'tiles' },
      tile('🎮', 'Pantalla', `Te quedan ${Math.max(0, Math.round(pres.total - usado))} min`, () => ir(`#/n/${k.id}/pantalla`)),
      libro ? tile('📖', 'Plan lector', planCorto(libro, dia), () => ir(`#/n/${k.id}/lector`)) : null,
      tile('📅', 'Pruebas', pruebas.length ? `${pruebas.length} próxima${pruebas.length > 1 ? 's' : ''}` : 'Anotar', () => ir(`#/n/${k.id}/pruebas`)),
      tile('⭐', 'Premios y logros', `${L.disponibles(S, k.id)} ⭐ para canjear`, () => ir(`#/n/${k.id}/premios`)),
      tile('🧩', 'Menú de juego', 'Ideas sin pantalla', () => ir(`#/n/${k.id}/juego`))));
}

function planCorto(libro, dia) {
  const p = L.planLector(S, libro, dia);
  if (p.terminado) return '¡Terminado!';
  return p.cumpleHoy ? '✅ Meta de hoy lista' : `Meta: pág. ${p.metaHoy}`;
}

const tile = (emoji, titulo, sub, onclick) =>
  h('button', { class: 'tile', onclick }, h('span', { class: 'tile-emoji' }, emoji), h('strong', {}, titulo), h('small', {}, sub));

function modalActividad(k, a) {
  modal({
    titulo: `${a.emoji} ${a.nombre}`,
    cuerpo: h('p', {}, `Hoy de ${a.desde} a ${a.hasta}. ¿Cómo te fue?`),
    acciones: [
      { texto: '✅ Fui', clase: 'ok', onClick: () => { A.marcarActividad(k.id, a.id, 'fui'); rerender(); } },
      { texto: '🌧️ Se suspendió', clase: 'sec', onClick: () => { A.marcarActividad(k.id, a.id, 'suspendida'); toast(S.ajustes.planB); rerender(); } },
      { texto: 'Cerrar', clase: 'ghost' },
    ],
  });
}

// ---------------- Rutina (lista) ----------------
function botonAccion(k, p) {
  const abrir = {
    applicatzo: ['📱 Abrir Applicatzo', () => abrirApplicatzo(k)],
    materia: k.curso === 5 || k.curso === 1 ? ['📱 Guías en Applicatzo', () => abrirApplicatzo(k)] : null,
    copia: ['✏️ Abrir Copia', () => abrirApplicatzo(k, 'copia')],
    pruebas: ['📅 Anotar prueba', () => ir(`#/n/${k.id}/pruebas`)],
    lector: L.libroActivo(S, k.id) ? ['📖 Anotar página', () => ir(`#/n/${k.id}/lector`)] : null,
  }[p.accion];
  if (!abrir) return null;
  return h('button', { class: 'btn sec chico', onclick: e => { e.stopPropagation(); abrir[1](); } }, abrir[0]);
}

export function abrirApplicatzo(k, ir_ = '') {
  const q = new URLSearchParams({ nino: k.id, curso: String(k.curso) });
  if (ir_) q.set('ir', ir_);
  location.href = `applicatzo/index.html?${q}`;
}

export function vistaRutina(k, r) {
  const dia = dayKey();
  const hechos = L.pasosHechos(S, k.id, r.id, dia);
  const prog = L.progresoRutina(S, k.id, r, dia);
  const hora = L.horaRutina(S, r, k, dia);

  return h('div', { class: 'rutina' },
    volver(k),
    h('header', { class: 'rutina-cab', style: { '--kc': k.color } },
      h('span', { class: 'rutina-emoji' }, r.emoji),
      h('div', {},
        h('h1', {}, r.nombre),
        h('p', { class: 'muted' }, [hora ? `Empieza ${hora}` : '', `${L.duracion(r)} min`, r.tipo === 'noche' ? `Luces apagadas ${L.lucesApagadas(S, k, dia)}` : ''].filter(Boolean).join(' · ')))),
    barra(prog.total ? prog.n / prog.total : 0, k.color),
    prog.completa
      ? h('div', { class: 'aviso ok' }, '🎉 ¡Rutina completa! Ganaste 2 ⭐ extra.')
      : h('button', { class: 'btn big ancho', style: { background: k.color }, onclick: () => ir(`#/n/${k.id}/r/${r.id}/paso`) }, '▶ Paso a paso'),
    h('ol', { class: 'pasos' }, r.pasos.map(p => {
      const hecho = hechos.has(p.id);
      const texto = L.textoPaso(S, k, p, dia);
      return h('li', {},
        h('button', {
          class: `paso ${hecho ? 'hecho' : ''}`,
          'aria-pressed': hecho ? 'true' : 'false',
          onclick: () => {
            if (hecho) { A.desmarcarPaso(k.id, r.id, p.id); rerender(); return; }
            const res = A.marcarPaso(k.id, r.id, p.id);
            if (res.nuevo) celebrar(res.estrellas, res.completa ? '¡Rutina completa! +3 ⭐' : '+1 ⭐');
            rerender();
          },
        },
        h('span', { class: 'paso-check' }, hecho ? '✓' : ''),
        h('span', { class: 'paso-emoji' }, p.emoji),
        h('span', { class: 'paso-texto' }, texto, p.min ? h('small', {}, ` · ${p.min} min`) : null)),
        h('div', { class: 'paso-extra' },
          botonAccion(k, p),
          h('button', { class: 'btn ghost chico', 'aria-label': 'Escuchar', onclick: () => speak(texto) }, '🔊')));
    })));
}

// ---------------- Rutina paso a paso ----------------
const saltados = new Map();

export function vistaPasoAPaso(k, r) {
  const dia = dayKey();
  const hechos = L.pasosHechos(S, k.id, r.id, dia);
  const skip = saltados.get(r.id) || new Set();
  const pendientes = r.pasos.filter(p => !hechos.has(p.id));
  const p = pendientes.find(x => !skip.has(x.id)) || pendientes[0];

  if (!p) {
    return h('div', { class: 'paso-a-paso fin' },
      h('div', { class: 'gigante' }, '🎉'),
      h('h1', {}, '¡Rutina completa!'),
      h('p', { class: 'grande' }, `${r.emoji} ${r.nombre}`),
      h('button', { class: 'btn big', style: { background: k.color }, onclick: () => ir(`#/n/${k.id}`) }, 'Volver a mi día'));
  }

  const idx = r.pasos.indexOf(p);
  const texto = L.textoPaso(S, k, p, dia);
  const inicio = Date.now();
  const totalSeg = (Number(p.min) || 0) * 60;
  const timer = disco(k.color);
  let sono = false;
  const tick = () => {
    const rest = totalSeg - (Date.now() - inicio) / 1000;
    if (totalSeg > 0) timer.set(rest, totalSeg, rest <= 0 ? '¿Listo?' : '');
    if (totalSeg > 0 && rest <= 0 && !sono) { sono = true; chime(2); }
  };
  tick();
  intervalo(tick, 1000);
  if (k.voz) setTimeout(() => speak(texto), 300);

  return h('div', { class: 'paso-a-paso' },
    h('div', { class: 'fila-top' },
      h('button', { class: 'btn ghost', onclick: () => ir(`#/n/${k.id}/r/${r.id}`) }, '← Lista'),
      h('div', { class: 'puntitos' }, r.pasos.map((x, i) =>
        h('span', { class: `${hechos.has(x.id) ? 'ok' : ''} ${i === idx ? 'actual' : ''}` })))),
    h('div', { class: 'tarjeta-paso', style: { '--kc': k.color } },
      h('div', { class: 'gigante' }, p.emoji),
      h('h1', { class: 'paso-grande' }, texto),
      h('button', { class: 'btn ghost', onclick: () => speak(texto) }, '🔊 Escuchar'),
      totalSeg > 0 ? timer.el : null,
      botonAccion(k, p)),
    h('div', { class: 'fila-botones' },
      pendientes.length > 1 ? h('button', {
        class: 'btn sec', onclick: () => { skip.add(p.id); saltados.set(r.id, skip); rerender(); },
      }, 'Después ⤵') : null,
      h('button', {
        class: 'btn big ok', onclick: () => {
          const res = A.marcarPaso(k.id, r.id, p.id, { durSeg: (Date.now() - inicio) / 1000 });
          skip.delete(p.id);
          if (res.nuevo) celebrar(res.estrellas, res.completa ? '¡Rutina completa! +3 ⭐' : '+1 ⭐');
          rerender();
        },
      }, '✓ ¡Listo!')));
}

// ---------------- Pantalla ----------------
export function vistaPantalla(k) {
  const dia = dayKey();
  const pendiente = L.estudioPendiente(S, k, dia);
  if (pendiente) {
    return h('div', { class: 'pantalla' },
      volver(k),
      h('h1', {}, '🎮 Pantalla'),
      h('div', { class: 'primero-despues' },
        h('div', { class: 'pd-caja primero' }, h('small', {}, 'Primero'), h('span', { class: 'pd-emoji' }, pendiente.rutina.emoji),
          h('strong', {}, pendiente.rutina.nombre), h('span', {}, `${pendiente.n}/${pendiente.total} pasos`)),
        h('div', { class: 'pd-flecha' }, '→'),
        h('div', { class: 'pd-caja despues' }, h('small', {}, 'Después'), h('span', { class: 'pd-emoji' }, '🎮'), h('strong', {}, 'Pantalla'),
          h('span', {}, `${L.presupuestoPantalla(S, k, dia).total} min`))),
      h('button', { class: 'btn big ancho', style: { background: k.color }, onclick: () => ir(`#/n/${k.id}/r/${pendiente.rutina.id}`) }, `Ir a ${pendiente.rutina.nombre}`),
      h('button', {
        class: 'btn ghost', onclick: () => pinPad('Desbloquear pantalla (adulto)', pin => {
          if (!A.verificarPin(pin)) return false;
          A.desbloquearPantallaHoy(k.id);
          rerender();
          return true;
        }),
      }, '🔓 Desbloquear (adulto)'));
  }

  const pres = L.presupuestoPantalla(S, k, dia);
  const t = A.timer(k.id);
  const timer = disco(k.color);
  const estado = h('p', { class: 'centro grande' });
  let avisado = false;

  const tick = () => {
    const usado = (L.minutosPantalla(S, k.id, dia) * 60000 + L.transcurridoMs(S.timers[k.id])) / 1000;
    const rest = pres.total * 60 - usado;
    if (rest >= 0) {
      timer.set(rest, pres.total * 60);
      estado.textContent = S.timers[k.id] && S.timers[k.id].inicio ? 'Jugando… el disco se achica.' : 'En pausa';
      estado.classList.remove('rojo');
    } else {
      timer.set(0, 1, `+${Math.max(1, Math.round(-rest / 60))} min`);
      estado.textContent = '⏰ ¡Se acabó el tiempo! Apaga y presiona «Terminé».';
      estado.classList.add('rojo');
      if (!avisado && S.timers[k.id] && S.timers[k.id].inicio) { avisado = true; chime(3); }
    }
  };
  tick();
  intervalo(tick, 1000);

  const corriendo = !!t.inicio;
  const algo = L.transcurridoMs(t) > 0;
  return h('div', { class: 'pantalla' },
    volver(k),
    h('h1', {}, '🎮 Pantalla'),
    h('p', { class: 'muted centro' }, `Hoy tienes ${pres.total} min${pres.desc ? ` (ayer te pasaste ${pres.desc} min y se descontaron)` : ''}.`),
    h('div', { class: 'centro' }, timer.el),
    estado,
    h('div', { class: 'fila-botones' },
      corriendo
        ? h('button', { class: 'btn sec big', onclick: () => { A.pausarPantalla(k.id); rerender(); } }, '⏸ Pausa')
        : h('button', { class: 'btn big', style: { background: k.color }, onclick: () => { A.iniciarPantalla(k.id); rerender(); } }, algo ? '▶ Seguir' : '▶ Empezar'),
      algo ? h('button', {
        class: 'btn big ok', onclick: () => {
          const e = A.terminarPantalla(k.id);
          if (e && e.aTiempo) celebrar(1, '¡Apagaste a tiempo! +1 ⭐');
          else if (e) toast(`Te pasaste ${e.exceso} min${S.ajustes.descontarExceso ? ': mañana se descuentan' : ''}.`);
          rerender();
        },
      }, '⏹ Terminé') : null),
    h('p', { class: 'muted centro chico' }, 'Puedes salir de Rutinapp: el tiempo sigue contando. Sin pantallas la hora antes de dormir 🌙'));
}

// ---------------- Plan lector ----------------
export function vistaLector(k) {
  const dia = dayKey();
  const libro = L.libroActivo(S, k.id);
  if (!libro) {
    return h('div', {}, volver(k), h('h1', {}, '📖 Plan lector'),
      h('p', { class: 'aviso' }, 'Pídele a un adulto que agregue tu libro en «Modo adulto → Lectura y pruebas».'));
  }
  const p = L.planLector(S, libro, dia);
  const input = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: p.total, value: p.ahora || '', class: 'input grande', 'aria-label': 'Página' });
  const control = p.dias > 0 ? `Control ${L.cuandoEs(dia, libro.fechaControl)} (${fechaCorta(libro.fechaControl)})`
    : p.dias === 0 ? '¡El control es hoy!' : 'El control ya pasó';

  return h('div', { class: 'lector' },
    volver(k),
    h('h1', {}, `📖 ${libro.titulo}`),
    h('p', { class: 'muted' }, control),
    barra(p.pct, k.color),
    h('p', { class: 'centro' }, `Vas en la página ${p.ahora} de ${p.total} (${Math.round(p.pct * 100)} %)`),
    p.terminado
      ? h('div', { class: 'aviso ok' }, '🎉 ¡Terminaste el libro!')
      : h('div', { class: `aviso ${p.cumpleHoy ? 'ok' : ''}` },
        p.cumpleHoy ? `✅ Cumpliste la meta de hoy (pág. ${p.metaHoy}).`
          : `🎯 Meta de hoy: llegar a la página ${p.metaHoy} (${p.porDia} páginas, ≈${p.minutosDia} min).`),
    h('label', { class: 'campo' }, '¿En qué página quedaste?', input),
    h('button', {
      class: 'btn big ancho', style: { background: k.color }, onclick: () => {
        const v = Number(input.value);
        if (!v && v !== 0) return;
        const res = A.registrarLectura(k.id, libro.id, v);
        if (res && res.terminado) celebrar(2, '📚 ¡Libro terminado!');
        else if (res && res.nuevaMeta) celebrar(1, '¡Meta de lectura! +1 ⭐');
        else toast('Página guardada');
        rerender();
      },
    }, 'Guardar'));
}

// ---------------- Pruebas ----------------
export function vistaPruebas(k) {
  const dia = dayKey();
  const lista = L.pruebasProximas(S, k.id, dia, 60);
  const materia = h('select', { class: 'input' }, (MATERIAS[k.curso] || MATERIAS[5]).map(m => h('option', { value: m }, m)));
  const fecha = h('input', { type: 'date', class: 'input', min: dia, value: addDays(dia, 7) });
  return h('div', { class: 'pruebas' },
    volver(k),
    h('h1', {}, '📅 Mis pruebas'),
    h('p', { class: 'muted' }, 'Anótalas cuando revises tus cuadernos. Si hay una prueba en los próximos 3 días, esa materia pasa primero en tu estudio.'),
    lista.length
      ? h('ul', { class: 'lista' }, lista.map(p => h('li', { class: 'lista-item' },
        h('span', { class: 'grande' }, '📝'),
        h('span', { class: 'crece' }, h('strong', {}, p.materia), h('small', {}, ` ${fechaCorta(p.fecha)} · ${L.cuandoEs(dia, p.fecha)}`)),
        h('button', { class: 'btn ghost chico', 'aria-label': 'Borrar', onclick: () => { A.borrarPrueba(p.id); rerender(); } }, '🗑️'))))
      : h('p', { class: 'aviso' }, 'No hay pruebas anotadas.'),
    h('h2', { class: 'seccion' }, 'Anotar una prueba'),
    h('div', { class: 'form-fila' },
      h('label', { class: 'campo' }, 'Materia', materia),
      h('label', { class: 'campo' }, 'Fecha', fecha)),
    h('button', {
      class: 'btn big ancho', style: { background: k.color }, onclick: () => {
        if (!fecha.value || fecha.value < dia) { toast('Elige una fecha desde hoy'); return; }
        A.agregarPrueba(k.id, materia.value, fecha.value);
        toast('Prueba anotada');
        const pc = L.pasoConAccion(S, k.id, dia, 'pruebas');
        if (pc && !L.pasoHecho(S, k.id, pc.rutina.id, pc.paso.id, dia)) A.marcarPaso(k.id, pc.rutina.id, pc.paso.id);
        rerender();
      },
    }, '+ Anotar'));
}

// ---------------- Premios y logros ----------------
export function vistaPremios(k) {
  const dia = dayKey();
  const total = L.estrellas(S, k.id);
  const disp = L.disponibles(S, k.id);
  const pend = L.canjesPendientes(S, k.id);
  const logros = L.logros(S, k, dia);
  const meta = L.metaSemanal(S, k, dia);
  return h('div', { class: 'premios' },
    volver(k),
    h('h1', {}, '⭐ Premios y logros'),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('strong', {}, `${total} ⭐`), h('small', {}, 'estrellas')),
      h('div', { class: 'stat' }, h('strong', {}, `${meta.cumplidos}/${meta.meta}`), h('small', {}, 'días buenos esta semana'))),
    pend.length ? h('div', { class: 'aviso' }, `⏳ Esperando a un adulto: ${pend.map(e => `${e.emoji} ${e.nombre}`).join(', ')}`) : null,
    h('h2', { class: 'seccion' }, 'Canjear'),
    h('div', { class: 'grilla-premios' }, S.premios.map(p =>
      h('div', { class: 'premio' },
        h('span', { class: 'premio-emoji' }, p.emoji),
        h('strong', {}, p.nombre),
        h('span', { class: 'muted' }, `${p.costo} ⭐`),
        h('button', {
          class: 'btn chico', disabled: disp < p.costo, onclick: () => {
            modal({
              titulo: `${p.emoji} ${p.nombre}`,
              cuerpo: h('p', {}, `¿Canjear por ${p.costo} ⭐? Un adulto tiene que aprobarlo.`),
              acciones: [
                { texto: 'Sí, pedirlo', clase: 'ok', onClick: () => { if (A.pedirCanje(k.id, p.id)) toast('¡Pedido! Avísale a un adulto.'); rerender(); } },
                { texto: 'Mejor no', clase: 'ghost' },
              ],
            });
          },
        }, disp >= p.costo ? 'Canjear' : `Faltan ${p.costo - disp}`)))),
    h('h2', { class: 'seccion' }, 'Logros'),
    h('div', { class: 'grilla-logros' }, logros.map(l =>
      h('div', { class: `logro ${l.ok ? 'ok' : ''}`, title: l.desc },
        h('span', { class: 'logro-emoji' }, l.ok ? l.emoji : '🔒'),
        h('strong', {}, l.nombre),
        h('small', {}, l.ok ? l.desc : `${l.desc} (${Math.min(l.n, l.meta)}/${l.meta})`)))));
}

// ---------------- Menú de juego ----------------
export function vistaJuego(k) {
  let elegido = null;
  const grilla = h('div', { class: 'grilla-juegos' });
  const pintar = () => grilla.replaceChildren(...S.juegos.map(j =>
    h('button', { class: `juego ${j === elegido ? 'elegido' : ''}`, onclick: () => { elegido = j; speak(j); pintar(); } }, j)));
  pintar();
  return h('div', { class: 'juegos' },
    volver(k),
    h('h1', {}, '🧩 Menú de juego'),
    h('p', { class: 'muted' }, 'Jugar sin pantalla también es importante: ayuda al cerebro a organizarse y a calmarse.'),
    h('button', {
      class: 'btn big ancho', style: { background: k.color }, onclick: () => {
        if (!S.juegos.length) return;
        elegido = S.juegos[Math.floor(Math.random() * S.juegos.length)];
        speak(elegido);
        pintar();
      },
    }, '🎲 Elige por mí'),
    grilla);
}
