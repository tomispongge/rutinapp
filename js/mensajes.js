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

// lector: 'nino' (el niño en su perfil) o 'adulto' (modo adulto).
export function chat(k, lector) {
  const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-live': 'polite' });
  const entrada = h('textarea', {
    class: 'input chat-input', rows: 2, maxlength: 500,
    placeholder: lector === 'nino' ? 'Escribe un mensaje…' : `Mensaje para ${k.apodo}…`,
  });

  const pintar = () => {
    A.marcarLeidos(k.id, lector);
    const ms = L.mensajes(S, k.id);
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
      const mio = m.de === lector;
      const autor = m.de === 'nino' ? `${k.avatar} ${k.apodo}` : `👤 ${m.firma || 'Adulto'}`;
      nodos.push(h('div', { class: `burbuja ${mio ? 'mia' : 'otra'} ${m.de === 'nino' ? 'del-nino' : ''}`, style: { '--kc': k.color } },
        mio ? null : h('small', { class: 'burbuja-autor' }, autor),
        h('span', { class: 'burbuja-texto' }, m.texto),
        h('small', { class: 'burbuja-meta' },
          fromMin(nowMin(new Date(m.ts))),
          mio ? (m.leido ? ' · ✓✓ visto' : ' · ✓') : '',
          lector === 'adulto' ? h('button', {
            class: 'burbuja-borrar', 'aria-label': 'Borrar mensaje',
            onclick: () => modal({
              titulo: '¿Borrar este mensaje?',
              cuerpo: h('p', {}, `«${recorte(m.texto)}»`),
              acciones: [
                { texto: 'Borrar', clase: 'bad', onClick: () => { A.borrarMensaje(m.id); pintar(); } },
                { texto: 'Cancelar', clase: 'ghost' },
              ],
            }),
          }, '🗑️') : null)));
    }
    lista.replaceChildren(...nodos);
    lista.scrollTop = lista.scrollHeight;
  };

  const enviar = texto => {
    if (!String(texto || '').trim()) return;
    if (lector === 'adulto' && !firma()) { pedirFirma(() => enviar(texto)); return; }
    const e = A.enviarMensaje(k.id, lector, texto, lector === 'adulto' ? firma() : null);
    if (!e) return;
    if (texto === entrada.value) entrada.value = '';
    pintar();
    N.programar(200);
  };

  refrescos.add(pintar);
  alLimpiar(() => refrescos.delete(pintar));
  pintar();
  setTimeout(() => { lista.scrollTop = lista.scrollHeight; }, 0);
  N.sincronizar();

  return h('div', { class: 'chat' },
    lista,
    h('div', { class: 'chat-rapidas' }, RAPIDAS[lector].map(t =>
      h('button', { class: 'pildora', onclick: () => enviar(t) }, t))),
    h('div', { class: 'chat-escribir' },
      entrada,
      h('button', { class: 'btn', onclick: () => enviar(entrada.value) }, 'Enviar')),
    N.estado().conectado ? null
      : h('p', { class: 'muted chico' }, 'Sin sincronización activa: los mensajes solo se ven en este equipo.'));
}
