/* Patel Marketing V4 — boot.
   ------------------------------------------------------------------
   Order matters here:
     1. seed history       before anything draws
     2. load the catalogue  nothing can render without it
     3. first paint         the route the reader asked for
     4. session             rates and the order pad appear as it lands
     5. service worker      last, so a bad one can never block the app
   ------------------------------------------------------------------ */
(function(){
'use strict';

/* ---------- 1. seed history --------------------------------------- */
/* The fix for the bug that started V4. A customer opens a shared
   product link, the page loads with exactly ONE history entry, and the
   first Back leaves the site — on a phone that closes the browser.
   Landing anywhere other than home therefore replaces that single entry
   with home and pushes the asked-for route on top of it, so Back always
   has the catalogue to fall back to.

   ?p=slug is V3's link shape and is still what /p/:slug redirects into,
   so those links keep working here unchanged. */
(function seed(){
  const qs = new URLSearchParams(location.search);
  let want = location.hash.replace(/^#/,'');
  if(!want || want==='/'){
    if(qs.get('p'))      want = '/product/'+encodeURIComponent(qs.get('p'));
    else if(qs.get('q')) want = '/search?q='+encodeURIComponent(qs.get('q'));
    else if(qs.get('order')==='1')  want = '/cart';
    else if(qs.get('orders')==='1') want = '/orders';
    else if(qs.get('profile')==='1')want = '/account';
  }
  // Strip the query so a reload does not re-apply it on top of wherever
  // the reader has since navigated to.
  const clean = location.pathname;
  if(!want || want==='/'){
    history.replaceState(null,'',clean+'#/');
    return;
  }
  history.replaceState(null,'',clean+'#/');
  history.pushState(null,'',clean+'#'+(want[0]==='/'?want:'/'+want));
})();

/* ---------- 2 & 3. catalogue, then paint --------------------------- */
async function boot(){
  UI.tabbar();
  try{
    await PM.loadCatalogue();
  }catch(e){
    document.getElementById('view').innerHTML =
      '<div class="empty">'+UI.icon('info')+
      '<strong>Could not load the catalogue</strong>'+
      '<p>Check your signal and try again. If you have opened this before, '+
      'the installed app keeps a copy that works offline.</p>'+
      '<button class="btn btn-primary" onclick="location.reload()">Try again</button></div>';
    return;
  }

  PM.dispatch();
  UI.tabbar();
  UI.cartbar();

  // Keep the tab bar's highlight and the cart bar honest on every move.
  window.addEventListener('hashchange', () => { UI.tabbar(); UI.cartbar(); UI.closeSheet(); });

  /* ---------- 4. who is looking ------------------------------------ */
  // Deliberately after the first paint. The catalogue is public; waiting
  // on a round trip to Supabase before drawing anything would leave a
  // signed-out visitor looking at a spinner for no reason. When the
  // session lands, rates and the order pad appear.
  try{
    await PM.refreshSession();
    PM.dispatch();
    UI.tabbar();
    UI.cartbar();
  }catch(e){}
}

/* ---------- 5. the service worker ---------------------------------- */
/* Registered last and never allowed to break the app. The cache is
   named for the build number, so shipping a build empties the old one;
   a waiting worker shows a strip and lets the reader choose the moment,
   because swapping code under an open order pad is exactly the failure
   worth avoiding. */
function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if(!w) return;
      w.addEventListener('statechange', () => {
        if(w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg);
      });
    });
    if(reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
  }).catch(() => {});
}
function showUpdate(reg){
  if(document.getElementById('updateStrip')) return;
  const el = document.createElement('div');
  el.id = 'updateStrip';
  el.className = 'strip';
  el.style.cssText = 'position:fixed;left:12px;right:12px;z-index:90;margin:0;'+
    'bottom:calc(var(--tabbar) + var(--safe-b) + var(--dock) + 12px);box-shadow:var(--shadow-3)';
  el.innerHTML = '<div class="grow">A newer version is ready</div>'+
    '<button class="btn btn-primary btn-sm" id="updateGo">Reload</button>';
  document.body.append(el);
  document.getElementById('updateGo').onclick = () => {
    if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
    setTimeout(() => location.reload(), 120);
  };
}
// One reload only, or a worker that keeps claiming puts the page in a loop.
let reloaded = false;
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(reloaded) return; reloaded = true;
  });
}

/* ---------- install prompt ----------------------------------------- */
/* Held rather than shown. An install banner in someone's face the first
   time they open a link is how an app gets dismissed for good; Settings
   has a button that fires this when they go looking for it. */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.PM_INSTALL = e;
});
window.addEventListener('appinstalled', () => { window.PM_INSTALL = null; });

/* ---------- offline ------------------------------------------------- */
window.addEventListener('offline', () => UI.toast('No signal — browsing the saved copy'));
window.addEventListener('online',  () => UI.toast('Back online'));

boot().then(registerSW);
})();
