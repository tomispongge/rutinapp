/*
 * Puente Applicatzo → Rutinapp.
 * Se agrega UNA vez al final de Applicatzo, justo antes del último </body>:
 *   <script src="https://tomispongge.github.io/rutinapp/js/puente-applicatzo.js"></script>
 * Fuera de Rutinapp no hace nada, así que Applicatzo funciona igual sola.
 *
 * Dentro de Rutinapp, Applicatzo se abre en un marco (iframe) con ?nino=…&curso=…
 * y este archivo avisa cada guía terminada con postMessage, con el detalle de
 * cada respuesta. Rutinapp suma estrellas, marca el paso de estudio y muestra
 * el detalle en Modo adulto → Tareas.
 *
 * Se engancha a registrarEnHistorial, por donde pasan todas las guías de
 * Applicatzo: todo lo que aparece en "Revisión de Tareas" llega a Rutinapp,
 * también los módulos nuevos, sin tocar este archivo.
 */
(function () {
  'use strict';
  // Sitios de Rutinapp que pueden recibir los resultados.
  var ORIGENES = ['https://tomispongge.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];

  var params = new URLSearchParams(location.search);
  var nino = params.get('nino');
  try {
    if (nino) sessionStorage.setItem('rutinapp.nino', nino);
    else nino = sessionStorage.getItem('rutinapp.nino');
  } catch (e) { /* sin sessionStorage */ }
  if (!nino || !/^[0-9a-f-]{36}$/i.test(nino)) return;

  var enMarco = window.parent !== window;
  var INBOX = 'rutinapp.inbox';

  function id() {
    var b = crypto.getRandomValues(new Uint8Array(16));
    return Array.prototype.map.call(b, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  }

  function aviso(texto) {
    var el = document.createElement('div');
    el.textContent = texto;
    el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#2b2340;color:#fff;' +
      'padding:12px 20px;border-radius:14px;font:600 17px system-ui,sans-serif;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.25)';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function registrar(datos) {
    datos.id = id();
    datos.nino = nino;
    datos.ts = Date.now();
    if (enMarco) {
      datos.tipo = 'rutinapp-resultado';
      // postMessage solo entrega el mensaje si el origen coincide: los demás se descartan.
      ORIGENES.forEach(function (o) { try { window.parent.postMessage(datos, o); } catch (e) { /* ignorar */ } });
      return; // la celebración la muestra Rutinapp
    }
    // Modo antiguo: Applicatzo copiada dentro de Rutinapp (mismo sitio).
    try {
      var arr = JSON.parse(localStorage.getItem(INBOX) || '[]');
      if (!Array.isArray(arr)) arr = [];
      arr.push(datos);
      localStorage.setItem(INBOX, JSON.stringify(arr.slice(-200)));
      aviso('⭐ Guardado en Rutinapp: +2 ⭐');
    } catch (e) { /* almacenamiento lleno o bloqueado */ }
  }

  function enviarGuia(guia) {
    var detalle = Array.isArray(guia.detalle) ? guia.detalle : [];
    var total = typeof guia.total === 'number' ? guia.total : 0;
    var respondidas = detalle.filter(function (f) { return f.r !== undefined && f.r !== null && f.r !== '' && f.r !== '—'; }).length;
    // Revisar sin haber respondido al menos la mitad no cuenta como guía terminada.
    if (total > 0 && respondidas < Math.ceil(total / 2)) return;
    registrar({
      modulo: guia.titulo || guia.modulo,
      correctas: guia.correctas || 0,
      total: total,
      curso: Number(guia.grado) || 0,
      copia: guia.modulo === 'copia',
      detalle: detalle
    });
  }

  if (typeof window.registrarEnHistorial === 'function') {
    var registrarBase = window.registrarEnHistorial;
    window.registrarEnHistorial = function (entrada) {
      var r = registrarBase.apply(this, arguments);
      try { enviarGuia(entrada); } catch (e) { /* no interrumpir Applicatzo */ }
      return r;
    };
  }

  if (!enMarco) {
    var volver = document.createElement('a');
    volver.href = '../index.html#/n/' + nino;
    volver.textContent = '🏠 Volver a Rutinapp';
    volver.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99998;background:#6c4cf5;color:#fff;text-decoration:none;' +
      'padding:14px 20px;border-radius:16px;font:700 17px system-ui,sans-serif;box-shadow:0 6px 20px rgba(108,76,245,.4)';
    document.body.appendChild(volver);
  }

  // ---- Abrir directo en el curso o la sección pedida ----
  try {
    var ir = params.get('ir');
    var curso = params.get('curso');
    if (ir === 'copia' && typeof window.abrirCopia === 'function') window.abrirCopia();
    else if (curso === '1' && typeof window.irA === 'function') window.irA('menu-1basico');
    else if (curso === '5' && typeof window.irA === 'function') window.irA('menu-5basico');
  } catch (e) { /* seguir en el menú principal */ }
})();
