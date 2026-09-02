/* Patel Marketing catalogue — service worker.

   Read this before changing it. This repository already has a scar from
   stale files: the build number in the footer and the ?v= on every script
   exist because phones kept serving a cached old file and a fix looked like
   it had done nothing. A service worker is the same failure with a longer
   memory — it can pin a whole site until someone clears their browser, and
   the people affected are dealers in shops, not developers with DevTools.

   So four rules, and every one of them matters:

   1. THE CACHE NAME IS THE BUILD NUMBER, and the build number is not written
      here. The page registers this file as sw.js?v=<PMAuth.BUILD>, and it is
      read back off our own URL below. There is exactly one build number in
      this project, in supabase-auth.js, and it is already bumped on every
      change — this adds no second thing to remember. Activation deletes every
      cache that is not the current one, so a bump is a clean slate.

   2. data.json IS NEVER SERVED FROM CACHE WHILE THE NETWORK WORKS. It is the
      published catalogue; a stale copy is wrong prices in front of a customer.
      Cache is the fallback for no signal, nothing more.

   3. NOTHING CROSS-ORIGIN AND NOTHING THAT IS NOT A GET IS TOUCHED. Supabase
      carries sign-in, orders, reviews and the noticeboard. Those are somebody's
      live data and a cached answer is a wrong answer. This is an explicit
      early return, not an omission — see the fetch handler.

   4. THERE IS NO skipWaiting(). A new version waits until the reader chooses
      it. Swapping the code under a half-written order is not worth the speed.

   If this ever does go wrong, the fix is a normal push, not a message asking
   every dealer to clear their browser. Replace this whole file with:

       self.addEventListener('install', () => self.skipWaiting());
       self.addEventListener('activate', async () => {
         for (const k of await caches.keys()) await caches.delete(k);
         await self.registration.unregister();
       });

   and every installed copy tears itself out on the next visit. */

const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'pm-v' + BUILD;

/* The shell: enough to open the catalogue with no signal. Deliberately not
   data.json — that is fetched and cached at runtime, under rule 2, so a
   failed install cannot be caused by the largest file in the project. */
const SHELL = [
  './',
  './index.html',
  './config.js?v=' + BUILD,
  './supabase-auth.js?v=' + BUILD,
  './pm-ui.js?v=' + BUILD,
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One at a time and forgiving: addAll() rejects the whole install if a
    // single file 404s, which would leave the reader with no worker at all
    // over one renamed asset.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
  })());
  // No skipWaiting — rule 4.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* The page asks for this when the reader taps Reload on the update strip.
   That is the only thing that can promote a waiting worker. */
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const isImage = url =>
  url.pathname.includes('/images/') || url.pathname.includes('/assets/');

self.addEventListener('fetch', event => {
  const req = event.request;

  // Rule 3, and it comes first so nothing below can undo it.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Rule 2: the published catalogue is network-first, always.
  if (url.pathname.endsWith('/data.json') || url.pathname === '/data.json') {
    event.respondWith(networkFirst(req));
    return;
  }

  // A page load is network-first too, so a deploy shows up the moment someone
  // has signal, and falls back to the cached catalogue when they do not.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }

  // Photos change by being replaced under a new name, so cache-first is safe
  // and is most of what makes the catalogue usable on a bad connection.
  if (isImage(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else same-origin — the scripts — already carries ?v=<build> in
  // its URL, so a new build is a different URL and cache-first cannot serve a
  // stale one. That is the whole reason the ?v= convention was worth keeping.
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (fallbackUrl) {
      const fb = await cache.match(fallbackUrl);
      if (fb) return fb;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  // Opaque responses (no-cors) have status 0 and are not worth storing.
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}
