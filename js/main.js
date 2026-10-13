// Arranque: carga el estado, recoge resultados de Applicatzo y dibuja la vista según la URL (#/…).
import { cargar, S } from './store.js';
import * as A from './acciones.js';
import * as kid from './kid.js';
import * as parent from './parent.js';
import { clear, unlockAudio } from './util.js';
import { setRenderer, limpiar } from './ui.js';

const app = document.getElementById('app');

function resolver() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!S.ajustes.configurado || partes[0] === 'configurar') return parent.vistaConfigurar();
  if (partes[0] === 'adulto') return parent.vistaAdulto(partes[1], partes[2]);
  if (partes[0] === 'n') {
    const k = S.ninos.find(x => x.id === partes[1]);
    if (!k) return kid.vistaInicio();
    switch (partes[2]) {
      case 'r': {
        const r = S.rutinas.find(x => x.id === partes[3]);
        if (!r) return kid.vistaDia(k);
        return partes[4] === 'paso' ? kid.vistaPasoAPaso(k, r) : kid.vistaRutina(k, r);
      }
      case 'pantalla': return kid.vistaPantalla(k);
      case 'lector': return kid.vistaLector(k);
      case 'pruebas': return kid.vistaPruebas(k);
      case 'premios': return kid.vistaPremios(k);
      case 'juego': return kid.vistaJuego(k);
      default: return kid.vistaDia(k);
    }
  }
  return kid.vistaInicio();
}

function render() {
  limpiar();
  const vista = resolver();
  clear(app);
  app.append(vista);
}

// Al volver de Applicatzo (u otra app), recoge resultados y refresca las vistas de niños.
function alVolver() {
  const nuevos = A.ingerirInbox();
  A.cerrarTimersViejos();
  const enFormulario = location.hash.startsWith('#/adulto') || location.hash.startsWith('#/configurar');
  if (nuevos || !enFormulario) render();
}

cargar();
A.ingerirInbox();
A.cerrarTimersViejos();
setRenderer(render);
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) alVolver(); });
window.addEventListener('pageshow', e => { if (e.persisted) alVolver(); });
window.addEventListener('storage', e => { if (e.key === 'rutinapp.inbox' && e.newValue) alVolver(); });
document.addEventListener('pointerdown', unlockAudio);
render();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
}
