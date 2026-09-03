/* Patel Marketing V4 — core.
   ------------------------------------------------------------------
   Data, state, search, routing, cart, session. No DOM rendering lives
   here; ui.js draws and screens.js decides what to draw. Everything is
   hung off one global, PM, because this app has no bundler and adding
   one would mean nobody but a developer could ship a change.

   Shared with V3 on purpose:
     ../data.json      one catalogue, one file, no copy to keep in step
     ../images/**      including the generated thumbnails
     ../config.js      firm details, WhatsApp number, promo strips
     ../supabase-auth.js   phone OTP, the allowlist row, the build number
     localStorage keys the two versions genuinely share (saved list,
     recently viewed, the order in progress) so a dealer can move
     between /v4/ and / mid-order and lose nothing.
   ------------------------------------------------------------------ */
window.PM = (function(){
'use strict';

const CFG = window.PM_CONFIG || {};
const VERSION = 4;

/* ---------- 1. formatting ---------------------------------------- */
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupee = n => '₹' + Number(n).toLocaleString('en-IN');
// A rate we do not have is "—", never ₹0 and never ₹NaN. 127 products in
// this catalogue have no rate; each one of them is a question the dealer
// wants to ask, not a product worth hiding.
const money = n => n==null ? '—' : rupee(n);
const dg = s => String(s||'').replace(/\D/g,'');
const plural = (n,one,many) => n===1 ? one : (many||one+'s');

/* Images. V4 sits one folder down, so every path is relative to the
   parent. The 300px WebP thumbnails are what the grid loads; a missing
   one falls back to the full JPEG at runtime rather than showing the
   browser's broken-image icon — a <picture> element does NOT fall back
   on a 404, which is how V3 shipped 900 broken thumbnails once. */
const IMG   = n => n ? '../images/'+n+'.jpg' : '';
const THUMB = n => n ? '../images/thumb/'+n+'.webp' : '';
window.pmImgFallback = function(img){
  img.onerror = null;                       // one retry, never a loop
  const full = img.getAttribute('data-full');
  if(full && img.src !== full) img.src = full; else img.style.visibility='hidden';
};
window.pmImgReady = function(img){ img.classList.add('ready'); };

/* ---------- 2. catalogue ------------------------------------------ */
let P = [];                       // every product, as published
let BY_SLUG = Object.create(null);
let READY = false;
const readyWaiters = [];

function indexProducts(){
  BY_SLUG = Object.create(null);
  P.forEach(p => { if(p.slug) BY_SLUG[p.slug] = p; });
}
const bySlug = s => BY_SLUG[s] || null;
// What a shopper may see. Hidden products stay reachable by direct link —
// a link already sent to a customer must not turn into a dead end — but
// they never appear in a listing.
const live = () => P.filter(p => !p.hidden);

async function loadCatalogue(){
  const r = await fetch('../data.json', {cache:'no-cache'});
  if(!r.ok) throw new Error('data.json '+r.status);
  P = await r.json();
  indexProducts();
  READY = true;
  while(readyWaiters.length) readyWaiters.shift()();
}
const whenReady = () => READY ? Promise.resolve() : new Promise(r => readyWaiters.push(r));

/* ---------- 3. price ---------------------------------------------- */
// Rates are a range when a product has several sizes. One number when
// they all cost the same, and null when we have no rate at all.
function span(nums){
  const a = nums.filter(x => x!=null);
  if(!a.length) return null;
  const lo = Math.min(...a), hi = Math.max(...a);
  return {lo, hi, one: lo===hi};
}
const rows  = p => (p.variants && p.variants.length) ? p.variants : null;
const dpOf  = p => span(rows(p) ? rows(p).map(v => v.price) : [p.price]);
// Only a printed MRP. V3 used to invent one at 2.25x the dealer rate and
// then strike it through — a made-up number in a customer's hands.
const mrpOf = p => span(rows(p) ? rows(p).map(v => v.mrp) : [p.mrp]);
const fmtSpan = r => !r ? null : (r.one ? rupee(r.lo) : rupee(r.lo)+'–'+r.hi.toLocaleString('en-IN'));

const UNIT_ABBR = {Piece:'pc',Dozen:'dz',Box:'box',Gross:'gr',Kg:'kg',Tag:'tag'};
const unitAbbr = u => UNIT_ABBR[u||'Piece'] || u || 'pc';
const unitOf   = v => v.unit || 'Piece';

// The size rows a product can actually be ordered in, normalised so the
// rest of the app never has to know which of the three shapes it is:
// real variant rows, a plain text size list, or nothing at all.
function sizesOf(p){
  if(rows(p)) return rows(p).map(v => ({
    size:v.size, price:v.price==null?null:v.price, mrp:v.mrp==null?null:v.mrp,
    unit:unitOf(v), moq:(v.moq && v.moq>0)?v.moq:1, stock:v.stock||null,
  }));
  const base = {price:p.price==null?null:p.price, mrp:p.mrp==null?null:p.mrp,
                unit:p.unit||'Piece', moq:(p.moq && p.moq>0)?p.moq:1, stock:null};
  if((p.sizes||[]).length) return p.sizes.map(s => Object.assign({size:s}, base));
  // 130 products have no size rows and no rate. They still go on an order,
  // with the rate left open — not knowing the rate is exactly when a
  // dealer wants to ask for it.
  return [Object.assign({size:'Standard'}, base)];
}

/* ---------- 4. search --------------------------------------------- */
/* Two layers, both from V3 and both proven against real mistyped queries.
   A phonetic fold ("tawaa" and "tava" reduce to the same key) catches
   how Indian-English transliterates; a bounded Damerau-Levenshtein walk
   over the catalogue's own vocabulary catches the rest. Both run only
   when a search would otherwise come back empty. */
const SYN = {
  wh:['white'], bk:['black'], ss:['stainless steel'], rd:['round'], sq:['square'],
  sp:['salt pepper','salt & pepper'], pm:['potato masher'], fp:['frying pan'],
  ltr:['litre'], pcs:['pieces'], pc:['piece'], cera:['cera','ceramic'],
  tadka:['ogarala','vagaria','tadka'],
  kiwi:['addakal'], 'kiwi tawa':['addakal'], addakal:['kiwi tawa'],
  adakal:['addakal','kiwi tawa'],
  appam:['paniyarakal','appakal'], paniyarakal:['appam'], paniyaram:['paniyarakal','appam'],
  appacity:['appakal'], appakal:['appacity','appam'],
  dh:['double handle'], kadhai:['vadachatti'], kadai:['vadachatti','kadai'],
  vadachatti:['kadhai','kadai'], kuzhi:['bump base','kuzhi'],
  uttapam:['uttapakal'], uttapakal:['uttapam'], soppu:['miniature toys'],
};

function hay(p){
  if(p._h) return p._h;
  const v = (p.variants||[]).map(x => x.size).join(' ');
  p._h = (p.name+' '+p.brand+' '+p.cat+' '+p.sub+' '+(p.desc||'')+' '+(p.spec||'')+' '+
    (p.code||'')+' '+(p.alias||'')+' '+v+' '+(p.sizes||[]).join(' ')+
    (p.hotel ? ' '+p.hotel.pits+' pits '+p.hotel.base+' '+p.hotel.dia+' '+p.hotel.kg : '')
  ).toLowerCase();
  return p._h;
}

function softKey(w){
  let s = String(w).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!s) return '';
  s = s.replace(/ph/g,'f').replace(/sh/g,'s');   // phulka -> fulka
  s = s.replace(/([bdgjkpt])h/g,'$1');           // kadhai -> kadai
  s = s.replace(/w/g,'v');                       // tawa -> tava
  s = s.replace(/ee/g,'i').replace(/oo/g,'u');   // steel -> stil
  s = s.replace(/(.)\1+/g,'$1');                 // tawaa -> tawa
  return s;
}
// Bounded: gives up as soon as every path exceeds max.
function editDist(a,b,max){
  const la=a.length, lb=b.length;
  if(Math.abs(la-lb) > max) return max+1;
  let prev = Array.from({length:lb+1},(_,i)=>i), cur = new Array(lb+1);
  for(let i=1;i<=la;i++){
    cur[0]=i; let best=i;
    for(let j=1;j<=lb;j++){
      const cost = a[i-1]===b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
      if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) cur[j]=Math.min(cur[j],prev[j-1]);
      if(cur[j]<best) best=cur[j];
    }
    if(best>max) return max+1;
    const t=prev; prev=cur; cur=t;
  }
  return prev[lb];
}
let SIDX = null;
function searchIndex(){
  if(SIDX) return SIDX;
  SIDX = new Map();
  const add = (w,n) => {
    if(w.length<3) return;
    const k = softKey(w); if(!k) return;
    if(!SIDX.has(k)) SIDX.set(k,new Map());
    const m = SIDX.get(k); m.set(w,(m.get(w)||0)+(n||1));
  };
  P.forEach(p => {
    [p.name,p.brand,p.cat,p.sub,p.alias,p.desc].filter(Boolean).join(' ')
      .toLowerCase().split(/[^a-z0-9]+/).forEach(w => add(w,1));
  });
  // The synonym table is vocabulary too: "vadachatti" should be reachable
  // from a misspelling even though no product name contains it.
  Object.keys(SYN).forEach(key => {
    SYN[key].concat([key]).forEach(w => {
      String(w).toLowerCase().split(/[^a-z0-9]+/).forEach(t => {
        if(t.length<3) return;
        const k=softKey(t); if(!k) return;
        if(!SIDX.has(k)) SIDX.set(k,new Map());
        const m=SIDX.get(k); if(!m.has(t)) m.set(t,1);
      });
    });
  });
  return SIDX;
}
const commonest = m => { let top=null,f=0; m.forEach((n,w)=>{ if(n>f){top=w;f=n;} }); return {word:top,freq:f}; };
const distAllowed = k => k.length<=3 ? 0 : k.length<=5 ? 1 : 2;

