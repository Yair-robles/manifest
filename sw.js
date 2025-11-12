// sw.js — NAOSA Tickets PWA estable (InfinityFree Safe)
const VERSION = 'v7-' + Date.now();
const CACHE_NAME = 'naosa-cache-' + VERSION;

// Rutas que se cachearán (ajusta según tus carpetas reales)
const APP_SHELL = [
  '/',                      // raíz
  '/index.php',
  '/manifest.webmanifest',
  '/styles/styles.css',
  '/styles/login.css',
  '/styles/header.css',
  '/img/logo.jpg',
  '/img/logo-naosa.png',
  '/img/chevrolet.png',
  '/img/gmc-2.png'
];

// ============ INSTALACIÓN ============
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of APP_SHELL) {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('⚠️ No se pudo cachear:', url);
      }
    }
    self.skipWaiting();
  })());
});

// ============ ACTIVACIÓN ============
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    self.clients.claim();
  })());
});

// ============ ESTRATEGIA DE CARGA ============
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Evita interferir con peticiones externas (por ejemplo, ipwho.is)
  if (url.origin !== self.location.origin) return;

  // --- Estrategia: network-first para páginas HTML ---
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const preload = event.preloadResponse ? await event.preloadResponse : null;
        const netRes = preload || await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, netRes.clone());
        return netRes;
      } catch (err) {
        console.warn('🛰️ Sin conexión, mostrando versión cacheada');
        return (await caches.match('/index.php')) || Response.error();
      }
    })());
    return;
  }

  // --- Estrategia: cache-first para estáticos ---
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) {
      // Revalidar en segundo plano
      fetch(req).then(async res => {
        if (res.ok) await cache.put(req, res.clone());
      }).catch(() => {});
      return cached;
    }
    try {
      const netRes = await fetch(req);
      if (netRes.ok) cache.put(req, netRes.clone());
      return netRes;
    } catch (err) {
      return Response.error();
    }
  })());
});
