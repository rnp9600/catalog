/* Patel Marketing V4 — home, shop, search, product, saved.
   ------------------------------------------------------------------
   Each screen is a route and draws into #view. Nothing here keeps
   state between visits: a screen re-reads the catalogue and the cart
   every time it is drawn, so going Back to it never shows a stale
   number.
   ------------------------------------------------------------------ */
(function(){
'use strict';
const {esc, money} = PM;
const {icon, img, imgFull, stars, card, grid, rail, stepper, sheet, closeSheet,
       toast, empty, header, headerAction, sizeSheet} = UI;
const view = () => document.getElementById('view');
const scrollTop = () => { const m=document.querySelector('main'); if(m) m.scrollTop=0; window.scrollTo(0,0); };

/* ============ home ================================================= */
PM.route('/', function(){
  header({actions:[
    headerAction('bell','id="hdrNotices"','Notices'),
    headerAction('heart','onclick="location.hash=\'#/saved\'"','Saved'),
  ]});

  const all = PM.live();
  const feat = PM.pricedFirst(PM.sortList(all.filter(p => p.feat), 'suggested')).slice(0,12);
  const recent = PM.recentProducts().slice(0,12);
  const cats = catCounts(all).slice(0,12);
  const notice = PM.NOTICES[0];

  let html = '';

  // The search box is the first thing on the screen because it is the
  // first thing a dealer who knows what they want reaches for. Tapping
  // it goes to the search screen rather than expanding in place — a
  // keyboard opening under a scrolling page is where taps get lost.
  html += '<div style="margin-top:12px">'+
    '<a class="searchbox" href="#/search" style="text-decoration:none">'+
    icon('search')+'<span class="grow" style="color:var(--ink-3);font-size:.9rem">'+
    'Search 700+ products…</span></a></div>';

  if(notice) html += '<div class="notice" style="margin-top:12px">'+
    '<b>'+esc(notice.title||'From the office')+'</b>'+
    (notice.body ? ' — '+esc(notice.body) : '')+'</div>';

  html += heroHtml();

  if(cats.length) html += '<section class="section">'+
    '<div class="section-head"><h2>Shop by category</h2>'+
    '<a class="more" href="#/shop">All</a></div>'+
    '<div class="cattiles">'+cats.map(catTile).join('')+'</div></section>';

  html += '<div id="buyAgain"></div>';

  if(feat.length) html += '<section class="section">'+
    '<div class="section-head"><h2>Picked for the season</h2></div>'+rail(feat)+'</section>';

  if(recent.length) html += '<section class="section">'+
    '<div class="section-head"><h2>You looked at</h2></div>'+rail(recent)+'</section>';

  html += '<section class="section">'+
    '<div class="section-head"><h2>Everything else</h2>'+
    '<a class="more" href="#/shop">Browse all</a></div>'+
    grid(PM.pricedFirst(PM.sortList(all,'suggested')).slice(0,12))+
    '<div style="margin-top:12px"><a class="btn btn-secondary btn-block" href="#/shop">'+
    'See all '+all.length+' products</a></div></section>';

  view().innerHTML = html;
  scrollTop();

  const nb = document.getElementById('hdrNotices');
  if(nb) nb.onclick = noticesSheet;
  drawBuyAgain();
});

function heroHtml(){
  const promo = (PM.CFG.promos||[]).find(p => p.enabled && liveNow(p));
  if(promo) return '<div class="hero"><span class="eyebrow">'+esc(promo.tone||'offer')+'</span>'+
    '<h2>'+esc(promo.title)+'</h2><p>'+esc(promo.note||'')+'</p>'+
    '<a class="btn" href="#/search?q='+encodeURIComponent((promo.match&&promo.match.words||[])[0]||promo.title)+'">See the range</a></div>';
  if(PM.canOrder()) return '<div class="hero"><span class="eyebrow">Trade account</span>'+
    '<h2>Your rates are showing</h2>'+
    '<p>Add sizes to your order from any product, change the quantities, and send it when you are ready.</p>'+
    '<a class="btn" href="#/orders">Your orders</a></div>';
  if(PM.signedIn()) return '';
  return '<div class="hero"><span class="eyebrow">Wholesale</span>'+
    '<h2>Trade rates for dealers</h2>'+
    '<p>Sign in with your phone number to see rates, build an order and send it straight to us.</p>'+
    '<a class="btn" href="#/signin">Sign in</a></div>';
}
function liveNow(pr){
  const t = new Date().toISOString().slice(0,10);
  if(pr.from && t < pr.from) return false;
  if(pr.until && t > pr.until) return false;
  return true;
}
function catCounts(list){
  const m = new Map();
  list.forEach(p => { if(p.cat) m.set(p.cat, (m.get(p.cat)||0)+1); });
  return [...m].map(([cat,n]) => ({cat, n, cover:(list.find(p => p.cat===cat && p.img)||{}).img}))
    .sort((a,b) => PM.CAT_FIRST.indexOf(a.cat)>=0 || PM.CAT_FIRST.indexOf(b.cat)>=0
      ? (PM.CAT_FIRST.indexOf(a.cat)+1||99) - (PM.CAT_FIRST.indexOf(b.cat)+1||99)
      : b.n - a.n);
}
const catTile = c => '<a class="cattile" href="#/shop/'+encodeURIComponent(c.cat)+'">'+
  '<span class="cattile-img">'+(c.cover ? img(c.cover, c.cat) : icon('grid'))+'</span>'+
  '<b>'+esc(c.cat)+'</b><span class="num">'+c.n+'</span></a>';

/* "Buy again" — the last order's lines, as cards. This is the single
   biggest thing a wholesale customer wants and V3 buried it three taps
   deep inside an account screen. */
async function drawBuyAgain(){
  const box = document.getElementById('buyAgain');
  if(!box || !PM.canOrder() || !window.PMAuth || !PMAuth.sb) return;
  try{
    const {data:orders} = await PMAuth.sb.from('order_summary').select('*')
      .order('created_at',{ascending:false}).limit(1);
    if(!orders || !orders.length) return;
    const {data:lines} = await PMAuth.sb.from('order_items').select('*')
      .eq('order_id', orders[0].id).order('sort').limit(20);
    const prods = [...new Set((lines||[]).map(l => l.product_slug))]
      .map(PM.bySlug).filter(Boolean);
    if(!prods.length) return;
    if(!document.getElementById('buyAgain')) return;   // navigated away meanwhile
    box.innerHTML = '<section class="section">'+
      '<div class="section-head"><h2>Buy again</h2>'+
      '<a class="more" href="#/orders">All orders</a></div>'+
      '<p class="tiny muted" style="margin:-6px 2px 10px">From '+esc(orders[0].ref||'your last order')+
      ' · rates are today’s</p>'+ rail(prods)+'</section>';
  }catch(e){ /* the rail is a bonus; never let it break the home screen */ }
}

function noticesSheet(){
  const n = PM.NOTICES;
  sheet({title:'From the office',
    body: n.length
      ? n.map(x => '<div class="notice" style="margin-bottom:9px"><b>'+esc(x.title||'Notice')+'</b>'+
          (x.body?'<div style="margin-top:3px">'+esc(x.body)+'</div>':'')+
          (x.product_slug && PM.bySlug(x.product_slug)
            ? '<div style="margin-top:7px"><a class="btn btn-secondary btn-sm" href="#/product/'+
              encodeURIComponent(x.product_slug)+'" data-sheet-close>See the product</a></div>' : '')+
          '</div>').join('')
      : '<p class="muted tiny">Nothing new right now.</p>'});
}

/* ============ shop ================================================= */
PM.route('/shop', function(){
  header({back:true, title:'Shop'});
  const all = PM.live();
  const cats = catCounts(all);
  const brands = brandCounts(all).slice(0,14);
  view().innerHTML =
    '<section class="section" style="margin-top:14px">'+
      '<div class="section-head"><h2>Categories</h2><p class="tiny muted num">'+all.length+' products</p></div>'+
      '<div class="cattiles">'+cats.map(catTile).join('')+'</div>'+
    '</section>'+
    '<section class="section">'+
      '<div class="section-head"><h2>Brands</h2></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:7px">'+
      brands.map(b => '<a class="chip" href="#/search?b='+encodeURIComponent(b.brand)+'">'+
        esc(b.brand)+'<span class="n num">'+b.n+'</span></a>').join('')+'</div>'+
    '</section>'+
    '<section class="section">'+
      '<div class="section-head"><h2>Everything</h2></div>'+
      '<a class="btn btn-secondary btn-block" href="#/search">Browse all '+all.length+' products</a>'+
    '</section>';
  scrollTop();
});

function brandCounts(list){
  const m = new Map();
  list.forEach(p => { if(p.brand) m.set(p.brand,(m.get(p.brand)||0)+1); });
  return [...m].map(([brand,n]) => ({brand,n})).sort((a,b) => b.n-a.n);
}

/* One category: its sub-groups as chips, then the products. */
PM.route('/shop/:cat', function(params, query){
  const cat = params.cat;
  const inCat = PM.live().filter(p => p.cat===cat);
  if(!inCat.length){ PM.go('/shop', true); return; }
  const sub = query.sub || '';
  const subs = [...new Set(inCat.map(p => p.sub).filter(Boolean))]
    .map(s => ({s, n:inCat.filter(p => p.sub===s).length}))
    .sort((a,b) => b.n-a.n);
  const list = sub ? inCat.filter(p => p.sub===sub) : inCat;
  const sortKey = query.sort || 'suggested';

  header({back:true, title:cat, actions:[headerAction('search','onclick="location.hash=\'#/search?c='+
    encodeURIComponent(cat)+'\'"','Search in '+cat)]});

  view().innerHTML =
    (subs.length>1 ? '<div class="chiprow" style="margin-top:12px">'+
      '<a class="chip'+(sub?'':' on')+'" href="#/shop/'+encodeURIComponent(cat)+'">All'+
        '<span class="n num">'+inCat.length+'</span></a>'+
      subs.map(x => '<a class="chip'+(sub===x.s?' on':'')+'" href="#/shop/'+encodeURIComponent(cat)+
        '?sub='+encodeURIComponent(x.s)+'">'+esc(x.s)+'<span class="n num">'+x.n+'</span></a>').join('')+
      '</div>' : '')+
    '<div class="row" style="margin:14px 2px 10px">'+
      '<div class="grow tiny muted num">'+list.length+' '+PM.plural(list.length,'product')+'</div>'+
      '<button class="btn btn-quiet btn-sm" id="sortBtn">'+icon('sort')+
        PM.SORTS[sortKey].label+'</button>'+
    '</div>'+
    grid(PM.sortList(list, sortKey, PM.RATINGS));
  scrollTop();
  document.getElementById('sortBtn').onclick = () => sortSheet(sortKey, k => {
    const q = new URLSearchParams(); if(sub) q.set('sub',sub); if(k!=='suggested') q.set('sort',k);
    PM.go('/shop/'+encodeURIComponent(cat)+(q.toString()?'?'+q:''), true);
  });
});

function sortSheet(current, pick){
  sheet({title:'Sort by',
    body:'<div class="menulist">'+Object.keys(PM.SORTS).map(k =>
      '<button class="menurow" data-sort="'+k+'"><b>'+PM.SORTS[k].label+'</b>'+
      (k===current?'<span class="chev">'+icon('star')+'</span>':'')+'</button>').join('')+'</div>',
    wire(el){
      el.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
        closeSheet(); pick(b.getAttribute('data-sort'));
      });
    }});
}