function bestWord(word){
  const idx = searchIndex(), k = softKey(word);
  if(!k) return null;
  if(idx.has(k)) return commonest(idx.get(k)).word;
  const max = distAllowed(k);
  if(!max) return null;
  let best=null, bestScore=Infinity;
  idx.forEach((words,key) => {
    const d = editDist(k,key,max);
    if(d>max) return;
    const c = commonest(words);
    // A wrong first letter is a much weaker guess than a middle
    // transposition; without this "bottel" corrects to "hotel".
    const score = d*100 + (key[0]===k[0]?0:40) + Math.abs(key.length-k.length)*3 - Math.min(c.freq,9);
    if(score<bestScore){ bestScore=score; best=c.word; }
  });
  return best;
}
function rewriteQuery(ql){
  const parts = String(ql||'').toLowerCase().split(/\s+/).filter(Boolean);
  if(!parts.length) return null;
  let changed = false;
  const out = parts.map(w => {
    if(SYN[w]) return w;
    const b = bestWord(w);
    if(b && b!==w){ changed=true; return b; }
    return w;
  });
  return changed ? out.join(' ') : null;
}

function matches(p, q){
  if(!q) return true;
  const h = hay(p), ql = String(q).toLowerCase().trim();
  // One- and two-letter tokens match on a word boundary, or "dh" hits
  // every kadhai and the result is noise.
  const has = t => t.length<=2
    ? new RegExp('(^|[^a-z0-9])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)').test(h)
    : h.includes(t);
  const hit = t => has(t) || (SYN[t]||[]).some(has);
  if(SYN[ql] && SYN[ql].some(has)) return true;
  return ql.split(/\s+/).filter(Boolean).every(hit);
}

