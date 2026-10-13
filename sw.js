// Service worker: permite usar Rutinapp sin internet.
// Estrategia "red primero": con conexión siempre llega la última versión;
// sin conexión responde desde la caché. Sube VERSION al publicar cambios grandes.
const VERSION = 'rutinapp-0.1.5';
const BASE = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/ui.js', './js/util.js', './js/store.js', './js/seed.js',
  './js/logic.js', './js/acciones.js', './js/kid.js', './js/parent.js', './js/puente-applicatzo.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './applicatzo/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    // 'no-cache' revalida con el servidor (respuesta 304 si no cambió), así un
    // git push se ve de inmediato aunque GitHub Pages pida guardar en caché 10 min.
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