/* ============ search =============================================== */
/* One screen for typing and for results. The query lives in the URL, so
   a result list is a place you can go Back to, share, and reload. */
let searchTimer = null;
PM.route('/search', function(_p, query){
  const q = query.q || '';
  const fc = query.c || '', fb = query.b || '';
  const sortKey = query.sort || 'suggested';

  header({back:true, title:'Search'});

  let scope = PM.live();
  if(fc) scope = scope.filter(p => p.cat===fc);
  if(fb) scope = scope.filter(p => p.brand===fb);
  const res = PM.search(q, scope);

  const chips = [];
  if(fc) chips.push('<a class="chip on" href="'+dropParam('c')+'">'+esc(fc)+' '+icon('close')+'</a>');
  if(fb) chips.push('<a class="chip on" href="'+dropParam('b')+'">'+esc(fb)+' '+icon('close')+'</a>');

  view().innerHTML =
    '<div style="margin-top:12px" class="searchbox">'+icon('search')+
      '<input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" '+
      'placeholder="Tawa, kadhai, Paxton, PX-114…" value="'+esc(q)+'" aria-label="Search the catalogue">'+
      '<button class="clear" id="qClear"'+(q?'':' hidden')+' aria-label="Clear">'+icon('close')+'</button>'+
    '</div>'+
    (chips.length ? '<div class="chiprow" style="margin-top:10px">'+chips.join('')+'</div>' : '')+
    '<div id="sugg"></div>'+
    '<div id="results"></div>';

  const input = document.getElementById('q');
  const clear = document.getElementById('qClear');
  clear.onclick = () => { input.value=''; PM.go(searchUrl({q:''}), true); input.focus(); };

  input.addEventListener('input', function(){
    clear.hidden = !input.value;
    clearTimeout(searchTimer);
    // Suggestions are instant; the result list and the log wait for the
    // typing to settle, so a nine-letter word is one search, not nine.
    drawSuggestions(input.value, scope);
    searchTimer = setTimeout(() => {
      PM.go(searchUrl({q:input.value}), true);
      if(input.value.trim().length>1){
        PM.noteQuery(input.value);
        PM.logEvent('search', {q:input.value.trim().slice(0,80),
          n: PM.search(input.value, scope).hits.length});
      }
    }, 420);
  });
  input.addEventListener('keydown', e => {
    if(e.key==='Enter'){ e.preventDefault(); input.blur();
      clearTimeout(searchTimer); PM.go(searchUrl({q:input.value}), true); }
  });

  drawResults(res, sortKey, q, fc, fb);
  if(!q && !fc && !fb) setTimeout(() => input.focus(), 60);
  scrollTop();

  function dropParam(k){
    const p = Object.assign({}, query); delete p[k];
    return '#'+searchUrl(p);
  }
});