/* One search, one answer object. `note` is set when we quietly respelt
   the query, so the screen can say so and offer the original back. */
function search(q, scope){
  const list = scope || live();
  const raw = String(q||'').trim();
  if(!raw) return {q:raw, hits:list, note:null};
  let hits = list.filter(p => matches(p, raw));
  if(hits.length) return {q:raw, hits, note:null};
  const fixed = rewriteQuery(raw);
  if(fixed){
    const second = list.filter(p => matches(p, fixed));
    if(second.length) return {q:fixed, hits:second, note:{shown:fixed, typed:raw}};
  }
  return {q:raw, hits:[], note:null};
}

/* ---------- 4b. promo strips --------------------------------------- */
/* A strip in config.js matches on FIVE things: words in the name, alias or
   sub-group, and exact sub / brand / category / code. The V4 hero used to
   link to a search for the first word only, so "Ganesh Chaturthi" — six
   products across two sub-groups — opened on the two called "modak" and
   the four samosa and gujiya moulds vanished. Same rule as V3 now, in one
   place, with a route of its own so the strip can be shared and gone back
   to. */
const allPromos = () => {
  const list = (CFG.promos && CFG.promos.length) ? CFG.promos.slice()
    : ((CFG.festive && CFG.festive.enabled) ? [Object.assign({id:'festive',tone:'festive'}, CFG.festive)] : []);
  return list.filter(x => x && x.enabled !== false);
};
function promoLive(pr){
  if(!pr) return false;
  const now = new Date();
  if(pr.from  && now < new Date(pr.from +'T00:00:00')) return false;
  if(pr.until && now > new Date(pr.until+'T23:59:59')) return false;
  return true;
}
function promoMatch(pr, p){
  const m = pr.match || {};
  if((m.codes ||[]).indexOf(p.code )>=0) return true;
  if((m.subs  ||[]).indexOf(p.sub  )>=0) return true;
  if((m.brands||[]).indexOf(p.brand)>=0) return true;
  if((m.cats  ||[]).indexOf(p.cat  )>=0) return true;
  const t = ((p.name||'')+' '+(p.alias||'')+' '+(p.sub||'')).toLowerCase();
  return (m.words||[]).some(w => t.indexOf(String(w).toLowerCase())>=0);
}
const promoById   = id => allPromos().find(x => x.id === id) || null;
const promoLiveOne= () => allPromos().find(promoLive) || null;
const promoProducts = pr => !pr ? [] : live().filter(p => promoMatch(pr, p)).slice(0, pr.max || 48);
function promoDaysLeft(pr){
  if(!pr || !pr.until) return null;
  const d = Math.ceil((new Date(pr.until+'T00:00:00') - new Date()) / 86400000);
  return d > 0 ? d : null;
}

