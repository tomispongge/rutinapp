// Arranque: carga el estado, recoge resultados de Applicatzo y dibuja la vista según la URL (#/…).
import { cargar, S } from './store.js';
import * as A from './acciones.js';
import * as kid from './kid.js';
import * as parent from './parent.js';
import * as N from './nube.js';
import { clear, unlockAudio } from './util.js';
import { setRenderer, limpiar } from './ui.js';

const app = document.getElementById('app');

// El enlace de confirmación de correo de Supabase llega como #access_token=… o #error=…
// Se muestra un aviso y se borra de la URL (no dejamos tokens a la vista).
let avisoCorreo = null;
if (/(^|[#&])(access_token|error_description)=/.test(location.hash)) {
  const p = new URLSearchParams(location.hash.slice(1));
  avisoCorreo = { error: p.get('error_description') };
  history.replaceState(null, '', location.pathname + location.search);
}

function resolver() {
  if (avisoCorreo) {
    const a = avisoCorreo;
    avisoCorreo = null;
    return parent.vistaCorreo(a);
  }
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes[0] === 'nube' && !S.ajustes.configurado) return parent.vistaNubeInicio();
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

// En formularios (modo adulto, bienvenida, inicio de sesión) no se redibuja solo:
// se perdería lo que se está escribiendo.
const enFormulario = () => /^#\/(adulto|configurar|nube)/.test(location.hash);

// Al volver de Applicatzo (u otra app), recoge resultados y refresca las vistas de niños.
function alVolver() {
  const nuevos = A.ingerirInbox();
  A.cerrarTimersViejos();
  A.cerrarCronosViejos();
  if (nuevos || !enFormulario()) render();
}

cargar();
A.ingerirInbox();
A.cerrarTimersViejos();
A.cerrarCronosViejos();
setRenderer(render);
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) alVolver(); });
window.addEventListener('pageshow', e => { if (e.persisted) alVolver(); });
window.addEventListener('storage', e => { if (e.key === 'rutinapp.inbox' && e.newValue) alVolver(); });
document.addEventListener('pointerdown', unlockAudio);
render();
// Sincronización con la nube (si está configurada y hay sesión). Cuando llegan
// cambios de otro equipo, se redibuja salvo que se esté llenando un formulario.
N.iniciar(() => { if (!enFormulario()) render(); });

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
}