function searchUrl(over){
  const cur = (PM.CURRENT && PM.CURRENT.query) || {};
  const p = Object.assign({}, cur, over||{});
  const sp = new URLSearchParams();
  ['q','c','b','sort'].forEach(k => { if(p[k]) sp.set(k,p[k]); });
  const s = sp.toString();
  return '/search'+(s?'?'+s:'');
}

function drawSuggestions(text, scope){
  const box = document.getElementById('sugg');
  if(!box) return;
  const t = String(text||'').trim().toLowerCase();
  if(t.length<2){ box.innerHTML=''; return; }
  const seen = new Set(), out = [];
  const push = (label, href, kind) => {
    const k = kind+':'+label.toLowerCase();
    if(seen.has(k) || out.length>=6) return;
    seen.add(k); out.push({label, href, kind});
  };
  scope.forEach(p => {
    if(out.length>=6) return;
    if(p.sub && p.sub.toLowerCase().includes(t)) push(p.sub, '#/search?q='+encodeURIComponent(p.sub), 'group');
  });
  scope.forEach(p => {
    if(out.length>=6) return;
    if(p.name.toLowerCase().includes(t)) push(p.name, '#/product/'+encodeURIComponent(p.slug), 'product');
  });
  if(!out.length){ box.innerHTML=''; return; }
  box.innerHTML = '<div class="card" style="margin-top:8px;overflow:hidden">'+
    out.map(o => '<a class="menurow" href="'+o.href+'">'+icon(o.kind==='group'?'grid':'search')+
      '<div class="grow"><b>'+esc(o.label)+'</b><small>'+
      (o.kind==='group'?'Group':'Product')+'</small></div>'+
      '<span class="chev">'+icon('chev')+'</span></a>').join('')+'</div>';
}

