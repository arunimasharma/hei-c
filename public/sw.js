/**
 * Hello-EQ Service Worker — PWA / Offline Support
 *
 * Caching strategy:
 *  - App shell (HTML, JS, CSS, fonts, icons) → Cache-first with versioned cache
 *  - Anthropic API requests → Network-only (never cache sensitive AI data)
 *  - Everything else       → Network-first with cache fallback
 *
 * On activation the SW claims all clients immediately so the first load
 * after install is already intercepted.
 */

const CACHE_NAME = 'heq-shell-v1';

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/logo.svg',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean up old caches and claim clients ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── Fetch: route-based caching strategy ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API or cross-origin requests
  if (
    url.pathname.startsWith('/api/') ||
    url.host === 'api.anthropic.com' ||
    url.host !== self.location.host
  ) {
    return; // fall through to network
  }

  // HTML navigations → Network-first, fall back to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(r => r ?? Response.error()),
      ),
    );
    return;
  }

  // Static assets → Cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Default → Network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then(r => r ?? Response.error())),
  );
});