/* ---------- 5. sort ------------------------------------------------ */
// "Suggested" is the hand-curated order the office maintains: the
// categories and brands they want seen first, in the sequence they gave.
const CAT_FIRST   = ['Cast Iron','Non-stick','Stainless Steel','Hotelware'];
const BRAND_FIRST = ['Paxton','Surya','Orbit'];
const rank = (list, v) => { const i = list.indexOf(v); return i<0 ? list.length : i; };

const SORTS = {
  suggested:  {label:'Suggested'},
  price_asc:  {label:'Rate: low to high'},
  price_desc: {label:'Rate: high to low'},
  name:       {label:'Name A–Z'},
  rated:      {label:'Best rated'},
};
/* A product with no rate on file is a real part of the catalogue and is
   never hidden — 127 of them are, and "we do not have the rate yet" is
   exactly the question a dealer wants to ask. But the hand-curated order
   puts Paxton cast iron first, and that brand has rates on 2 of its 12
   products, so the home screen's twelve-tile preview opened on ten tiles
   reading "Rate on request". This is a stable partition used ONLY for
   those previews: priced first, the curated order kept within each half,
   and nothing dropped. The full lists behind them are untouched. */
function pricedFirst(list){
  const yes = [], no = [];
  list.forEach(p => { const d = dpOf(p); (d ? yes : no).push(p); });
  return yes.concat(no);
}

function sortList(list, key, ratings){
  const a = list.slice();
  const lo = p => { const d=dpOf(p); return d ? d.lo : null; };
  switch(key){
    // Products with no rate sort last under both rate sorts. Treating a
    // missing rate as zero puts 127 unpriced products at the top of
    // "cheapest first", which is the opposite of useful.
    case 'price_asc':  return a.sort((x,y)=>{const p=lo(x),q=lo(y);
      if(p==null&&q==null) return 0; if(p==null) return 1; if(q==null) return -1; return p-q;});
    case 'price_desc': return a.sort((x,y)=>{const p=lo(x),q=lo(y);
      if(p==null&&q==null) return 0; if(p==null) return 1; if(q==null) return -1; return q-p;});
    case 'name':       return a.sort((x,y)=>x.name.localeCompare(y.name));
    case 'rated':      return a.sort((x,y)=>{
      const r = s => { const v=(ratings||{})[s]; return v&&v.n ? v.avg : -1; };
      return r(y.slug)-r(x.slug);});
    default: return a.sort((x,y)=>
      rank(CAT_FIRST,x.cat)-rank(CAT_FIRST,y.cat) ||
      rank(BRAND_FIRST,x.brand)-rank(BRAND_FIRST,y.brand) ||
      (y.feat?1:0)-(x.feat?1:0) ||
      x.name.localeCompare(y.name));
  }
}

