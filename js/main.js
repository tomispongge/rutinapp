// Arranque: carga el estado, recoge resultados de Applicatzo y dibuja la vista según la URL (#/…).
import { cargar, S } from './store.js';
import * as A from './acciones.js';
import * as kid from './kid.js';
import * as parent from './parent.js';
import * as N from './nube.js';
import { refrescarChats } from './mensajes.js';
import { clear, unlockAudio, chime } from './util.js';
import { setRenderer, limpiar, toast, celebrar } from './ui.js';
import { APPLICATZO_URL } from './config.js';

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
      case 'mensajes': return kid.vistaMensajes(k);
      case 'applicatzo': return kid.vistaApplicatzo(k, partes[3]);
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
// Applicatzo tampoco: redibujar recargaría el marco y se perdería la guía en curso.
const enFormulario = () => /^#\/(adulto|configurar|nube)|\/(mensajes|applicatzo(\/\w+)?)$/.test(location.hash);

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
N.iniciar(nuevos => {
  const msgs = nuevos.filter(e => e.tipo === 'mensaje');
  if (msgs.length) {
    const m = msgs[msgs.length - 1];
    const k = S.ninos.find(x => x.id === m.ninoId);
    chime(2);
    toast(m.de === 'nino' ? `📩 ${k ? k.apodo : 'Un niño'} te escribió` : `📩 Mensaje de ${m.firma || 'un adulto'} para ${k ? k.apodo : ''}`);
  }
  refrescarChats();
  if (!enFormulario()) render();
});

// Resultados que manda Applicatzo desde su marco. Se aceptan solo si vienen del
// sitio de Applicatzo, del marco abierto y para el niño que lo está usando.
const ORIGEN_APPLICATZO = new URL(APPLICATZO_URL).origin;
window.addEventListener('message', e => {
  const d = e.data;
  const marco = kid.marcoApplicatzo();
  if (e.origin !== ORIGEN_APPLICATZO || !marco || e.source !== marco.contentWindow) return;
  if (!d || d.tipo !== 'rutinapp-resultado' || !location.hash.startsWith(`#/n/${d.nino}/applicatzo`)) return;
  const ev = A.recibirResultado(d);
  if (!ev) return;
  celebrar(2, ev.total ? `${ev.modulo}: ${ev.correctas}/${ev.total} · +2 ⭐` : `${ev.modulo} · +2 ⭐`);
  const pill = document.querySelector('.applicatzo-estrellas');
  if (pill) pill.textContent = `⭐ ${S.eventos.filter(x => !x.anulado && x.ninoId === d.nino).reduce((a, x) => a + (x.estrellas || 0), 0)}`;
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
}
