// Modo adulto (protegido con PIN) y configuración inicial.
import { S, guardar, exportar, importar, borrarTodo } from './store.js';
import * as A from './acciones.js';
import * as L from './logic.js';
import { AVATARES, MATERIAS, TIPOS_RUTINA, ACCIONES } from './seed.js';
import { h, uuid, dayKey, addDays, fechaCorta, horasMin, fromMin, nowMin, DIAS_CORTOS, SEMANA, weekday } from './util.js';
import { ir, rerender, toast, modal, pinPad } from './ui.js';

// ---------- Ayudantes de formulario ----------
const card = (titulo, ...hijos) => h('section', { class: 'card' }, titulo ? h('h2', {}, titulo) : null, ...hijos);
const campo = (label, el, ayuda) => h('label', { class: 'campo' }, h('span', {}, label), el, ayuda ? h('small', { class: 'muted' }, ayuda) : null);
const inp = (attrs, onInput) => h('input', { class: 'input', ...attrs, oninput: e => onInput && onInput(e.target.value) });
const num = (valor, onInput, attrs = {}) => inp({ type: 'number', inputmode: 'numeric', value: valor ?? '', ...attrs }, v => onInput(v === '' ? null : Number(v)));
const sel = (ops, val, onChange) => h('select', { class: 'input', onchange: e => onChange(e.target.value) },
  ops.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));
const chk = (valor, onChange, texto) => h('label', { class: 'check' },
  h('input', { type: 'checkbox', checked: valor, onchange: e => onChange(e.target.checked) }), h('span', {}, texto));
const mini = k => h('span', { class: 'mini', style: { '--kc': k.color }, title: k.apodo }, k.avatar);

function selectorAvatar(actual, onPick) {
  const caja = h('div', { class: 'avatares' });
  let val = actual;
  const pintar = () => caja.replaceChildren(...AVATARES.map(a =>
    h('button', { type: 'button', class: `av ${a === val ? 'on' : ''}`, onclick: () => { val = a; onPick(a); pintar(); } }, a)));
  pintar();
  return caja;
}