/* ---------- 6. who is looking ------------------------------------- */
/* Never from a number typed into the page: the role comes from the
   caller's own catalog.allowlist row, which row-level security limits
   to that one row. */
let SESS = null;
const signedIn     = () => !!(SESS && SESS.ok);
const isEndCustomer= () => !!(SESS && SESS.role==='end_customer');
// Patel Marketing's own side of the counter takes orders, it does not
// place them — an order from the admin went to their own WhatsApp.
const isOffice     = () => !!(SESS && (SESS.admin || SESS.role==='staff'));
const isDealer     = () => !!(SESS && (SESS.role==='dealer' || SESS.role==='shop_owner'));
const canOrder     = () => signedIn() && !isEndCustomer() && !isOffice();
const roleLabel    = () => !signedIn() ? 'Browsing' :
  SESS.admin ? 'Admin' : SESS.role==='staff' ? 'Office' :
  SESS.role==='end_customer' ? 'Customer' : 'Dealer';

let RATINGS = {}, NOTICES = [], SHOP_OFFERS = {}, SHOP_INFO = null;

/* False until the first session lookup has come back, either way. It
   matters because the app paints before it knows who is looking — that
   is deliberate, the catalogue is public and nobody should watch a
   spinner to read it — but a route that is only for dealers must not
   decide anything while the answer is still in the air. Reloading on
   #/checkout used to bounce to the cart, and a bookmarked #/repeat/… to
   the order list, because canOrder() was still false when the route ran. */
let SESSION_SETTLED = false;
const sessionSettled = () => SESSION_SETTLED;

async function refreshSession(){
  // Settled in a finally, whatever happens. A lookup that throws must
  // still let the gated routes decide, or they sit on a skeleton for
  // ever — a worse failure than showing the signed-out screen.
  try{ return await doRefreshSession(); }
  finally{ SESSION_SETTLED = true; }
}
async function doRefreshSession(){
  const A = window.PMAuth;
  if(!A || !A.sb){ SESS=null; return null; }
  let sess=null;
  try{ sess = await A.currentSession(); }catch(e){}
  if(!sess){ SESS=null; loadSaved(); return null; }
  let row = null;
  try{ row = await A.myAllowlistRow(); }catch(e){}
  if(!row){
    // A lookup that failed is our fault, not theirs. Keep the Supabase
    // session — signing them out would cost another paid SMS to get back
    // to the same point.
    SESS = null;
  } else {
    const full = dg(sess.user && sess.user.phone), last = full.slice(-10);
    SESS = {ok:true, admin:!!row.is_admin, role:row.role||'dealer',
      name:row.name||'Signed in', phone:full, tail:last?'…'+last.slice(-3):'',
      shop:row.shop||'', ownerPhone:row.owner_phone||null, city:row.city||'',
      dealerType:row.dealer_type||null, gst:row.gst||'', photo:row.photo_url||''};
  }
  loadSaved();
  await Promise.all([loadRatings(), loadNotices(), loadShopOffers()]);
  return SESS;
}
async function loadRatings(){
  try{
    const {data,error} = await PMAuth.sb.from('product_rating_summary').select('*');
    if(error) return;                      // reviews are a bonus, never a blocker
    const m={}; (data||[]).forEach(r => { m[r.product_slug]={n:r.reviews, avg:Number(r.rating)}; });
    RATINGS = m;
  }catch(e){}
}
async function loadNotices(){
  try{
    const {data,error} = await PMAuth.sb.from('notices')
      .select('id,title,body,product_slug,tone,audience')
      .order('created_at',{ascending:false}).limit(4);
    NOTICES = error ? [] : (data||[]);
  }catch(e){ NOTICES=[]; }
}
// An end customer sees their shop's offer, never the dealer rate.
async function loadShopOffers(){
  SHOP_OFFERS={}; SHOP_INFO=null;
  if(!isEndCustomer()) return;
  try{
    const {data} = await PMAuth.sb.from('shop_offers').select('*');
    (data||[]).forEach(o => { SHOP_OFFERS[o.product_slug]=o; });
    const {data:shops} = await PMAuth.sb.from('allowlist')
      .select('phone,name,shop,city').in('role',['dealer','shop_owner']).limit(1);
    SHOP_INFO = (shops||[])[0] || null;
  }catch(e){}
}
const offerFor = p => SHOP_OFFERS[p.slug] || null;
function offerPrice(p, mrpVal){
  const o = offerFor(p);
  if(!o) return null;
  // A dealer sets a percentage off, capped at 25 by the database, rather
  // than a price of their own — so one product is never advertised at two
  // different prices by two shops.
  if(o.discount_pct && mrpVal!=null) return Math.round(mrpVal*(1-o.discount_pct/100));
  return o.price_offer!=null ? o.price_offer : null;
}

