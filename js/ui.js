// Piezas de interfaz compartidas: navegación, avisos, ventanas, celebraciones,
// teclado de PIN y temporizador visual.
import { h, chime, mmss } from './util.js';

let renderer = () => {};
let limpiezas = [];

export function setRenderer(fn) { renderer = fn; }
export function rerender() { renderer(); }
export function alLimpiar(fn) { limpiezas.push(fn); }
export function limpiar() {
  const l = limpiezas;
  limpiezas = [];
  for (const f of l) { try { f(); } catch { /* ignorar */ } }
}
export function intervalo(fn, ms) {
  const id = setInterval(fn, ms);
  alLimpiar(() => clearInterval(id));
  return id;
}
export function ir(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}

export function toast(msg) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.classList.add('fuera'), 2200);
  setTimeout(() => el.remove(), 2700);
}

// acciones: [{ texto, clase, onClick }] — si onClick devuelve false, no se cierra.
export function modal({ titulo, cuerpo, acciones = [], alCerrar }) {
  const cerrar = () => {
    fondo.remove();
    if (alCerrar) alCerrar();
  };
  const caja = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    titulo ? h('h2', {}, titulo) : null,
    cuerpo,
    acciones.length ? h('div', { class: 'modal-acciones' }, acciones.map(a =>
      h('button', {
        class: `btn ${a.clase || ''}`,
        onclick: () => { if (a.onClick && a.onClick() === false) return; cerrar(); },
      }, a.texto))) : null);
  const fondo = h('div', { class: 'modal-fondo', onclick: e => { if (e.target === fondo) cerrar(); } }, caja);
  document.body.append(fondo);
  return cerrar;
}

export function celebrar(n = 1, texto = '') {
  const capa = h('div', { class: 'fiesta', 'aria-hidden': 'true' });
  const cant = Math.min(14, 4 + n * 3);
  for (let i = 0; i < cant; i++) {
    const ang = (Math.PI * 2 * i) / cant;
    const dist = 120 + Math.random() * 90;
    capa.append(h('span', {
      class: 'chispa',
      style: { '--dx': `${Math.cos(ang) * dist}px`, '--dy': `${Math.sin(ang) * dist}px`, animationDelay: `${Math.random() * 0.12}s` },
    }, i % 3 ? '⭐' : '✨'));
  }
  capa.append(h('div', { class: 'fiesta-texto' }, texto || `+${n} ⭐`));
  document.body.append(capa);
  chime(n > 1 ? 3 : 2);
  setTimeout(() => capa.remove(), 1400);
}

// Teclado numérico grande. onOk(pin) devuelve true si el PIN sirve.
export function pinPad(titulo, onOk, onCancel) {
  let pin = '';
  const puntos = h('div', { class: 'pin-puntos' });
  const pintar = () => {
    puntos.replaceChildren(...[0, 1, 2, 3].map(i => h('span', { class: i < pin.length ? 'on' : '' })));
  };
  pintar();
  let cerrar;
  const tecla = d => {
    if (d === '⌫') pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += d;
    pintar();
    if (pin.length === 4) {
      setTimeout(() => {
        if (onOk(pin)) { cerrar(); return; }
        puntos.classList.add('error');
        setTimeout(() => { puntos.classList.remove('error'); pin = ''; pintar(); }, 450);
      }, 120);
    }
  };
  const teclas = h('div', { class: 'pin-teclas' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(d =>
      d ? h('button', { class: 'pin-tecla', onclick: () => tecla(d) }, d) : h('span')));
  cerrar = modal({
    titulo,
    cuerpo: h('div', { class: 'pin' }, puntos, teclas),
    acciones: [{ texto: 'Cancelar', clase: 'ghost', onClick: () => { if (onCancel) onCancel(); } }],
  });
  return cerrar;
}

// Temporizador visual estilo "Time Timer": el disco de color se achica.
export function disco(color = 'var(--bad)') {
  const etiqueta = h('div', { class: 'disco-num' });
  const el = h('div', { class: 'disco', style: { '--dc': color, '--p': 1 } }, h('div', { class: 'disco-centro' }, etiqueta));
  return {
    el,
    set(restanteSeg, totalSeg, extra = '') {
      const p = totalSeg > 0 ? Math.max(0, Math.min(1, restanteSeg / totalSeg)) : 0;
      el.style.setProperty('--p', p.toFixed(4));
      etiqueta.textContent = extra || mmss(restanteSeg);
    },
  };
}

export function barra(pct, color) {
  return h('div', { class: 'barra' },
    h('div', { class: 'barra-relleno', style: { width: `${Math.round((pct || 0) * 100)}%`, ...(color ? { background: color } : {}) } }));
}
