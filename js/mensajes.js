// Conversación entre cada niño y los adultos de la casa. Los mensajes son
// eventos más (tipo 'mensaje'), así viajan por la misma sincronización.
import { S } from './store.js';
import * as A from './acciones.js';
import * as L from './logic.js';
import * as N from './nube.js';
import { h, dayKey, fechaCorta, fromMin, nowMin } from './util.js';
import { alLimpiar, modal, toast } from './ui.js';

// La firma del adulto es de cada equipo (si los adultos comparten la cuenta,
// el teléfono de cada uno firma distinto: "Papá", "Mamá", "Tata"…).
const K_FIRMA = 'rutinapp.firma';
export function firma() {
  try { return localStorage.getItem(K_FIRMA) || ''; } catch { return ''; }
}
function fijarFirma(v) {
  try { localStorage.setItem(K_FIRMA, v); } catch { /* sin espacio */ }
}

export function pedirFirma(alListo) {
  const campo = h('input', { class: 'input', maxlength: 30, placeholder: 'Papá, Mamá, Tata…', value: firma() });
  modal({
    titulo: '¿Cómo firmas tus mensajes?',
    cuerpo: h('div', {}, h('p', { class: 'muted' }, 'Así verán tus hijos quién les escribió. Se guarda en este equipo.'), campo),
    acciones: [
      {
        texto: 'Guardar', onClick: () => {
          const v = campo.value.trim();
          if (!v) { toast('Escribe cómo te llaman'); return false; }
          fijarFirma(v);
          if (alListo) alListo();
          return true;
        },
      },
      { texto: 'Cancelar', clase: 'ghost' },
    ],
  });
  setTimeout(() => campo.focus(), 50);
}

const RAPIDAS = {
  nino: ['👍', '❤️', '¡Listo!', 'Ya voy', '¿Me ayudas?', 'Te quiero'],
  adulto: ['👍', '❤️', '¡Bien hecho!', 'Llego pronto', 'Recuerda tu estudio', 'Te quiero'],
};

// Los chats abiertos se refrescan solos cuando llegan cambios de otro equipo.
const refrescos = new Set();
export function refrescarChats() {
  refrescos.forEach(fn => { try { fn(); } catch { /* ignorar */ } });
}

