/* Patel Marketing V4 — service worker.
   ------------------------------------------------------------------
   The one genuinely dangerous file in the repo: a bad worker pins a
   stale copy of the shop onto every dealer's phone and no amount of
   reloading shifts it. So the rules here are deliberately narrow.

     · The cache is NAMED FOR THE BUILD. Shipping a build makes a new
       cache and deletes every older one, so a stale shell cannot
       survive a deploy. The build number is already bumped on every
       change — this adds nothing new to remember.
     · data.json is NETWORK-FIRST. The published catalogue must never be
       pinned to an old copy; the cached one is a fallback for when the
       network fails, which is what makes offline browsing work without
       freezing prices.
     · NOTHING to Supabase, and nothing that is not a GET, is ever
       cached or even inspected. Sessions, orders, reviews and the
       noticeboard go straight to the network, always. That is an
       explicit early return below, not an omission.
     · NO skipWaiting on install. A new worker waits; the page shows a
       strip and the reader picks the moment. Swapping code under an
       open order pad is exactly the failure worth avoiding.

   Kill switch: if a worker ever goes wrong, replace this whole file
   with the four lines in ARCHITECTURE.md and push. Every phone unregisters
   itself on the next load, with nobody having to clear a browser.
   ------------------------------------------------------------------ */
const BUILD = 41;
const CACHE = 'pm-v4-' + BUILD;

// The shell: what the app needs to open at all. Photos and data.json
// are cached as they are used, not up front — precaching 2.7MB of
// thumbnails on first visit would cost a dealer their data for nothing.
const SHELL = [
  './', './index.html', './app.css?v=41',
  './core.js?v=41', './ui.js?v=41',
  './screens-browse.js?v=41', './screens-order.js?v=41', './screens-account.js?v=41',
  './app.js?v=41', './manifest.webmanifest',
  './config.js?v=41', './supabase-auth.js?v=41',
  './assets/icon-192.png', './assets/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    // addAll fails the whole install if any one URL 404s. Individually,
    // so one renamed asset cannot stop the worker installing at all.
    Promise.all(SHELL.map(u => c.add(u).catch(() => {})))
  ));
});

// Ours, plus the legacy family. This worker owns the root now; the caches
// named pm-v<build> were made by the old root worker, which no longer exists,
// so nobody would ever clear them. The archived build at /v3/ has a worker of
// its own under pm-v3-<build> and is deliberately not matched here.
const MINE = /^pm-v4-\d+$/, LEGACY = /^pm-v\d+$/;
const sweepable = k => k !== CACHE && (MINE.test(k) || LEGACY.test(k));
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(sweepable).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); }catch(err){ return; }

  // Never touch anything that is not ours, and never anything to
  // Supabase. Sessions and orders are not cacheable at any price.
  if(url.origin !== self.location.origin) return;
  if(/supabase\.co$/i.test(url.hostname)) return;

  // The catalogue: network first, cache as a fallback.
  if(url.pathname.endsWith('/data.json')){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }

  // Photos: cache first. They are content-addressed by filename and
  // change only when someone uploads a new one under a new name.
  if(/\/images\//.test(url.pathname)){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if(res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Everything else in the shell: cache first, refreshed in the
  // background so the next load is current without this one waiting.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if(res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
