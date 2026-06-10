// Service worker minimale per la PWA.
// Strategia: network-first per pagina e API (i dati live non devono mai essere stale),
// cache-first per asset statici (font, bandiere, icone).
const CACHE = 'wc26-v1';
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'flagcdn.com'];

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // SSE non va mai intercettato
  if (url.pathname.startsWith('/api/events')) return;

  // Asset statici esterni e icone locali: cache-first
  if (STATIC_HOSTS.includes(url.host) || /\.(png|webp|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })
      ))
    );
    return;
  }

  // Pagina e API: network-first con fallback alla cache (per uso offline)
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