function descargar(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const AVISO_PRIVACIDAD = 'Usa solo apodos. Rutinapp no necesita apellidos, RUT, fechas de nacimiento ni diagnósticos. Por ahora todo queda guardado solo en este dispositivo.';

// ---------------- Configuración inicial ----------------
export function vistaConfigurar() {
  const borrador = S.ninos.map(k => ({ k, apodo: ['Hija', 'Hijo'].includes(k.apodo) ? '' : k.apodo, avatar: k.avatar }));
  const conLibro = S.ninos.find(k => k.curso >= 3) || null;
  const libro = { titulo: '', paginas: null, paginaInicial: 0, fechaControl: addDays(dayKey(), 14) };
  let pin1 = '';
  let pin2 = '';

  return h('div', { class: 'configurar' },
    h('h1', { class: 'logo' }, '☀️ Bienvenido a Rutinapp'),
    h('p', { class: 'aviso' }, `🔒 ${AVISO_PRIVACIDAD}`),
    borrador.map(b => card(`${b.k.curso}º básico`,
      campo('Apodo', inp({ value: b.apodo, maxlength: 20, placeholder: 'Cómo le dicen en casa' }, v => { b.apodo = v.trim(); })),
      h('div', { class: 'campo' }, h('span', {}, 'Avatar'), selectorAvatar(b.avatar, a => { b.avatar = a; })))),
    card('PIN de adulto',
      h('p', { class: 'muted' }, 'Protege el modo adulto (editar rutinas, aprobar premios). Es un candado para niños, no una clave de seguridad.'),
      h('div', { class: 'form-fila' },
        campo('PIN (4 números)', inp({ type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off' }, v => { pin1 = v; })),
        campo('Repetir PIN', inp({ type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off' }, v => { pin2 = v; })))),
    conLibro ? card(`📖 Plan lector de ${conLibro.curso}º básico (opcional)`,
      h('p', { class: 'muted' }, 'La app calcula cuántas páginas leer cada día para llegar al control.'),
      campo('Título', inp({ value: libro.titulo, placeholder: 'Harry Potter y…' }, v => { libro.titulo = v.trim(); })),
      h('div', { class: 'form-fila' },
        campo('Páginas totales', num(libro.paginas, v => { libro.paginas = v; }, { min: 1 })),
        campo('Página actual', num(libro.paginaInicial, v => { libro.paginaInicial = v || 0; }, { min: 0 })),
        campo('Fecha del control', inp({ type: 'date', value: libro.fechaControl }, v => { libro.fechaControl = v; })))) : null,
    h('button', {
      class: 'btn big ancho', onclick: () => {
        if (borrador.some(b => !b.apodo)) { toast('Falta un apodo'); return; }
        if (!/^\d{4}$/.test(pin1)) { toast('El PIN debe tener 4 números'); return; }
        if (pin1 !== pin2) { toast('Los PIN no coinciden'); return; }
        for (const b of borrador) { b.k.apodo = b.apodo; b.k.avatar = b.avatar; }
        if (conLibro && libro.titulo && libro.paginas && libro.fechaControl) {
          S.libros.push({ id: uuid(), ninoId: conLibro.id, ...libro, activo: true });
        }
        A.fijarPin(pin1);
        S.ajustes.configurado = true;
        guardar();
        toast('¡Listo! Agrega los talleres en Modo adulto → Rutinas.');
        ir('#/');
      },
    }, 'Empezar'));
}

// ---------------- Modo adulto ----------------
const TABS = [
  ['resumen', '📊 Resumen'],
  ['rutinas', '🗓️ Rutinas'],
  ['premios', '⭐ Premios'],
  ['lectura', '📖 Lectura y pruebas'],
  ['ajustes', '⚙️ Ajustes'],
];

export function vistaAdulto(tab = 'resumen', arg) {
  if (!A.adultoActivo()) {
    setTimeout(() => pinPad('PIN de adulto', pin => {
      if (!A.verificarPin(pin)) return false;
      A.activarAdulto();
      rerender();
      return true;
    }, () => ir('#/')), 0);
    return h('div', { class: 'centro pad' }, h('p', { class: 'muted' }, '🔒 Modo adulto'));
  }
  A.activarAdulto(); // renueva los 15 minutos con cada vista
  const vistas = { resumen, rutinas, premios, lectura, ajustes };
  return h('div', { class: 'adulto' },
    h('div', { class: 'fila-top' },
      h('button', { class: 'btn ghost', onclick: () => { A.cerrarAdulto(); ir('#/'); } }, '← Salir'),
      h('h1', {}, '👤 Modo adulto'),
      botonSiesta()),
    h('nav', { class: 'tabs' }, TABS.map(([id, t]) =>
      h('button', { class: `tab ${id === tab ? 'on' : ''}`, onclick: () => ir(`#/adulto/${id}`) }, t))),
    (vistas[tab] || resumen)(arg));
}

function botonSiesta() {
  const activa = S.ajustes.siestaHasta && S.ajustes.siestaHasta > Date.now();
  const texto = activa ? `😴 Siesta hasta ${fromMin(nowMin(new Date(S.ajustes.siestaHasta)))}` : '😴 Siesta';
  return h('button', {
    class: `btn ${activa ? '' : 'sec'}`, onclick: () => {
      const otra = inp({ type: 'time', value: '17:00' });
      modal({
        titulo: '😴 Me voy a dormir',
        cuerpo: h('div', {},
          h('p', { class: 'muted' }, 'Los niños verán un aviso con su plan: primero estudio, después pantalla y luego el menú de juego.'),
          h('div', { class: 'fila-botones' }, ['16:30', '17:00', '17:30', '18:00'].map(t =>
            h('button', { class: 'btn sec', onclick: () => { A.fijarSiesta(t); document.querySelector('.modal-fondo')?.remove(); rerender(); } }, `Hasta ${t}`))),
          campo('Otra hora', otra)),
        acciones: [
          { texto: 'Usar otra hora', onClick: () => { if (otra.value) { A.fijarSiesta(otra.value); rerender(); } } },
          ...(activa ? [{ texto: 'Terminar siesta', clase: 'sec', onClick: () => { A.fijarSiesta(null); rerender(); } }] : []),
          { texto: 'Cerrar', clase: 'ghost' },
        ],
      });
    },
  }, texto);
}

// ---------------- Resumen ----------------
function resumen() {
  const dia = dayKey();
  const pend = L.canjesPendientes(S);
  return h('div', {},
    pend.length ? card('⏳ Premios por aprobar', h('ul', { class: 'lista' }, pend.map(e => {
      const k = L.nino(S, e.ninoId);
      return h('li', { class: 'lista-item' },
        k ? mini(k) : null,
        h('span', { class: 'crece' }, `${e.emoji} ${e.nombre} · ${e.costo} ⭐`),
        h('button', { class: 'btn ok chico', onclick: () => { A.resolverCanje(e.id, true); toast('Aprobado'); rerender(); } }, 'Aprobar'),
        h('button', { class: 'btn ghost chico', onclick: () => { A.resolverCanje(e.id, false); rerender(); } }, 'Rechazar'));
    }))) : null,
    S.ninos.map(k => tarjetaNino(k, dia)));
}

function colorPct(p) {
  if (p == null) return '';
  return p >= 0.8 ? 'ok' : p >= 0.5 ? 'medio' : 'nada';
}

function tarjetaNino(k, dia) {
  const meta = L.metaSemanal(S, k, dia);
  const luces = L.lucesApagadas(S, k, dia);
  const sueno = L.suenoEstimado(S, k, dia);
  const fMeta = L.fechaMetaSueno(k);
  const libro = L.libroActivo(S, k.id);
  const app = L.resumenApplicatzo(S, k.id);
  const sug = L.sugerencias(S, k, dia);
  const hoy = L.rutinasDelDia(S, k, dia);

  return h('section', { class: 'card', style: { '--kc': k.color } },
    h('div', { class: 'tarjeta-cab' },
      h('span', { class: 'cab-avatar' }, k.avatar),
      h('div', { class: 'crece' }, h('h2', {}, k.apodo), h('small', { class: 'muted' }, `${k.curso}º básico`)),
      h('div', { class: 'stat' }, h('strong', {}, `⭐ ${L.estrellas(S, k.id)}`), h('small', {}, 'estrellas')),
      h('div', { class: 'stat' }, h('strong', {}, `${meta.cumplidos}/${meta.meta}`), h('small', {}, 'días ≥80 %'))),

    h('table', { class: 'tabla-semana' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), meta.sem.map(d => h('th', { class: d.dia === dia ? 'hoy' : '' }, DIAS_CORTOS[weekday(d.dia)])))),
      h('tbody', {},
        h('tr', {}, h('th', {}, 'Rutinas'), meta.sem.map(d => h('td', { class: d.futuro ? 'futuro' : colorPct(d.pct) },
          d.futuro || d.pct == null ? '—' : `${Math.round(d.pct * 100)} %`))),
        h('tr', {}, h('th', {}, 'Pantalla'), meta.sem.map(d => {
          const pres = L.presupuestoPantalla(S, k, d.dia).total;
          return h('td', { class: d.futuro ? 'futuro' : d.pantalla > pres ? 'nada' : '' }, d.futuro ? '—' : `${d.pantalla}′`);
        })))),

    h('h3', {}, 'Hoy'),
    h('ul', { class: 'lista compacta' }, hoy.map(({ r, hora }) => {
      const p = L.progresoRutina(S, k.id, r, dia);
      return h('li', { class: 'lista-item' },
        h('span', {}, hora), h('span', { class: 'crece' }, `${r.emoji} ${r.nombre}`),
        h('span', { class: `etiqueta ${p.completa ? 'ok' : p.n ? 'medio' : ''}` }, `${p.n}/${p.total}`));
    })),

    h('h3', {}, '😴 Sueño'),
    h('p', {}, `Luces apagadas hoy: ${luces} · meta ${k.sueno.meta}${fMeta && fMeta > dia ? ` (se alcanza el ${fechaCorta(fMeta)})` : ''}.`,
      sueno != null ? ` Sueño estimado en noche de colegio: ${horasMin(sueno)} (recomendado 9–12 h).` : ''),

    libro ? h('div', {}, h('h3', {}, `📖 ${libro.titulo}`), planTexto(libro, dia)) : null,

    h('h3', {}, '📱 Applicatzo'),
    app.length
      ? h('table', { class: 'tabla' },
        h('thead', {}, h('tr', {}, ['Guía', 'Veces', 'Última', 'Prom. últimas 3', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, app.map(m => h('tr', {},
          h('td', {}, m.modulo), h('td', {}, m.n), h('td', {}, `${m.ultima} · ${fechaCorta(m.ultimaDia)}`),
          h('td', {}, m.prom3 == null ? '—' : `${Math.round(m.prom3 * 100)} %`),
          h('td', {}, m.dominio ? '🎓' : '')))))
      : h('p', { class: 'muted' }, 'Todavía no hay guías registradas.'),

    h('h3', {}, '💡 Sugerencias de ajuste'),
    sug.length ? h('ul', { class: 'sugerencias' }, sug.map(s => h('li', {}, s)))
      : h('p', { class: 'muted' }, 'Aparecerán cuando haya un par de semanas de datos (tiempos reales, pasos difíciles, hábitos ya logrados).'));
}

function planTexto(libro, dia) {
  const p = L.planLector(S, libro, dia);
  if (p.terminado) return h('p', {}, '🎉 Libro terminado.');
  const control = p.dias >= 0 ? `control ${L.cuandoEs(dia, libro.fechaControl)} (${fechaCorta(libro.fechaControl)})` : 'el control ya pasó';
  return h('p', {}, `Página ${p.ahora} de ${p.total} · ${control}. Ritmo necesario: ${p.porDia} págs/día (≈${p.minutosDia} min). Hoy ${p.cumpleHoy ? '✅ cumplió' : `debe llegar a la pág. ${p.metaHoy}`}.`);
}

// ---------------- Rutinas ----------------
const ORDEN_TIPOS = Object.keys(TIPOS_RUTINA);

function rutinas(arg) {
  if (arg) return editorRutina(arg === 'nueva' ? null : S.rutinas.find(r => r.id === arg));
  const lista = [...S.rutinas].sort((a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo));
  return h('div', {},
    card('Rutinas',
      h('p', { class: 'muted' }, 'Consejo: cambia una o dos cosas a la vez y evalúa cada dos semanas. Un hábito nuevo toma semanas en salir solo.'),
      h('ul', { class: 'lista' }, lista.map(r => h('li', { class: 'lista-item' },
        h('span', { class: 'grande' }, r.emoji),
        h('span', { class: 'crece' },
          h('strong', {}, r.nombre), ' ',
          r.ninos.map(id => L.nino(S, id)).filter(Boolean).map(mini),
          h('small', { class: 'muted bloque' },
            `${SEMANA.filter(d => r.dias.includes(d)).map(d => DIAS_CORTOS[d]).join(' ')} · `,
            r.tipo === 'noche' ? 'hora según plan de sueño' : (r.hora || 'sin hora'),
            ` · ${r.pasos.length} paso${r.pasos.length === 1 ? '' : 's'} · ${L.duracion(r)} min`)),
        h('button', { class: 'btn sec chico', onclick: () => ir(`#/adulto/rutinas/${r.id}`) }, 'Editar'),
        h('button', {
          class: 'btn ghost chico', 'aria-label': 'Eliminar', onclick: () => modal({
            titulo: `¿Eliminar «${r.nombre}»?`,
            cuerpo: h('p', {}, 'El historial de días anteriores se conserva en los resúmenes de estrellas.'),
            acciones: [
              { texto: 'Eliminar', clase: 'bad', onClick: () => { S.rutinas = S.rutinas.filter(x => x.id !== r.id); guardar(); rerender(); } },
              { texto: 'Cancelar', clase: 'ghost' },
            ],
          }),
        }, '🗑️')))),
      h('button', { class: 'btn', onclick: () => ir('#/adulto/rutinas/nueva') }, '+ Nueva rutina')),
    editorActividades());
}

function editorRutina(orig) {
  const d = orig ? JSON.parse(JSON.stringify(orig)) : {
    id: uuid(), nombre: '', emoji: '⭐', tipo: 'otra', ninos: S.ninos.map(k => k.id), dias: [1, 2, 3, 4, 5], hora: '16:00', horaPorDia: {}, pasos: [],
  };
  d.horaPorDia = d.horaPorDia || {};
  const cont = h('div', { class: 'editor' });

  const pintar = () => cont.replaceChildren(card(orig ? `Editar: ${orig.nombre}` : 'Nueva rutina',
    h('div', { class: 'form-fila' },
      campo('Emoji', inp({ value: d.emoji, maxlength: 4, class: 'input emoji-input' }, v => { d.emoji = v; })),
      campo('Nombre', inp({ value: d.nombre, maxlength: 40 }, v => { d.nombre = v; })),
      campo('Tipo', sel(Object.entries(TIPOS_RUTINA), d.tipo, v => { d.tipo = v; pintar(); }))),
    h('div', { class: 'campo' }, h('span', {}, 'Para'), h('div', { class: 'fila-checks' }, S.ninos.map(k =>
      chk(d.ninos.includes(k.id), on => { d.ninos = on ? [...d.ninos, k.id] : d.ninos.filter(x => x !== k.id); }, `${k.avatar} ${k.apodo}`)))),
    h('div', { class: 'campo' }, h('span', {}, 'Días'), h('div', { class: 'fila-checks' }, SEMANA.map(wd =>
      chk(d.dias.includes(wd), on => { d.dias = on ? [...d.dias, wd] : d.dias.filter(x => x !== wd); pintar(); }, DIAS_CORTOS[wd])))),
    d.tipo === 'noche'
      ? h('p', { class: 'aviso' }, '🌙 La hora de inicio se calcula sola: hora de apagar luces (plan de sueño) menos la duración de los pasos.')
      : h('div', {},
        campo('Hora', inp({ type: 'time', value: d.hora || '' }, v => { d.hora = v; })),
        h('details', { class: 'detalles', open: Object.keys(d.horaPorDia).length > 0 },
          h('summary', {}, 'Horas distintas según el día'),
          h('div', { class: 'form-fila' }, SEMANA.filter(wd => d.dias.includes(wd)).map(wd =>
            campo(DIAS_CORTOS[wd], inp({ type: 'time', value: d.horaPorDia[wd] || '' }, v => {
              if (v) d.horaPorDia[wd] = v; else delete d.horaPorDia[wd];
            })))))),
    h('h3', {}, `Pasos (${L.duracion(d)} min en total)`),
    h('div', { class: 'pasos-editor' }, d.pasos.map((p, i) => h('div', { class: 'paso-fila' },
      inp({ value: p.emoji, maxlength: 4, class: 'input emoji-input', 'aria-label': 'Emoji' }, v => { p.emoji = v; }),
      inp({ value: p.texto, maxlength: 80, 'aria-label': 'Texto del paso' }, v => { p.texto = v; }),
      num(p.min, v => { p.min = v || 0; }, { min: 0, max: 180, class: 'input min-input', 'aria-label': 'Minutos' }),
      sel(Object.entries(ACCIONES), p.accion || '', v => { if (v) p.accion = v; else delete p.accion; }),
      h('button', { class: 'btn ghost chico', disabled: i === 0, onclick: () => { [d.pasos[i - 1], d.pasos[i]] = [d.pasos[i], d.pasos[i - 1]]; pintar(); } }, '↑'),
      h('button', { class: 'btn ghost chico', disabled: i === d.pasos.length - 1, onclick: () => { [d.pasos[i + 1], d.pasos[i]] = [d.pasos[i], d.pasos[i + 1]]; pintar(); } }, '↓'),
      h('button', { class: 'btn ghost chico', 'aria-label': 'Quitar paso', onclick: () => { d.pasos.splice(i, 1); pintar(); } }, '🗑️')))),
    h('p', { class: 'muted chico' }, 'Escribe {materia} en un paso para mostrar la materia sugerida del día (prueba próxima o rotación).'),
    h('button', { class: 'btn sec', onclick: () => { d.pasos.push({ id: uuid(), emoji: '⭐', texto: '', min: 5 }); pintar(); } }, '+ Agregar paso'),
    h('div', { class: 'fila-botones' },
      h('button', {
        class: 'btn', onclick: () => {
          d.nombre = d.nombre.trim();
          d.pasos = d.pasos.filter(p => p.texto.trim());
          if (!d.nombre) { toast('Falta el nombre'); return; }
          if (!d.ninos.length || !d.dias.length) { toast('Elige al menos un niño y un día'); return; }
          if (!d.pasos.length) { toast('Agrega al menos un paso'); return; }
          const i = S.rutinas.findIndex(r => r.id === d.id);
          if (i >= 0) S.rutinas[i] = d; else S.rutinas.push(d);
          guardar();
          toast('Rutina guardada');
          ir('#/adulto/rutinas');
        },
      }, 'Guardar'),
      h('button', { class: 'btn ghost', onclick: () => ir('#/adulto/rutinas') }, 'Cancelar'))));
  pintar();
  return cont;
}

function editorActividades() {
  const borr = JSON.parse(JSON.stringify(S.actividades));
  const cont = h('div');
  const pintar = () => cont.replaceChildren(card('🏐 Talleres y actividades',
    h('p', { class: 'muted' }, 'Aparecen en «Mi día». Si se suspende uno, el niño lo marca y la app propone el plan B.'),
    h('div', { class: 'pasos-editor' }, borr.map((a, i) => h('div', { class: 'paso-fila' },
      sel(S.ninos.map(k => [k.id, `${k.avatar} ${k.apodo}`]), a.ninoId, v => { a.ninoId = v; }),
      inp({ value: a.emoji, maxlength: 4, class: 'input emoji-input' }, v => { a.emoji = v; }),
      inp({ value: a.nombre, maxlength: 30 }, v => { a.nombre = v; }),
      sel(SEMANA.map(wd => [wd, DIAS_CORTOS[wd]]), a.dia, v => { a.dia = Number(v); }),
      inp({ type: 'time', value: a.desde }, v => { a.desde = v; }),
      inp({ type: 'time', value: a.hasta }, v => { a.hasta = v; }),
      h('button', { class: 'btn ghost chico', onclick: () => { borr.splice(i, 1); pintar(); } }, '🗑️')))),
    h('div', { class: 'fila-botones' },
      h('button', { class: 'btn sec', onclick: () => { borr.push({ id: uuid(), ninoId: S.ninos[0].id, nombre: '', emoji: '🏅', dia: 1, desde: '16:00', hasta: '17:00' }); pintar(); } }, '+ Agregar'),
      h('button', {
        class: 'btn', onclick: () => {
          S.actividades = borr.filter(a => a.nombre.trim() && a.desde && a.hasta);
          guardar();
          toast('Talleres guardados');
          rerender();
        },
      }, 'Guardar talleres')),
    campo('Plan B cuando se suspende', inp({ value: S.ajustes.planB, maxlength: 120 }, v => { S.ajustes.planB = v; guardar(); }))));
  pintar();
  return cont;
}

// ---------------- Premios ----------------
function premios() {
  const borr = JSON.parse(JSON.stringify(S.premios));
  const cont = h('div');
  const historial = S.eventos.filter(e => e.tipo === 'canje' && !e.anulado).slice(-15).reverse();
  const juegos = h('textarea', { class: 'input', rows: 8 });
  juegos.value = S.juegos.join('\n');

  const pintar = () => cont.replaceChildren(
    card('⭐ Premios',
      h('p', { class: 'muted' }, 'Mejor experiencias y privilegios que cosas o pantalla. Elíjanlos junto a los niños: así los sienten suyos.'),
      h('div', { class: 'pasos-editor' }, borr.map((p, i) => h('div', { class: 'paso-fila' },
        inp({ value: p.emoji, maxlength: 4, class: 'input emoji-input' }, v => { p.emoji = v; }),
        inp({ value: p.nombre, maxlength: 50 }, v => { p.nombre = v; }),
        num(p.costo, v => { p.costo = v || 1; }, { min: 1, max: 500, class: 'input min-input' }),
        h('span', { class: 'muted' }, '⭐'),
        h('button', { class: 'btn ghost chico', onclick: () => { borr.splice(i, 1); pintar(); } }, '🗑️')))),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn sec', onclick: () => { borr.push({ id: uuid(), emoji: '🎁', nombre: '', costo: 10 }); pintar(); } }, '+ Agregar'),
        h('button', {
          class: 'btn', onclick: () => { S.premios = borr.filter(p => p.nombre.trim()); guardar(); toast('Premios guardados'); rerender(); },
        }, 'Guardar premios'))),
    card('🧩 Menú de juego (uno por línea)',
      juegos,
      h('button', {
        class: 'btn', onclick: () => {
          S.juegos = juegos.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40);
          guardar();
          toast('Menú guardado');
        },
      }, 'Guardar menú')),
    card('Historial de canjes', historial.length ? h('ul', { class: 'lista compacta' }, historial.map(e => {
      const k = L.nino(S, e.ninoId);
      return h('li', { class: 'lista-item' }, k ? mini(k) : null, h('span', { class: 'crece' }, `${e.emoji} ${e.nombre}`),
        h('span', { class: 'muted' }, fechaCorta(e.dia)), h('span', { class: `etiqueta ${e.estado === 'aprobado' ? 'ok' : ''}` }, e.estado));
    })) : h('p', { class: 'muted' }, 'Sin canjes todavía.')));
  pintar();
  return cont;
}

// ---------------- Lectura y pruebas ----------------
function lectura() {
  const dia = dayKey();
  return h('div', {}, S.ninos.map(k => {
    const actual = L.libroActivo(S, k.id);
    const b = actual ? { ...actual } : { id: uuid(), ninoId: k.id, titulo: '', paginas: null, paginaInicial: 0, fechaControl: addDays(dia, 14), activo: true };
    const materia = sel((MATERIAS[k.curso] || MATERIAS[5]).map(m => [m, m]), (MATERIAS[k.curso] || MATERIAS[5])[0], () => {});
    const fecha = inp({ type: 'date', min: dia, value: addDays(dia, 7) });
    const pruebas = L.pruebasProximas(S, k.id, dia, 90);
    return card(`${k.avatar} ${k.apodo}`,
      h('h3', {}, '📖 Plan lector'),
      actual ? planTexto(actual, dia) : h('p', { class: 'muted' }, 'Sin libro activo.'),
      campo('Título', inp({ value: b.titulo, maxlength: 80 }, v => { b.titulo = v.trim(); })),
      h('div', { class: 'form-fila' },
        campo('Páginas totales', num(b.paginas, v => { b.paginas = v; }, { min: 1 })),
        campo('Página inicial', num(b.paginaInicial, v => { b.paginaInicial = v || 0; }, { min: 0 }), 'En qué página iba al empezar a usar la app'),
        campo('Fecha del control', inp({ type: 'date', value: b.fechaControl }, v => { b.fechaControl = v; }))),
      h('div', { class: 'fila-botones' },
        h('button', {
          class: 'btn', onclick: () => {
            if (!b.titulo || !b.paginas || !b.fechaControl) { toast('Completa título, páginas y fecha'); return; }
            const i = S.libros.findIndex(x => x.id === b.id);
            if (i >= 0) S.libros[i] = b; else S.libros.push(b);
            guardar();
            toast('Libro guardado');
            rerender();
          },
        }, actual ? 'Guardar cambios' : 'Agregar libro'),
        actual ? h('button', {
          class: 'btn sec', onclick: () => { actual.activo = false; guardar(); toast('Libro archivado'); rerender(); },
        }, 'Terminado / cambiar de libro') : null),
      h('h3', {}, '📅 Pruebas'),
      pruebas.length ? h('ul', { class: 'lista compacta' }, pruebas.map(p => h('li', { class: 'lista-item' },
        h('span', { class: 'crece' }, `${p.materia} · ${fechaCorta(p.fecha)} (${L.cuandoEs(dia, p.fecha)})`),
        h('button', { class: 'btn ghost chico', onclick: () => { A.borrarPrueba(p.id); rerender(); } }, '🗑️'))))
        : h('p', { class: 'muted' }, 'Sin pruebas anotadas.'),
      h('div', { class: 'form-fila' }, campo('Materia', materia), campo('Fecha', fecha),
        h('button', {
          class: 'btn sec', onclick: () => {
            if (!fecha.value) return;
            A.agregarPrueba(k.id, materia.value, fecha.value);
            rerender();
          },
        }, '+ Agregar')));
  }),
  card('Ajuste de lectura',
    campo('Minutos por página (estimado)', num(S.ajustes.minPorPagina, v => { S.ajustes.minPorPagina = v || 2.5; guardar(); }, { min: 0.5, max: 10, step: 0.5 }),
      'Para estimar cuánto tiempo toma la meta diaria. Mídelo un par de días y ajústalo.')));
}

// ---------------- Ajustes ----------------
function ajustes() {
  const aj = S.ajustes;
  let pinA = '';
  let pinB = '';
  const archivo = h('input', { type: 'file', accept: 'application/json,.json', class: 'oculto' });
  archivo.addEventListener('change', async () => {
    const f = archivo.files[0];
    if (!f) return;
    const texto = await f.text();
    modal({
      titulo: '¿Restaurar este respaldo?',
      cuerpo: h('p', {}, 'Reemplaza todos los datos actuales de este dispositivo.'),
      acciones: [
        { texto: 'Restaurar', clase: 'bad', onClick: () => { try { importar(texto); toast('Respaldo restaurado'); rerender(); } catch (e) { toast(e.message); } } },
        { texto: 'Cancelar', clase: 'ghost' },
      ],
    });
  });
  const guardarYAviso = () => { guardar(); toast('Guardado'); };

  return h('div', {},
    S.ninos.map(k => card(`${k.avatar} ${k.apodo}`,
      h('div', { class: 'form-fila' },
        campo('Apodo', inp({ value: k.apodo, maxlength: 20 }, v => { if (v.trim()) k.apodo = v.trim(); })),
        campo('Curso', sel([1, 2, 3, 4, 5, 6, 7, 8].map(c => [c, `${c}º básico`]), k.curso, v => { k.curso = Number(v); })),
        campo('Color', h('input', { type: 'color', class: 'input color-input', value: k.color, oninput: e => { k.color = e.target.value; } }))),
      h('div', { class: 'campo' }, h('span', {}, 'Avatar'), selectorAvatar(k.avatar, a => { k.avatar = a; })),
      chk(k.voz, v => { k.voz = v; }, '🔊 Leer los pasos en voz alta automáticamente (para quien recién aprende a leer)'),
      h('h3', {}, '🎮 Pantalla de ocio (minutos al día)'),
      h('div', { class: 'form-fila' },
        campo('Lunes a viernes', num(k.pantallaHabil, v => { k.pantallaHabil = v ?? 0; }, { min: 0, max: 300 }), 'Pediatras españoles: ~1 h; Canadá y Suecia: máx. 2 h'),
        campo('Fin de semana', num(k.pantallaFinde, v => { k.pantallaFinde = v ?? 0; }, { min: 0, max: 300 }))),
      h('h3', {}, '😴 Plan de sueño gradual'),
      h('div', { class: 'form-fila' },
        campo('Hora actual de dormir', inp({ type: 'time', value: k.sueno.actual }, v => { k.sueno.actual = v; })),
        campo('Meta (luces apagadas)', inp({ type: 'time', value: k.sueno.meta }, v => { k.sueno.meta = v; })),
        campo('Adelantar (min)', num(k.sueno.pasoMin, v => { k.sueno.pasoMin = v || 15; }, { min: 5, max: 30, step: 5 })),
        campo('Cada (días)', num(k.sueno.cadaDias, v => { k.sueno.cadaDias = v || 3; }, { min: 1, max: 14 }))),
      h('p', { class: 'muted chico' }, `Plan iniciado el ${fechaCorta(k.sueno.inicio)}. Hoy: luces ${L.lucesApagadas(S, k, dayKey())}.`),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn', onclick: guardarYAviso }, 'Guardar'),
        h('button', { class: 'btn ghost', onclick: () => { k.sueno.inicio = dayKey(); guardarYAviso(); rerender(); } }, 'Reiniciar plan de sueño desde hoy')))),

    card('🏠 General',
      h('div', { class: 'form-fila' },
        campo('Se levantan (días de colegio)', inp({ type: 'time', value: aj.despertar }, v => { aj.despertar = v; })),
        campo('Viernes y sábado: dormir más tarde (min)', num(aj.findeExtraMin, v => { aj.findeExtraMin = v ?? 0; }, { min: 0, max: 90, step: 15 })),
        campo('Meta semanal (días ≥80 %)', num(aj.metaSemanal, v => { aj.metaSemanal = v || 5; }, { min: 1, max: 7 }))),
      chk(aj.descontarExceso, v => { aj.descontarExceso = v; }, 'Si se pasa del tiempo de pantalla, descontarlo al día siguiente (consecuencia proporcional y predecible)'),
      h('h3', {}, 'Materia sugerida por día (si no hay pruebas cerca)'),
      [...new Set(S.ninos.map(k => k.curso))].map(curso => {
        aj.rotacion[curso] = aj.rotacion[curso] || {};
        return h('div', {}, h('small', { class: 'muted' }, `${curso}º básico`),
          h('div', { class: 'form-fila' }, [1, 2, 3, 4, 5].map(wd =>
            campo(DIAS_CORTOS[wd], inp({ value: aj.rotacion[curso][wd] || '', maxlength: 40 }, v => { aj.rotacion[curso][wd] = v.trim(); })))));
      }),
      h('button', { class: 'btn', onclick: guardarYAviso }, 'Guardar')),

    card('🔒 Cambiar PIN',
      h('div', { class: 'form-fila' },
        campo('PIN nuevo', inp({ type: 'password', inputmode: 'numeric', maxlength: 4, autocomplete: 'off' }, v => { pinA = v; })),
        campo('Repetir', inp({ type: 'password', inputmode: 'numeric', maxlength: 4, autocomplete: 'off' }, v => { pinB = v; }))),
      h('button', {
        class: 'btn', onclick: () => {
          if (!/^\d{4}$/.test(pinA) || pinA !== pinB) { toast('Revisa el PIN (4 números iguales)'); return; }
          A.fijarPin(pinA);
          toast('PIN cambiado');
        },
      }, 'Cambiar PIN')),

    card('💾 Respaldo',
      h('p', { class: 'muted' }, 'Mientras no esté activa la sincronización, descarga un respaldo cada cierto tiempo (queda en «Archivos» del iPad).'),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn', onclick: () => descargar(`rutinapp-respaldo-${dayKey()}.json`, exportar()) }, '⬇️ Descargar respaldo'),
        h('button', { class: 'btn sec', onclick: () => archivo.click() }, '⬆️ Restaurar respaldo'),
        archivo)),

    card('🛡️ Privacidad',
      h('p', {}, AVISO_PRIVACIDAD),
      h('button', {
        class: 'btn bad', onclick: () => modal({
          titulo: '¿Borrar todos los datos?',
          cuerpo: h('p', {}, 'Se borran rutinas, estrellas, historial y ajustes de este dispositivo. No se puede deshacer (salvo con un respaldo).'),
          acciones: [
            { texto: 'Sí, borrar todo', clase: 'bad', onClick: () => { borrarTodo(); A.cerrarAdulto(); ir('#/configurar'); } },
            { texto: 'Cancelar', clase: 'ghost' },
          ],
        }),
      }, 'Borrar todos los datos')));
}