function drawResults(res, sortKey, typed, fc, fb){
  const box = document.getElementById('results');
  if(!box) return;
  const {hits, note} = res;

  if(!typed && !fc && !fb){
    const recentQ = PM.recentQueries();
    const groups = topGroups(PM.live()).slice(0,10);
    box.innerHTML =
      (recentQ.length ? '<section class="section"><div class="section-head"><h2>Recent searches</h2></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px">'+recentQ.map(q =>
        '<a class="chip" href="#/search?q='+encodeURIComponent(q)+'">'+icon('clock')+esc(q)+'</a>').join('')+
        '</div></section>' : '')+
      '<section class="section"><div class="section-head"><h2>Popular groups</h2></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px">'+groups.map(g =>
        '<a class="chip" href="#/search?q='+encodeURIComponent(g.s)+'">'+esc(g.s)+
        '<span class="n num">'+g.n+'</span></a>').join('')+'</div></section>'+
      '<section class="section"><div class="section-head"><h2>All products</h2>'+
        '<button class="more" id="sortBtn2">'+PM.SORTS[sortKey].label+'</button></div>'+
        UI.grid(PM.sortList(PM.live(), sortKey, PM.RATINGS).slice(0,24))+
        '<div style="margin-top:12px"><button class="btn btn-secondary btn-block" id="showAll">'+
        'Show all '+PM.live().length+'</button></div></section>';
    const sa = document.getElementById('showAll');
    if(sa) sa.onclick = () => {
      sa.closest('div').previousElementSibling.outerHTML =
        UI.grid(PM.sortList(PM.live(), sortKey, PM.RATINGS));
      sa.remove();
    };
    const s2 = document.getElementById('sortBtn2');
    if(s2) s2.onclick = () => sortSheet(sortKey, k => PM.go(searchUrl({sort:k}), true));
    return;
  }

  if(!hits.length){
    box.innerHTML = empty('search','Nothing matched',
      'We looked for that spelling and for the nearest ones we know. Try a shorter word, '+
      'or the group it belongs to.',
      '<a class="btn btn-secondary" href="#/shop">Browse by category</a>');
    return;
  }

  box.innerHTML =
    (note ? '<div class="strip" style="margin-top:10px">'+
      '<div class="grow">Showing results for <b>'+esc(note.shown)+'</b></div>'+
      '<a class="btn btn-quiet btn-sm" href="#/search?q='+encodeURIComponent(note.typed)+'&exact=1">'+
      'Search '+esc(note.typed)+'</a></div>' : '')+
    '<div class="row" style="margin:14px 2px 10px">'+
      '<div class="grow tiny muted num">'+hits.length+' '+PM.plural(hits.length,'result')+'</div>'+
      '<button class="btn btn-quiet btn-sm" id="sortBtn3">'+icon('sort')+PM.SORTS[sortKey].label+'</button>'+
    '</div>'+
    UI.grid(PM.sortList(hits, sortKey, PM.RATINGS));
  const s3 = document.getElementById('sortBtn3');
  if(s3) s3.onclick = () => sortSheet(sortKey, k => PM.go(searchUrl({sort:k}), true));
}