/* What a price looks like to whoever is holding the phone. One place. */
function priceView(p){
  const dp = dpOf(p), mrp = mrpOf(p);
  if(isEndCustomer()){
    const off = offerPrice(p, mrp ? mrp.lo : null);
    if(off!=null) return {now:rupee(off), was:mrp?fmtSpan(mrp):null, tag:'Shop offer'};
    if(mrp) return {now:fmtSpan(mrp), was:null, tag:'MRP'};
    return {ask:'Ask the shop'};
  }
  if(!signedIn()) return {locked:true, was:mrp?fmtSpan(mrp):null};
  if(!dp) return {ask:'Rate on request'};
  return {now:fmtSpan(dp), was:(mrp && (!dp || mrp.lo>dp.lo)) ? fmtSpan(mrp) : null, tag:null};
}

/* ---------- 7. saved + recently viewed ---------------------------- */
/* localStorage, not a table: no schema change, no policy, and it still
   works with no signal. The keys are V3's, so the two versions share
   one list rather than each keeping half of it. */
const SAVED_MAX=300, RECENT_MAX=24;
const savedKey  = () => 'v3_pm_saved_'  + ((SESS&&SESS.phone)||'guest');
const recentKey = () => 'v3_pm_recent_' + ((SESS&&SESS.phone)||'guest');
let SAVED = new Set();
function loadSaved(){
  try{ SAVED = new Set(JSON.parse(localStorage.getItem(savedKey())||'[]')); }
  catch(e){ SAVED = new Set(); }
}
function toggleSaved(slug){
  if(SAVED.has(slug)) SAVED.delete(slug); else SAVED.add(slug);
  try{ localStorage.setItem(savedKey(), JSON.stringify([...SAVED].slice(-SAVED_MAX))); }catch(e){}
  emit('saved', slug);
  return SAVED.has(slug);
}
const isSaved = s => SAVED.has(s);
const savedProducts = () => [...SAVED].map(bySlug).filter(Boolean).reverse();

