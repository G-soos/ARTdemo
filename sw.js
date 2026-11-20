// Service worker: guarda la app completa en el dispositivo para usarla sin señal.
// Al cambiar cualquier archivo, subir VERSION para que los teléfonos descarguen la nueva versión.
const VERSION = 'art-v2.1.0';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/dom.js', 'js/schema.js', 'js/rules.js', 'js/store.js', 'js/firma.js', 'js/pdf.js',
  'vendor/pdf-lib.min.js', 'vendor/html5-qrcode.min.js',
  'plantillas/ART-FMT-SSO-SEG-001-V4.pdf', 'plantillas/PSGCC-SSO-SAL-006-211221.pdf',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para recibir actualizaciones); si no hay señal, la copia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