function topGroups(list){
  const m = new Map();
  list.forEach(p => { if(p.sub) m.set(p.sub,(m.get(p.sub)||0)+1); });
  return [...m].map(([s,n]) => ({s,n})).sort((a,b) => b.n-a.n);
}

/* ============ product ============================================== */
/* A screen, not an overlay. That one change is what makes Back work
   from a shared link: the product IS the page, so Back goes to whatever
   the reader saw before it, and from a cold link that is the home
   screen, because app.js seeds one. */
PM.route('/product/:slug', function(params){
  const p = PM.bySlug(params.slug);
  if(!p){
    header({back:true, title:'Not found'});
    view().innerHTML = empty('search','We could not find that product',
      'It may have been renamed or taken off the list.',
      '<a class="btn btn-primary" href="#/">Go to the catalogue</a>');
    return;
  }
  PM.noteRecent(p.slug);
  PM.logEvent('open', {slug:p.slug});

  const photos = (p.imgs && p.imgs.length ? p.imgs : [p.img]).filter(Boolean);
  const pv = PM.priceView(p);
  const sizes = PM.sizesOf(p);
  const saved = PM.isSaved(p.slug);

  header({back:true, title:p.brand, actions:[
    headerAction('share','id="pShare"','Share this product'),
  ]});

  let priceHtml;
  if(pv.locked) priceHtml = '<div class="stack"><a class="btn btn-primary" href="#/signin">'+
    'Sign in to see trade rates</a>'+
    (pv.was ? '<div class="tiny muted">MRP '+pv.was+'</div>' : '')+'</div>';
  else if(pv.ask) priceHtml = '<div class="price-ask">'+esc(pv.ask)+'</div>';
  else priceHtml = '<div class="pdp-priceblock"><span class="price num">'+pv.now+'</span>'+
    (pv.was ? '<span class="price-was num">'+pv.was+'</span>' : '')+
    (pv.tag ? '<span class="badge badge-gold">'+esc(pv.tag)+'</span>' : '')+'</div>';

  const related = PM.live().filter(x => x.slug!==p.slug &&
    (x.sub===p.sub || x.cat===p.cat)).slice(0,10);

  view().innerHTML =
    '<div class="pdp-gallery">'+
      '<div class="pdp-frames" id="frames">'+
        (photos.length ? photos.map(n => '<div>'+imgFull(n, p.name)+'</div>').join('')
                       : '<div><div class="pcard-noimg">No photo yet</div></div>')+
      '</div>'+
      (photos.length>1 ? '<div class="pdp-dots" id="dots">'+
        photos.map((_,i) => '<i class="'+(i?'':'on')+'"></i>').join('')+'</div>' : '')+
      '<button class="psave pdp-fav'+(saved?' on':'')+'" data-save="'+esc(p.slug)+'" '+
        'aria-pressed="'+saved+'" aria-label="Save">'+icon('heart')+'</button>'+
    '</div>'+

    '<div class="pdp-head">'+
      '<div class="pdp-brand">'+esc(p.brand)+'</div>'+
      '<h2>'+esc(p.name)+'</h2>'+
      '<div class="row wrap" style="gap:6px;margin-top:6px">'+
        '<a class="badge badge-quiet" href="#/shop/'+encodeURIComponent(p.cat)+'">'+esc(p.cat)+'</a>'+
        (p.sub ? '<a class="badge badge-quiet" href="#/search?q='+encodeURIComponent(p.sub)+'">'+esc(p.sub)+'</a>' : '')+
        (p.stock && p.stock!=='active' ? '<span class="badge badge-warn">'+esc(p.stock)+'</span>' : '')+
        (PM.RATINGS[p.slug] ? '<span>'+stars(p.slug,true)+'</span>' : '')+
      '</div>'+
      (p.desc ? '<p class="pdp-desc">'+esc(p.desc)+'</p>' : '')+
    '</div>'+

    '<div style="margin-top:12px">'+priceHtml+'</div>'+

    (PM.canOrder()
      ? '<section class="section"><div class="section-head"><h2>Sizes</h2>'+
        '<p class="tiny muted">Tap + to add</p></div>'+
        '<div class="card card-pad" id="sizeBox">'+sizeRowsHtml(p)+'</div></section>'
      : '<section class="section"><div class="section-head"><h2>Sizes</h2></div>'+
        '<div class="card card-pad">'+sizes.map(v =>
          '<div class="sizerow"><div class="sizerow-main"><b>'+esc(v.size)+'</b>'+
          '<div class="sub">'+PM.unitAbbr(v.unit)+'</div></div></div>').join('')+'</div>'+
        (PM.signedIn() ? '' :
          '<p class="tiny muted" style="margin-top:9px">Sign in with your phone number to order.</p>')+
        '</section>')+

    specHtml(p)+

    '<section class="section"><div class="section-head"><h2>Ask about this</h2></div>'+
      '<div class="btnrow">'+
        '<button class="btn btn-secondary" id="pWa">'+icon('wa')+'WhatsApp us</button>'+
        '<button class="btn btn-secondary" id="pShare2">'+icon('share')+'Share</button>'+
      '</div></section>'+

    (related.length ? '<section class="section"><div class="section-head"><h2>Goes with this</h2></div>'+
      rail(related)+'</section>' : '');

  scrollTop();
  wireGallery();
  const share = () => shareProduct(p);
  document.getElementById('pShare').onclick = share;
  document.getElementById('pShare2').onclick = share;
  document.getElementById('pWa').onclick = () => {
    const msg = 'Hello Patel Marketing, I would like to ask about:\n'+p.name+
      (p.code?' ('+p.code+')':'')+'\n'+productUrl(p);
    window.open('https://wa.me/'+waNumber()+'?text='+encodeURIComponent(msg), '_blank','noopener');
  };
  // The size rows redraw as quantities change, so the + turns into a
  // stepper in place without the screen jumping.
  PM.on('cart', () => {
    const box = document.getElementById('sizeBox');
    if(box && PM.CURRENT && PM.CURRENT.params.slug===p.slug) box.innerHTML = sizeRowsHtml(p);
  });
});