function noteRecent(slug){
  try{
    let a = JSON.parse(localStorage.getItem(recentKey())||'[]');
    if(!Array.isArray(a)) a=[];
    a = [slug].concat(a.filter(x => x!==slug)).slice(0,RECENT_MAX);
    localStorage.setItem(recentKey(), JSON.stringify(a));
  }catch(e){}
}
function recentProducts(){
  try{
    const a = JSON.parse(localStorage.getItem(recentKey())||'[]');
    return (Array.isArray(a)?a:[]).map(bySlug).filter(Boolean);
  }catch(e){ return []; }
}
const RECENT_Q_KEY = 'v4_pm_recent_q';
function noteQuery(q){
  q = String(q||'').trim(); if(q.length<2) return;
  try{
    let a = JSON.parse(localStorage.getItem(RECENT_Q_KEY)||'[]');
    if(!Array.isArray(a)) a=[];
    a = [q].concat(a.filter(x => x.toLowerCase()!==q.toLowerCase())).slice(0,8);
    localStorage.setItem(RECENT_Q_KEY, JSON.stringify(a));
  }catch(e){}
}
function recentQueries(){
  try{ const a=JSON.parse(localStorage.getItem(RECENT_Q_KEY)||'[]'); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}

/* ---------- 8. the cart ------------------------------------------- */
/* A line is {slug,size,qty} and nothing else. Name, rate and unit are
   resolved from the catalogue every time it is drawn, which is what
   makes a repeat order pick up today's rates instead of last month's.
   Shares V3's key so an order started in one version finishes in the
   other. */
const CART_KEY = 'v3_pm_basket';
let CART = [];
try{ const s = JSON.parse(localStorage.getItem(CART_KEY)||'[]'); if(Array.isArray(s)) CART = s; }catch(e){}

function saveCart(){
  try{ localStorage.setItem(CART_KEY, JSON.stringify(CART)); }catch(e){}
  emit('cart');
}
const cartLine  = (slug,size) => CART.find(l => l.slug===slug && l.size===size);
const qtyFor    = (slug,size) => { const l=cartLine(slug,size); return l?l.qty:0; };
const cartCount = () => CART.reduce((n,l) => n+l.qty, 0);
const cartLines = () => CART.length;

// Where a supplier sets a minimum the quantity has to be a multiple of
// it — ordering 7 of something sold in boxes of 6 is not a thing anyone
// can supply.
function moqFor(slug,size){
  const p = bySlug(slug); if(!p) return 1;
  const row = sizesOf(p).find(v => v.size===size);
  return row ? (row.moq||1) : 1;
}
function setQty(slug,size,qty){
  const step = moqFor(slug,size);
  if(step>1 && qty>0) qty = Math.max(step, Math.round(qty/step)*step);
  const l = cartLine(slug,size);
  if(qty<=0){ if(l) CART.splice(CART.indexOf(l),1); }
  else if(l) l.qty = qty;
  else CART.push({slug,size,qty});
  saveCart();
  return qty>0 ? qty : 0;
}
const addToCart = (slug,size) => setQty(slug,size, qtyFor(slug,size) + moqFor(slug,size));
function clearCart(){ CART=[]; ORDER_REF=null; saveCart(); }

// One cart line, fully resolved against today's catalogue. Returns null
// for a line whose product or size has since gone — the caller counts
// those and says so rather than letting them vanish silently.
function resolveLine(l){
  const p = bySlug(l.slug); if(!p) return null;
  const v = sizesOf(p).find(x => x.size===l.size); if(!v) return null;
  return {slug:p.slug, name:p.name, brand:p.brand, code:p.code, img:p.img,
    size:v.size, unit:v.unit, price:v.price, mrp:v.mrp, moq:v.moq,
    qty:l.qty, ask:v.price==null};
}
const cartItems = () => CART.map(resolveLine).filter(Boolean);
function cartTotal(items){
  return (items||cartItems()).reduce((s,it) => s + (it.price!=null ? it.price*it.qty : 0), 0);
}
const cartHasAsk = items => (items||cartItems()).some(it => it.ask);

let ORDER_REF = null;
function orderRef(){
  if(ORDER_REF) return ORDER_REF;
  const d = new Date();
  const ds = d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const key = 'v3_pm_order_seq_'+ds;
  let n=1;
  try{ n = (parseInt(localStorage.getItem(key)||'0',10)||0)+1; localStorage.setItem(key,String(n)); }catch(e){}
  ORDER_REF = 'PM-'+ds+'-'+String(n).padStart(3,'0');
  return ORDER_REF;
}

/* ---------- 9. events (a tiny bus) -------------------------------- */
const LISTENERS = Object.create(null);
function on(name, fn){ (LISTENERS[name] = LISTENERS[name] || []).push(fn); }
function emit(name, arg){ (LISTENERS[name]||[]).forEach(fn => { try{ fn(arg); }catch(e){} }); }

/* ---------- 10. the log ------------------------------------------- */
/* What people searched for and could not find is the cheapest possible
   input to "what should we stock". Queued and flushed in batches; a
   failure to log is silent and never blocks anything. */
let QUEUE = [];
function logEvent(kind, fields){
  try{
    QUEUE.push(Object.assign({kind, at:new Date().toISOString(),
      phone:(SESS&&SESS.phone)||null, meta:{v:VERSION}}, fields||{}));
    if(QUEUE.length>=12) flushEvents();
  }catch(e){}
}
function flushEvents(){
  if(!QUEUE.length || !window.PMAuth || !PMAuth.sb) return;
  const batch = QUEUE; QUEUE = [];
  try{ PMAuth.sb.from('events').insert(batch).then(()=>{}, ()=>{}); }catch(e){}
}
setInterval(flushEvents, 20000);
document.addEventListener('visibilitychange', () => { if(document.hidden) flushEvents(); });

/* ---------- 11. the router ---------------------------------------- */
/* Every screen is a hash route, so every screen is a history entry and
   the phone's Back button and edge-swipe do what the reader expects
   without any of it being simulated. This is the whole reason V4 is not
   a pile of overlays: a customer opened a shared V3 link, pressed Back
   and the browser closed, because the product sheet had never been a
   history entry at all.

   Routes:
     #/                     home
     #/shop                 categories
     #/shop/:cat            one category
     #/search?q=            results
     #/product/:slug        one product
     #/cart  #/checkout     the order
     #/orders  #/orders/:id past orders
     #/saved  #/account  #/signin  #/settings  #/help
*/
const ROUTES = [];
function route(pattern, handler){
  const keys = [];
  const rx = new RegExp('^'+pattern.replace(/:([a-z]+)/gi, (_,k) => { keys.push(k); return '([^/?]+)'; })+'$');
  ROUTES.push({rx, keys, handler});
}
function parseHash(){
  let h = location.hash.replace(/^#/,'') || '/';
  if(h[0] !== '/') h = '/'+h;
  const qi = h.indexOf('?');
  const path = qi<0 ? h : h.slice(0,qi);
  const query = {};
  if(qi>=0) new URLSearchParams(h.slice(qi+1)).forEach((v,k) => { query[k]=v; });
  return {path, query, full:h};
}
let CURRENT = null;
function dispatch(){
  const {path, query, full} = parseHash();
  for(const r of ROUTES){
    const m = path.match(r.rx);
    if(!m) continue;
    const params = {};
    r.keys.forEach((k,i) => { params[k] = decodeURIComponent(m[i+1]); });
    CURRENT = {path, query, params, full};
    r.handler(params, query);
    return;
  }
  go('/', true);
}
// Navigate. `replace` swaps the current entry instead of adding one —
// used when a route corrects itself, never for an ordinary tap.
function go(to, replace){
  const target = '#'+(to[0]==='/'?to:'/'+to);
  if(location.hash === target){ dispatch(); return; }
  if(replace) history.replaceState(null,'',target); else location.hash = target;
  if(replace) dispatch();
}
const back = () => history.back();
// Where Back should land when the reader arrived by a shared link and
// has no trail of their own: the catalogue, never out of the site.
function backOrHome(){
  if(history.length > 1 && sessionStorage.getItem('v4_walked')==='1') history.back();
  else go('/');
}
window.addEventListener('hashchange', () => { sessionStorage.setItem('v4_walked','1'); dispatch(); });

/* ---------- 12. exports ------------------------------------------- */
return {
  VERSION, CFG,
  esc, rupee, money, dg, plural, IMG, THUMB,
  loadCatalogue, whenReady, get P(){return P}, live, bySlug,
  dpOf, mrpOf, fmtSpan, sizesOf, unitAbbr, unitOf, priceView,
  search, matches, rewriteQuery, SYN,
  allPromos, promoLive, promoMatch, promoById, promoLiveOne, promoProducts, promoDaysLeft,
  SORTS, sortList, pricedFirst, CAT_FIRST, BRAND_FIRST,
  refreshSession, get SESS(){return SESS},
  signedIn, isEndCustomer, isOffice, isDealer, canOrder, roleLabel, sessionSettled,
  get RATINGS(){return RATINGS}, get NOTICES(){return NOTICES},
  get SHOP_INFO(){return SHOP_INFO}, offerFor,
  loadSaved, toggleSaved, isSaved, savedProducts,
  noteRecent, recentProducts, noteQuery, recentQueries,
  get CART(){return CART}, cartLine, qtyFor, cartCount, cartLines, moqFor,
  setQty, addToCart, clearCart, cartItems, cartTotal, cartHasAsk, resolveLine, orderRef,
  on, emit, logEvent, flushEvents,
  route, go, back, backOrHome, dispatch, get CURRENT(){return CURRENT},
};
})();