export const recorte = (t, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

// Estado de los mensajes del niño ahora: bloqueados si tiene rutinas pendientes.
export function estadoNino(k) {
  const pendientes = L.rutinasPendientesAhora(S, k, dayKey(), nowMin());
  const bloqueado = pendientes.length > 0;
  const ms = L.mensajes(S, k.id);
  return {
    bloqueado, pendientes,
    esperando: bloqueado ? ms.filter(m => m.de === 'adulto' && !m.urgente && !m.leido).length : 0,
    urgentesNuevos: ms.filter(m => m.de === 'adulto' && m.urgente && !m.leido),
  };
}

// lector: 'nino' (el niño en su perfil) o 'adulto' (modo adulto).
export function chat(k, lector) {
  const cont = h('div', { class: 'chat' });
  const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-live': 'polite' });
  // La caja de texto se reutiliza al redibujar: no se pierde lo que se está escribiendo.
  const entrada = h('textarea', {
    class: 'input chat-input', rows: 2, maxlength: 500,
    placeholder: lector === 'nino' ? 'Escribe un mensaje…' : `Mensaje para ${k.apodo}…`,
  });
  let urgenteAdulto = false;

  const burbuja = m => {
    const mio = m.de === lector;
    const autor = m.de === 'nino' ? `${k.avatar} ${k.apodo}` : `👤 ${m.firma || 'Adulto'}`;
    const cobro = m.cobro ? (m.devuelto ? ` · ${m.cobro} ⭐ devueltas` : ` · pagó ${m.cobro} ⭐`) : '';
    return h('div', { class: `burbuja ${mio ? 'mia' : 'otra'} ${m.de === 'nino' ? 'del-nino' : ''} ${m.urgente ? 'urgente' : ''}`, style: { '--kc': k.color } },
      m.urgente ? h('small', { class: 'burbuja-urgente' }, '🚨 Urgente') : null,
      mio ? null : h('small', { class: 'burbuja-autor' }, autor),
      h('span', { class: 'burbuja-texto' }, m.texto),
      h('small', { class: 'burbuja-meta' },
        fromMin(nowMin(new Date(m.ts))),
        mio ? (m.leido ? ' · ✓✓ visto' : ' · ✓') : '',
        cobro,
        lector === 'adulto' && m.cobro && !m.devuelto ? h('button', {
          class: 'burbuja-accion', onclick: () => modal({
            titulo: `¿Devolver ${m.cobro} ⭐ a ${k.apodo}?`,
            cuerpo: h('p', {}, 'Para cuando el mensaje urgente era justificado.'),
            acciones: [
              { texto: `Devolver ${m.cobro} ⭐`, clase: 'ok', onClick: () => { A.devolverCobro(m.id); toast('Estrellas devueltas'); construir(); } },
              { texto: 'Cancelar', clase: 'ghost' },
            ],
          }),
        }, `Devolver ${m.cobro} ⭐`) : null,
        lector === 'adulto' ? h('button', {
          class: 'burbuja-borrar', 'aria-label': 'Borrar mensaje',
          onclick: () => modal({
            titulo: '¿Borrar este mensaje?',
            cuerpo: h('p', {}, `«${recorte(m.texto)}»`),
            acciones: [
              { texto: 'Borrar', clase: 'bad', onClick: () => { A.borrarMensaje(m.id); construir(); } },
              { texto: 'Cancelar', clase: 'ghost' },
            ],
          }),
        }, '🗑️') : null));
  };

  const pintarLista = (ms, est) => {
    const nodos = [];
    if (!ms.length) {
      nodos.push(h('p', { class: 'muted centro' }, lector === 'nino'
        ? 'Aquí puedes dejar mensajes para los adultos de la casa.'
        : `Todavía no hay mensajes con ${k.apodo}.`));
    }
    let diaPrevio = '';
    for (const m of ms) {
      if (m.dia !== diaPrevio) {
        diaPrevio = m.dia;
        nodos.push(h('div', { class: 'chat-fecha' }, m.dia === dayKey() ? 'Hoy' : fechaCorta(m.dia)));
      }
      nodos.push(burbuja(m));
    }
    if (est && est.esperando) {
      const n = est.esperando;
      nodos.push(h('div', { class: 'chat-esperando' },
        `📩 ${n === 1 ? 'Hay 1 mensaje esperando' : `Hay ${n} mensajes esperando`}: lo verás al terminar tus rutinas.`));
    }
    lista.replaceChildren(...nodos);
    lista.scrollTop = lista.scrollHeight;
  };

  const enviar = (texto, opciones = {}) => {
    if (!String(texto || '').trim()) return;
    if (lector === 'adulto' && !firma()) { pedirFirma(() => enviar(texto, opciones)); return; }
    const e = A.enviarMensaje(k.id, lector, texto, lector === 'adulto' ? firma() : null, opciones);
    if (!e) return;
    if (texto === entrada.value) entrada.value = '';
    urgenteAdulto = false;
    construir();
    N.programar(200);
  };

  const enviarUrgente = () => {
    const texto = entrada.value;
    if (!texto.trim()) { toast('Escribe tu mensaje urgente'); return; }
    const queda = L.estrellas(S, k.id) - L.COSTO_URGENTE;
    modal({
      titulo: `🚨 ¿Enviar mensaje urgente por ${L.COSTO_URGENTE} ⭐?`,
      cuerpo: h('p', {}, `Te quedarían ${queda} ⭐${queda < 0 ? ' (saldo negativo: las recuperas cumpliendo tus rutinas)' : ''}. Úsalo solo si es importante.`),
      acciones: [
        { texto: `Enviar (−${L.COSTO_URGENTE} ⭐)`, clase: 'bad', onClick: () => enviar(texto, { urgente: true, costo: L.COSTO_URGENTE }) },
        { texto: 'Mejor no', clase: 'ghost' },
      ],
    });
  };

  // Vista del niño con rutinas pendientes: solo sus mensajes y los urgentes.
  const bloqueo = est => h('div', { class: 'aviso chat-bloqueo' },
    h('strong', {}, '🔒 Termina tus rutinas para ver y enviar mensajes'),
    h('span', {}, 'Te falta:'),
    h('div', { class: 'fila-botones izq' }, est.pendientes.map(r =>
      h('button', { class: 'btn sec chico', onclick: () => { location.hash = `#/n/${k.id}/r/${r.id}`; } }, `${r.emoji} ${r.nombre}`))));

  function construir() {
    const est = lector === 'nino' ? estadoNino(k) : null;
    const bloqueado = !!(est && est.bloqueado);
    A.marcarLeidos(k.id, lector, { soloUrgentes: bloqueado });
    pintarLista(lector === 'nino' ? L.visiblesNino(S, k.id, bloqueado) : L.mensajes(S, k.id), est);

    let escribir;
    if (lector === 'adulto') {
      const chk = h('input', { type: 'checkbox', checked: urgenteAdulto, onchange: e => { urgenteAdulto = e.target.checked; } });
      escribir = [
        h('div', { class: 'chat-rapidas' }, RAPIDAS.adulto.map(t => h('button', { class: 'pildora', onclick: () => enviar(t, { urgente: urgenteAdulto }) }, t))),
        h('div', { class: 'chat-escribir' }, entrada,
          h('div', { class: 'chat-enviar' },
            h('label', { class: 'check chico' }, chk, h('span', {}, '🚨 Urgente')),
            h('button', { class: 'btn', onclick: () => enviar(entrada.value, { urgente: urgenteAdulto }) }, 'Enviar'))),
      ];
    } else if (!bloqueado) {
      escribir = [
        h('div', { class: 'chat-rapidas' }, RAPIDAS.nino.map(t => h('button', { class: 'pildora', onclick: () => enviar(t) }, t))),
        h('div', { class: 'chat-escribir' }, entrada, h('button', { class: 'btn', onclick: () => enviar(entrada.value) }, 'Enviar')),
      ];
    } else if (L.urgenteSinResponder(S, k.id)) {
      // Responder a un urgente del adulto no cuesta estrellas.
      escribir = [
        bloqueo(est),
        h('div', { class: 'chat-escribir' }, entrada,
          h('button', { class: 'btn', onclick: () => enviar(entrada.value) }, 'Responder al urgente')),
      ];
    } else {
      escribir = [
        bloqueo(est),
        h('div', { class: 'chat-escribir' }, entrada,
          h('button', { class: 'btn bad', onclick: enviarUrgente }, `🚨 Urgente (${L.COSTO_URGENTE} ⭐)`)),
      ];
    }
    cont.replaceChildren(lista, ...escribir,
      N.estado().conectado ? '' : h('p', { class: 'muted chico' }, 'Sin sincronización activa: los mensajes solo se ven en este equipo.'));
    lista.scrollTop = lista.scrollHeight;
  }

  refrescos.add(construir);
  alLimpiar(() => refrescos.delete(construir));
  // El bloqueo cambia con la hora (empieza una rutina nueva): se revisa cada 30 s.
  const reloj = setInterval(construir, 30000);
  alLimpiar(() => clearInterval(reloj));
  construir();
  setTimeout(() => { lista.scrollTop = lista.scrollHeight; }, 0);
  N.sincronizar();
  return cont;
}