function sizeRowsHtml(p){
  return PM.sizesOf(p).map(v => {
    const q = PM.qtyFor(p.slug, v.size);
    return '<div class="sizerow"><div class="sizerow-main"><b>'+esc(v.size)+'</b>'+
      '<div class="sub">'+(v.price==null ? 'Rate on request'
        : money(v.price)+' / '+PM.unitAbbr(v.unit))+
      (v.moq>1 ? ' · sold in '+v.moq+'s' : '')+
      (v.mrp!=null ? ' · MRP '+money(v.mrp) : '')+'</div></div>'+
      (q ? stepper(p.slug, v.size, q)
         : '<button class="btn btn-secondary btn-sm" data-add="'+esc(p.slug)+'" '+
           'data-size="'+esc(v.size)+'">'+icon('plus')+'Add</button>')+
      '</div>';
  }).join('');
}

function specHtml(p){
  const r = [];
  if(p.code) r.push(['Code', p.code]);
  if(p.spec) r.push(['Specification', p.spec]);
  if(p.hsn) r.push(['HSN', p.hsn]);
  if(p.gst!=null) r.push(['GST', p.gst+'%']);
  if(p.alias) r.push(['Also called', p.alias]);
  if(p.note) r.push(['Note', p.note]);
  if(!r.length) return '';
  return '<section class="section"><div class="section-head"><h2>Details</h2></div>'+
    '<div class="card card-pad"><dl class="spec">'+
    r.map(([k,v]) => '<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl></div></section>';
}

const waNumber = () => {
  const n = String(PM.CFG.whatsapp||'').replace(/\D/g,'');
  return n.length>=10 ? n : '917892967505';
};
// The share link stays on the V3 path. /p/:slug is rewritten to an API
// route that renders the preview card WhatsApp shows, and links already
// sent to customers point at it — a V4-only URL would break them.
const productUrl = p => (PM.CFG.site||location.origin)+'/p/'+p.slug;

async function shareProduct(p){
  const pv = PM.priceView(p);
  const line = pv.now ? '\n'+pv.now : '';
  const text = p.name+(p.brand?' — '+p.brand:'')+line+'\n'+productUrl(p);
  if(navigator.share){
    try{ await navigator.share({title:p.name, text:p.name+line, url:productUrl(p)}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); toast('Link copied'); }
  catch(e){ window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener'); }
}

function wireGallery(){
  const frames = document.getElementById('frames'), dots = document.getElementById('dots');
  if(!frames || !dots) return;
  frames.addEventListener('scroll', () => {
    const i = Math.round(frames.scrollLeft / frames.clientWidth);
    [...dots.children].forEach((d,n) => d.classList.toggle('on', n===i));
  }, {passive:true});
}

/* ============ saved ================================================ */
PM.route('/saved', function(){
  header({back:true, title:'Saved'});
  const list = PM.savedProducts();
  view().innerHTML = list.length
    ? '<p class="tiny muted" style="margin:12px 2px">'+list.length+' '+
      PM.plural(list.length,'product')+' you kept. Saved on this phone.</p>'+grid(list)
    : empty('heart','Nothing saved yet',
        'Tap the heart on any product to keep it here. It stays on this phone, '+
        'so it works with no signal.',
        '<a class="btn btn-primary" href="#/shop">Browse the catalogue</a>');
  scrollTop();
});
})();
