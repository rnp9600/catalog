/* Patel Marketing V4 — drawing.
   ------------------------------------------------------------------
   The pieces every screen is built from: icons, the product card, the
   rails, the bottom sheet, the toast, the quantity stepper. If two
   screens draw the same thing, it is drawn here once.
   ------------------------------------------------------------------ */
window.UI = (function(){
'use strict';
const {esc, IMG, THUMB, money, rupee} = PM;

/* ---------- icons -------------------------------------------------- */
/* Stroked, 24-grid, currentColor. Inline because 30 icons is smaller
   than a sprite request and works offline with no extra cache entry. */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  grid:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bag:'<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  user:'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  heart:'<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
  back:'<path d="m14.5 5-7 7 7 7"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  chev:'<path d="m9 5 7 7-7 7"/>',
  chevd:'<path d="m5 9 7 7 7-7"/>',
  share:'<path d="M12 15V4"/><path d="m8 7.5 4-3.5 4 3.5"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
  filter:'<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  sort:'<path d="M7 4v16"/><path d="m3.5 16.5 3.5 3.5 3.5-3.5"/><path d="M17 20V4"/><path d="m13.5 7.5 3.5-3.5 3.5 3.5"/>',
  star:'<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  receipt:'<path d="M6 3h12v18l-3-1.7-3 1.7-3-1.7L6 21V3Z"/><path d="M9.5 8h5M9.5 12h5"/>',
  repeat:'<path d="M4 10a6 6 0 0 1 6-6h8"/><path d="m15 1 3 3-3 3"/><path d="M20 14a6 6 0 0 1-6 6H6"/><path d="m9 23-3-3 3-3"/>',
  cog:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>',
  wa:'<path d="M3.5 20.5 5 16.4A8 8 0 1 1 8 19.4l-4.5 1.1Z"/><path d="M9 9.5c.3 1.6 2 3.3 3.6 3.6l.9-1.2 1.9.8c-.2 1.1-1.2 1.6-2.2 1.4-2.5-.4-4.7-2.6-5.1-5.1-.2-1 .3-2 1.4-2.2l.8 1.9L9 9.5Z"/>',
  pdf:'<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z"/><path d="M14 3v4h4"/><path d="M9.5 13.5h5M9.5 16.5h3"/>',
  info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  out:'<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M11 8 7 12l4 4"/><path d="M7 12h9"/>',
  trash:'<path d="M4.5 7h15"/><path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7"/><path d="M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13"/>',
  tag:'<path d="m3.5 12.5 8-8h8v8l-8 8-8-8Z"/><path d="M15.5 8.5h.01"/>',
  truck:'<path d="M3 7h11v9H3V7Z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  shield:'<path d="M12 3.5 5 6v6c0 4.3 3 7.6 7 8.5 4-0.9 7-4.2 7-8.5V6l-7-2.5Z"/>',
  edit:'<path d="M4 20h4l10.5-10.5a2 2 0 0 0-2.8-2.8L5 17v3Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>',
  bell:'<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
  down:'<path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
};
const icon = (n, cls) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '+
  'stroke-linecap="round" stroke-linejoin="round"'+(cls?' class="'+cls+'"':'')+'>'+(I[n]||'')+'</svg>';

/* ---------- product image ------------------------------------------ */
/* Plain <img> with a runtime fallback, never <picture>. A <source> that
   404s does NOT fall back — the browser has already committed to it and
   shows a broken image, which is how V3 once shipped 900 of them. */
function img(name, alt, cls){
  if(!name) return '<div class="pcard-noimg">'+esc(alt||'No photo')+'</div>';
  return '<img src="'+THUMB(name)+'" data-full="'+IMG(name)+'" alt="'+esc(alt||'')+'" '+
    (cls?'class="'+cls+'" ':'')+'loading="lazy" decoding="async" '+
    'onerror="pmImgFallback(this)" onload="pmImgReady(this)">';
}
function imgFull(name, alt){
  if(!name) return '<div class="pcard-noimg">'+esc(alt||'No photo')+'</div>';
  return '<img src="'+IMG(name)+'" alt="'+esc(alt||'')+'" decoding="async" '+
    'onerror="pmImgFallback(this)" onload="pmImgReady(this)" class="ready">';
}

/* ---------- stars --------------------------------------------------- */
function stars(slug, withCount){
  const r = PM.RATINGS[slug];
  if(!r || !r.n) return '';
  const full = Math.max(0, Math.min(5, Math.round(r.avg)));
  let out = '<span class="stars">';
  for(let i=0;i<5;i++) out += '<svg viewBox="0 0 24 24" class="'+(i<full?'':'off')+'">'+I.star+'</svg>';
  out += '</span>';
  if(withCount) out += ' <span class="tiny muted num">'+r.avg.toFixed(1)+' ('+r.n+')</span>';
  return out;
}

/* ---------- the product card ---------------------------------------- */
/* One tile: photo, save, brand, name, price, and one action. The whole
   tile is a link laid over the photo and text; the save button and the
   stepper sit above it with their own stacking context, so a tap on
   either does not also open the product. V3 had them fighting, and a
   dealer tapping "save" opened the sheet instead. */
function card(p){
  const pv = PM.priceView(p);
  const saved = PM.isSaved(p.slug);
  const sizes = PM.sizesOf(p);
  const one = sizes.length===1;
  const inCart = one ? PM.qtyFor(p.slug, sizes[0].size) : 0;

  let priceHtml;
  if(pv.locked) priceHtml = '<span class="price-ask">Sign in for rates</span>';
  else if(pv.ask) priceHtml = '<span class="price-ask">'+esc(pv.ask)+'</span>';
  else priceHtml = '<span class="price num">'+pv.now+'</span>'+
       (pv.was ? '<span class="price-was num">'+pv.was+'</span>' : '');

  const flags = [];
  if(p.feat) flags.push('<span class="badge badge-gold">Featured</span>');
  if(PM.offerFor(p)) flags.push('<span class="badge badge-brand">Offer</span>');
  if(p.stock && p.stock!=='active') flags.push('<span class="badge badge-warn">'+esc(p.stock)+'</span>');

  // The action. A dealer gets a way to order; everyone else gets the
  // sizes count, because a stepper they cannot use is a dead control.
  let act = '';
  if(PM.canOrder()){
    act = one
      ? (inCart ? stepper(p.slug, sizes[0].size, inCart, true)
                : '<button class="btn btn-secondary btn-sm btn-block" data-add="'+esc(p.slug)+'" '+
                  'data-size="'+esc(sizes[0].size)+'">Add</button>')
      : '<button class="btn btn-secondary btn-sm btn-block" data-pick="'+esc(p.slug)+'">'+
        sizes.length+' sizes</button>';
  } else {
    act = '<div class="tiny muted">'+sizes.length+' '+PM.plural(sizes.length,'size')+'</div>';
  }

  return '<article class="pcard">'+
    '<a class="pcard-open" href="#/product/'+encodeURIComponent(p.slug)+'"><span>'+esc(p.name)+'</span></a>'+
    '<div class="pcard-img">'+img(p.img, p.name)+
      (flags.length?'<div class="pcard-flags">'+flags.join('')+'</div>':'')+
      '<button class="psave'+(saved?' on':'')+'" data-save="'+esc(p.slug)+'" '+
        'aria-label="'+(saved?'Saved':'Save')+' '+esc(p.name)+'" aria-pressed="'+saved+'">'+icon('heart')+'</button>'+
    '</div>'+
    '<div class="pcard-body">'+
      '<div class="pcard-brand">'+esc(p.brand)+'</div>'+
      '<div class="pcard-name">'+esc(p.name)+'</div>'+
      '<div class="pcard-price">'+priceHtml+'</div>'+
    '</div>'+
    '<div class="pcard-act">'+act+'</div>'+
  '</article>';
}
const grid = list => '<div class="pgrid">'+list.map(card).join('')+'</div>';
const rail = list => '<div class="rail">'+list.map(card).join('')+'</div>';

/* ---------- stepper -------------------------------------------------- */
/* One control, everywhere a quantity is changed: the card, the size
   rows, the cart, the repeat sheet. Steps by the supplier's minimum, so
   a box of six never goes up in ones. */
function stepper(slug, size, qty, block){
  const step = PM.moqFor(slug, size);
  return '<div class="stepper'+(block?' block':'')+'" data-stepper="'+esc(slug)+'" data-size="'+esc(size)+'">'+
    '<button data-step="-1" aria-label="One less">−</button>'+
    '<span class="n num">'+qty+'</span>'+
    '<button data-step="1" aria-label="One more">+</button>'+
    (step>1 ? '<span class="sr">in '+step+'s</span>' : '')+
  '</div>';
}

/* ---------- bottom sheet ---------------------------------------------- */
/* For a decision made without leaving the screen: pick a size, choose a
   sort, confirm a removal. Anything with state worth going Back to is a
   route, not a sheet. */
let sheetEl, scrimEl, sheetOnClose = null;
function sheet(opts){
  if(!sheetEl){
    scrimEl = document.createElement('div'); scrimEl.className='sheet-scrim';
    sheetEl = document.createElement('div'); sheetEl.className='sheet';
    sheetEl.setAttribute('role','dialog'); sheetEl.setAttribute('aria-modal','true');
    document.body.append(scrimEl, sheetEl);
    scrimEl.addEventListener('click', closeSheet);
    document.addEventListener('keydown', e => { if(e.key==='Escape' && sheetEl.classList.contains('open')) closeSheet(); });
  }
  sheetEl.innerHTML = '<div class="grabber"></div>'+
    (opts.title ? '<div class="sheet-head"><h2>'+esc(opts.title)+'</h2>'+
      '<button class="iconbtn" data-sheet-close aria-label="Close">'+icon('close')+'</button></div>' : '')+
    '<div class="sheet-body">'+(opts.body||'')+'</div>'+
    (opts.foot ? '<div class="sheet-foot">'+opts.foot+'</div>' : '');
  sheetEl.querySelectorAll('[data-sheet-close]').forEach(b => b.onclick = closeSheet);
  scrimEl.classList.add('open');
  requestAnimationFrame(() => sheetEl.classList.add('open'));
  document.body.style.overflow = 'hidden';
  sheetOnClose = opts.onClose || null;
  if(opts.wire) opts.wire(sheetEl);
  return sheetEl;
}
function closeSheet(){
  if(!sheetEl) return;
  sheetEl.classList.remove('open');
  scrimEl.classList.remove('open');
  document.body.style.overflow = '';
  const fn = sheetOnClose; sheetOnClose = null;
  if(fn) try{ fn(); }catch(e){}
}
const sheetOpen = () => !!(sheetEl && sheetEl.classList.contains('open'));

/* ---------- toast ------------------------------------------------------ */
let toastEl, toastT;
function toast(msg){
  if(!toastEl){ toastEl = document.createElement('div'); toastEl.className='toast';
    toastEl.setAttribute('role','status'); document.body.append(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), 2400);
}

/* ---------- waiting for the session ------------------------------------- */
/* Gated routes call this first. Before the session has settled it draws a
   skeleton and answers true, meaning "do not decide anything yet" — the
   dispatch that app.js runs once the session lands draws the real screen.
   Without it, reloading on a dealer-only route redirected away because
   the answer had not arrived. */
function waitingForSession(title){
  if(PM.sessionSettled()) return false;
  header({back:true, title:title||''});
  document.getElementById('view').innerHTML =
    '<div class="skeleton" style="height:64px;margin-top:16px"></div>'+
    '<div class="skeleton" style="height:120px;margin-top:10px"></div>'+
    '<div class="skeleton" style="height:120px;margin-top:10px"></div>';
  return true;
}

/* ---------- empty state ------------------------------------------------ */
const empty = (ic, title, body, action) =>
  '<div class="empty">'+icon(ic)+'<strong>'+esc(title)+'</strong>'+
  (body?'<p>'+esc(body)+'</p>':'')+(action||'')+'</div>';

/* ---------- header ----------------------------------------------------- */
/* Two shapes only. A root tab gets the brand; everything below it gets a
   back arrow and a title. Panels reached from here get a home icon, not
   a button that says "Catalogue" — an icon reads the same in every
   language and takes a third of the width. */
function header(opts){
  const bar = document.getElementById('topbar');
  const right = (opts.actions||[]).join('');
  bar.innerHTML = '<div class="topbar-in">'+
    (opts.back
      ? '<button class="iconbtn" id="hdrBack" aria-label="Back">'+icon('back')+'</button>'+
        '<h1>'+esc(opts.title||'')+'</h1>'
      : '<div class="brandmark">PM</div><div class="brandname grow trunc">'+
        esc(PM.CFG.firm||'Patel Marketing')+'<small>'+esc(PM.CFG.tagline||'')+'</small></div>')+
    right+'</div>';
  const b = document.getElementById('hdrBack');
  if(b) b.onclick = () => PM.backOrHome();
}
const headerAction = (name, attrs, label) =>
  '<button class="iconbtn" '+(attrs||'')+' aria-label="'+esc(label||name)+'">'+icon(name)+'</button>';

/* ---------- the cart bar ------------------------------------------------ */
/* Above the tab bar, and it raises --dock so that no screen can put
   anything underneath it. On V3 the floating basket sat behind an open
   product card; here the bar owns its own strip of the screen. */
function cartbar(){
  let el = document.getElementById('cartbar');
  if(!el){
    el = document.createElement('div'); el.id='cartbar'; el.className='cartbar';
    document.body.append(el);
  }
  const n = PM.cartCount();
  const show = PM.canOrder() && n>0 && !/^#\/(cart|checkout)/.test(location.hash);
  if(!show){
    el.classList.remove('on'); document.body.classList.remove('has-cartbar');
    el.innerHTML=''; return;
  }
  const items = PM.cartItems(), total = PM.cartTotal(items);
  el.innerHTML = '<div class="grow"><b>'+n+' '+PM.plural(n,'item')+' in your order</b>'+
    '<span>'+(total ? money(total)+(PM.cartHasAsk(items)?' + rates to confirm':'') : 'Rates to confirm')+'</span></div>'+
    '<a class="btn" href="#/cart">Review order</a>';
  el.classList.add('on'); document.body.classList.add('has-cartbar');
}

/* ---------- the tab bar -------------------------------------------------- */
const TABS = [
  {href:'#/',        icon:'home',   label:'Home',   match:/^#?\/?$/},
  {href:'#/shop',    icon:'grid',   label:'Shop',   match:/^#\/shop/},
  {href:'#/search',  icon:'search', label:'Search', match:/^#\/search/},
  {href:'#/orders',  icon:'receipt',label:'Orders', match:/^#\/orders/},
  {href:'#/account', icon:'user',   label:'You',    match:/^#\/(account|signin|settings|saved)/},
];
function tabbar(){
  const el = document.getElementById('tabbar');
  const h = location.hash || '#/';
  const n = PM.cartCount();
  el.innerHTML = TABS.map(t => {
    const on = t.match.test(h);
    // The cart lives on the Orders tab: a dealer's "orders" are the one
    // in progress and the ones already sent, and splitting them across
    // two tabs meant the tab bar needed a sixth destination.
    const dot = (t.icon==='receipt' && n && PM.canOrder())
      ? '<span class="dot num">'+(n>99?'99+':n)+'</span>' : '';
    return '<a href="'+t.href+'"'+(on?' class="on" aria-current="page"':'')+'>'+
      dot+icon(t.icon)+'<span>'+t.label+'</span></a>';
  }).join('');
}

/* ---------- one shared delegated click handler --------------------------- */
/* Cards are redrawn constantly; per-element handlers leak and, worse,
   get missed on a rail that was drawn after the wiring ran. One capture
   listener on the document covers every card in the app, drawn or not. */
document.addEventListener('click', function(e){
  const save = e.target.closest('[data-save]');
  if(save){
    e.preventDefault(); e.stopPropagation();
    const slug = save.getAttribute('data-save');
    const now = PM.toggleSaved(slug);
    save.classList.toggle('on', now);
    save.setAttribute('aria-pressed', String(now));
    toast(now ? 'Saved' : 'Removed from saved');
    return;
  }
  const add = e.target.closest('[data-add]');
  if(add){
    e.preventDefault(); e.stopPropagation();
    const slug = add.getAttribute('data-add'), size = add.getAttribute('data-size');
    const q = PM.addToCart(slug, size);
    toast(q+' × '+(PM.bySlug(slug)||{}).name+' added');
    return;
  }
  const pick = e.target.closest('[data-pick]');
  if(pick){
    e.preventDefault(); e.stopPropagation();
    sizeSheet(PM.bySlug(pick.getAttribute('data-pick')));
    return;
  }
  const step = e.target.closest('[data-step]');
  if(step){
    e.preventDefault(); e.stopPropagation();
    const box = step.closest('[data-stepper]');
    const slug = box.getAttribute('data-stepper'), size = box.getAttribute('data-size');
    const dir = Number(step.getAttribute('data-step'));
    const moq = PM.moqFor(slug,size);
    const next = Math.max(0, PM.qtyFor(slug,size) + dir*moq);
    PM.setQty(slug, size, next);
    return;
  }
}, true);

// Redraw the two things that show a cart count whenever the cart moves.
PM.on('cart', () => { cartbar(); tabbar(); });
PM.on('saved', () => {
  document.querySelectorAll('[data-save]').forEach(b => {
    const on = PM.isSaved(b.getAttribute('data-save'));
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
});

/* ---------- size sheet ---------------------------------------------------- */
/* Adding a multi-size product from a listing. Every size, its rate and
   its own stepper, without leaving the grid. */
function sizeSheet(p){
  if(!p) return;
  const draw = () => PM.sizesOf(p).map(v => {
    const q = PM.qtyFor(p.slug, v.size);
    return '<div class="sizerow"><div class="sizerow-main"><b>'+esc(v.size)+'</b>'+
      '<div class="sub">'+(v.price==null ? 'Rate on request' : money(v.price)+' / '+PM.unitAbbr(v.unit))+
      (v.moq>1 ? ' · in '+v.moq+'s' : '')+'</div></div>'+
      (q ? stepper(p.slug, v.size, q)
         : '<button class="btn btn-secondary btn-sm" data-add="'+esc(p.slug)+'" data-size="'+esc(v.size)+'">Add</button>')+
      '</div>';
  }).join('');
  const el = sheet({
    title: p.name,
    body: '<div id="sizeRows">'+draw()+'</div>',
    foot: '<div class="btnrow"><a class="btn btn-secondary" href="#/product/'+encodeURIComponent(p.slug)+
          '" data-sheet-close>Full details</a><button class="btn btn-primary" data-sheet-close>Done</button></div>',
  });
  // The sheet redraws itself as quantities change: the stepper appears
  // in place of Add, and disappears again at zero.
  const redraw = () => { const box = el.querySelector('#sizeRows'); if(box) box.innerHTML = draw(); };
  PM.on('cart', redraw);
}

return {I, icon, img, imgFull, stars, card, grid, rail, stepper, waitingForSession,
        sheet, closeSheet, sheetOpen, toast, empty,
        header, headerAction, cartbar, tabbar, sizeSheet};
})();
