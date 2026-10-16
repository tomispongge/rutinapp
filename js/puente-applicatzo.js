/*
 * Puente Applicatzo → Rutinapp.
 * Se agrega UNA vez al final de Applicatzo, justo antes del último </body>:
 *   <script src="https://tomispongge.github.io/rutinapp/js/puente-applicatzo.js"></script>
 * Fuera de Rutinapp no hace nada, así que Applicatzo funciona igual sola.
 *
 * Dentro de Rutinapp, Applicatzo se abre en un marco (iframe) con ?nino=…&curso=…
 * y este archivo avisa cada guía terminada con postMessage. Rutinapp suma
 * estrellas y marca el paso de estudio.
 *
 * Detecta solo los módulos: los de 1º que usan mostrarResultados(tipo) y los
 * de 5º que muestran "correctas/total" en un contenedor id="contenedor-resultados…".
 * Si agregas módulos nuevos con ese mismo estilo, quedan conectados sin tocar nada.
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

  // Quita emojis y el sufijo " — 5° Básico" de un título.
  function limpiarTitulo(t) {
    return String(t || '').split(' — ')[0].replace(/^[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]+/, '').trim().slice(0, 80);
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

  if (!enMarco) {
    var volver = document.createElement('a');
    volver.href = '../index.html#/n/' + nino;
    volver.textContent = '🏠 Volver a Rutinapp';
    volver.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99998;background:#6c4cf5;color:#fff;text-decoration:none;' +
      'padding:14px 20px;border-radius:16px;font:700 17px system-ui,sans-serif;box-shadow:0 6px 20px rgba(108,76,245,.4)';
    document.body.appendChild(volver);
  }

  // ---- 1º básico: mostrarResultados(tipo) ----
  var yaRegistrados = typeof WeakSet === 'function' ? new WeakSet() : null;
  if (typeof window.mostrarResultados === 'function') {
    var original = window.mostrarResultados;
    window.mostrarResultados = function (tipo) {
      var r = original.apply(this, arguments);
      try {
        var lista = (typeof ejercicios !== 'undefined' && ejercicios) ? ejercicios[tipo] : null;
        var resp = (typeof respuestas !== 'undefined' && respuestas) ? respuestas[tipo] : null;
        var texto = (document.getElementById('puntuacion-texto-' + tipo) || {}).textContent || '';
        var m = texto.match(/(\d+)\s+de\s+(\d+)/);
        var respondidas = resp ? Object.keys(resp).length : 0;
        if (m && lista && yaRegistrados && !yaRegistrados.has(lista) && respondidas >= Math.ceil(lista.length / 2)) {
          yaRegistrados.add(lista);
          var titulo = document.querySelector('#' + tipo + ' h1');
          registrar({ modulo: limpiarTitulo(titulo && titulo.textContent) || tipo, correctas: Number(m[1]), total: Number(m[2]), curso: 1 });
        }
      } catch (e) { /* no interrumpir Applicatzo */ }
      return r;
    };
  }

  // ---- Copia en el cuaderno (si existe) ----
  if (typeof window.marcarCopiaTerminada === 'function') {
    var copiaOriginal = window.marcarCopiaTerminada;
    window.marcarCopiaTerminada = function () {
      var antes = (typeof copiaTerminada !== 'undefined') ? copiaTerminada : false;
      var r = copiaOriginal.apply(this, arguments);
      if (!antes) registrar({ modulo: 'Copia en mi cuaderno', correctas: 0, total: 0, copia: true, curso: 1 });
      return r;
    };
  }

  // ---- 5º básico: todos los contenedores "contenedor-resultados…" ----
  Array.prototype.forEach.call(document.querySelectorAll('[id^="contenedor-resultados"]'), function (cont) {
    var modulo = cont.closest('[id^="modulo-"]');
    if (!modulo || typeof MutationObserver !== 'function') return;
    var h2 = modulo.querySelector('h2');
    var nombre = limpiarTitulo(h2 && h2.textContent) || modulo.id.replace(/^modulo-/, '');
    // "pendiente" = hay una guía nueva sin registrar; se rearma al generar ejercicios
    // nuevos, así revisar dos veces la misma guía no suma doble.
    var pendiente = true;
    modulo.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button');
      if (b && /generar|nuevos/.test(b.id || '')) pendiente = true;
    }, true);
    new MutationObserver(function () {
      if (!pendiente) return;
      var m = (cont.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
      if (!m) return;
      // Revisar sin haber respondido nada no cuenta como guía terminada.
      var escribio = Array.prototype.some.call(modulo.querySelectorAll('input'), function (i) {
        return (i.type === 'radio' || i.type === 'checkbox') ? i.checked : String(i.value || '').trim() !== '';
      });
      if (Number(m[1]) === 0 && !escribio) return;
      pendiente = false;
      registrar({ modulo: nombre, correctas: Number(m[1]), total: Number(m[2]), curso: 5 });
    }).observe(cont, { childList: true });
  });

  // ---- Abrir directo en el curso o la sección pedida ----
  try {
    var ir = params.get('ir');
    var curso = params.get('curso');
    if (ir === 'copia' && typeof window.abrirCopia === 'function') window.abrirCopia();
    else if (curso === '1' && typeof window.irA === 'function') window.irA('menu-1basico');
    else if (curso === '5' && typeof window.irA === 'function') window.irA('menu-5basico');
  } catch (e) { /* seguir en el menú principal */ }
})();
