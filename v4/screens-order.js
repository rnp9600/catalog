/* Patel Marketing V4 — the order.
   ------------------------------------------------------------------
   Cart → checkout → placed → history → repeat. Four routes, so every
   step is somewhere Back can return to and a half-finished checkout is
   never lost to a stray swipe.

   The order goes on the books first, through catalog.place_order. If
   that call fails we still let them send it on WhatsApp — a customer's
   order must not be lost because our database was unreachable — but the
   screen says plainly that it was not recorded.
   ------------------------------------------------------------------ */
(function(){
'use strict';
const {esc, money, rupee} = PM;
const {icon, img, stepper, sheet, closeSheet, toast, empty, header, headerAction,
       waitingForSession} = UI;
const view = () => document.getElementById('view');
const scrollTop = () => { const m=document.querySelector('main'); if(m) m.scrollTop=0; window.scrollTo(0,0); };
const waNumber = () => { const n=String(PM.CFG.whatsapp||'').replace(/\D/g,'');
  return n.length>=10 ? n : '917892967505'; };

/* ============ cart ================================================= */
PM.route('/cart', function(){
  if(waitingForSession('Your order')) return;
  header({back:true, title:'Your order', actions:
    PM.CART.length ? [headerAction('trash','id="cartClear"','Empty the order')] : []});
  drawCart();
  const c = document.getElementById('cartClear');
  if(c) c.onclick = () => sheet({
    title:'Empty this order?',
    body:'<p class="muted">Every line goes. Nothing has been sent, so there is nothing to cancel with us.</p>',
    foot:'<div class="btnrow"><button class="btn btn-secondary" data-sheet-close>Keep it</button>'+
         '<button class="btn btn-danger" id="yesClear">Empty it</button></div>',
    wire(el){ el.querySelector('#yesClear').onclick = () => {
      closeSheet(); PM.clearCart(); toast('Order emptied'); PM.dispatch(); }; }
  });
});

function drawCart(){
  const box = view();
  if(!PM.canOrder()){
    box.innerHTML = PM.signedIn()
      ? empty('bag', PM.isOffice() ? 'The office takes orders, it does not place them'
                                   : 'Orders go through your shop',
          PM.isOffice() ? 'Open the order book to see what dealers have sent in.'
                        : 'Ask your shop for anything you have saved — they order for you.',
          PM.isOffice() ? '<a class="btn btn-primary" href="../orders.html">Open the order book</a>'
                        : '<a class="btn btn-primary" href="#/saved">See what you saved</a>')
      : empty('bag','Sign in to build an order',
          'Trade rates and the order pad are for dealer accounts. Sign in with your phone number.',
          '<a class="btn btn-primary" href="#/signin">Sign in</a>');
    return;
  }
  const items = PM.cartItems();
  const dropped = PM.CART.length - items.length;
  if(!items.length){
    box.innerHTML = empty('bag','Your order is empty',
      'Add sizes from any product. Quantities can be changed here before you send it.',
      '<div class="btnrow" style="max-width:360px;margin:0 auto">'+
      '<a class="btn btn-secondary" href="#/shop">Browse</a>'+
      '<a class="btn btn-primary" href="#/orders">Repeat a past order</a></div>');
    return;
  }
  const total = PM.cartTotal(items), ask = PM.cartHasAsk(items);
  box.innerHTML =
    (dropped ? '<div class="strip" style="margin-top:12px">'+dropped+' '+
      PM.plural(dropped,'line')+' dropped — no longer in the catalogue</div>' : '')+
    '<p class="tiny muted" style="margin:12px 2px 6px">'+items.length+' '+
      PM.plural(items.length,'line')+' · '+PM.cartCount()+' '+PM.plural(PM.cartCount(),'piece')+'</p>'+
    '<div class="card card-pad" id="cartLines">'+items.map(lineHtml).join('')+'</div>'+
    '<div class="card card-pad" style="margin-top:12px">'+
      '<div class="sumline"><span>Items</span><span class="num">'+items.length+'</span></div>'+
      '<div class="sumline"><span>Pieces</span><span class="num">'+PM.cartCount()+'</span></div>'+
      (ask ? '<div class="sumline"><span>Rates to confirm</span><span class="num">'+
        items.filter(i=>i.ask).length+'</span></div>' : '')+
      '<div class="sumline total"><span>Total</span><span class="num">'+
        (total ? rupee(total) : '—')+'</span></div>'+
      (ask ? '<p class="tiny muted" style="margin-top:8px">Lines with no rate are on the order '+
        'with the rate left open. We will confirm them when we reply.</p>' : '')+
      '<p class="tiny muted" style="margin-top:8px">GST and freight are added on the invoice.</p>'+
    '</div>'+
    '<div style="margin-top:14px"><a class="btn btn-primary btn-lg btn-block" href="#/checkout">'+
      'Continue'+(total?' · '+rupee(total):'')+'</a></div>'+
    '<div style="margin-top:8px"><a class="btn btn-quiet btn-block" href="#/shop">Add more items</a></div>';

  // Redraw in place as quantities change, rather than re-running the
  // route: re-running would scroll the page back to the top under the
  // reader's thumb while they are still adjusting a line.
  PM.on('cart', function redraw(){
    if(!/^#\/cart/.test(location.hash)) return;
    const box2 = document.getElementById('cartLines');
    if(!box2) return;
    const now = PM.cartItems();
    if(!now.length){ drawCart(); return; }
    box2.innerHTML = now.map(lineHtml).join('');
    const t = PM.cartTotal(now);
    document.querySelectorAll('.sumline .num').forEach(() => {});
    drawTotals(now, t);
  });
}
function drawTotals(items, total){
  const card = document.querySelectorAll('.card-pad')[1];
  if(!card) return;
  const sums = card.querySelectorAll('.sumline');
  if(sums[0]) sums[0].lastElementChild.textContent = items.length;
  if(sums[1]) sums[1].lastElementChild.textContent = PM.cartCount();
  const tot = card.querySelector('.sumline.total');
  if(tot) tot.lastElementChild.textContent = total ? rupee(total) : '—';
  const cta = document.querySelector('a.btn-lg[href="#/checkout"]');
  if(cta) cta.textContent = 'Continue'+(total?' · '+rupee(total):'');
}

function lineHtml(it){
  return '<div class="lrow">'+
    '<a class="lrow-img" href="#/product/'+encodeURIComponent(it.slug)+'">'+img(it.img, it.name)+'</a>'+
    '<div class="lrow-main">'+
      '<a href="#/product/'+encodeURIComponent(it.slug)+'" style="color:inherit"><b>'+esc(it.name)+'</b></a>'+
      '<div class="sub">'+esc(it.size==='Standard'?PM.unitAbbr(it.unit):it.size)+
        (it.price!=null ? ' · '+money(it.price)+' / '+PM.unitAbbr(it.unit) : ' · rate on request')+
        (it.moq>1 ? ' · in '+it.moq+'s' : '')+'</div>'+
      '<div class="row" style="margin-top:7px">'+
        stepper(it.slug, it.size, it.qty)+
        '<button class="iconbtn" data-stepper="'+esc(it.slug)+'" data-size="'+esc(it.size)+'" '+
          'data-drop="1" aria-label="Remove '+esc(it.name)+'">'+icon('trash')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="lrow-side"><b class="num">'+(it.price!=null?rupee(it.price*it.qty):'—')+'</b></div>'+
  '</div>';
}
document.addEventListener('click', function(e){
  const drop = e.target.closest('[data-drop]');
  if(!drop) return;
  e.preventDefault();
  const box = drop.closest('[data-stepper]') || drop;
  PM.setQty(box.getAttribute('data-stepper'), box.getAttribute('data-size'), 0);
  toast('Removed');
}, true);

/* ============ checkout ============================================= */
PM.route('/checkout', function(){
  if(waitingForSession('Send the order')) return;
  if(!PM.canOrder()){ PM.go('/cart', true); return; }
  const items = PM.cartItems();
  if(!items.length){ PM.go('/cart', true); return; }
  const S = PM.SESS || {};
  const total = PM.cartTotal(items);

  header({back:true, title:'Send the order'});
  view().innerHTML =
    '<p class="tiny muted" style="margin:12px 2px">Check who this is coming from. The office sees '+
      'exactly what you type here, which is what lets you order for a branch under a different name.</p>'+
    '<div class="card card-pad">'+
      '<label class="field"><span>Your name</span>'+
        '<input class="input" id="coName" autocomplete="name" value="'+
        esc(S.name && S.name!=='Signed in' ? S.name : '')+'" placeholder="Name"></label>'+
      '<label class="field"><span>Shop</span>'+
        '<input class="input" id="coShop" autocomplete="organization" value="'+esc(S.shop||'')+'" '+
        'placeholder="Shop or firm"></label>'+
      '<label class="field"><span>Phone</span>'+
        '<div class="row"><span class="badge badge-quiet">+91</span>'+
        '<input class="input grow" id="coPhone" inputmode="numeric" autocomplete="tel-national" '+
        'maxlength="10" value="'+esc((S.phone||'').slice(-10))+'" placeholder="10 digits"></div></label>'+
      '<label class="field" style="margin-bottom:0"><span>Anything to add</span>'+
        '<textarea class="input" id="coNote" placeholder="Delivery, packing, transport — optional"></textarea></label>'+
    '</div>'+

    '<section class="section"><div class="section-head"><h2>'+items.length+' '+
      PM.plural(items.length,'line')+'</h2><a class="more" href="#/cart">Edit</a></div>'+
      '<div class="card card-pad">'+
      items.map(it => '<div class="sumline"><span class="grow">'+it.qty+' × '+esc(it.name)+
        (it.size!=='Standard'?' <span class="muted">('+esc(it.size)+')</span>':'')+'</span>'+
        '<span class="num">'+(it.price!=null?rupee(it.price*it.qty):'—')+'</span></div>').join('')+
      '<div class="sumline total"><span>Total</span><span class="num">'+
        (total?rupee(total):'—')+'</span></div>'+
      '</div></section>'+

    '<div id="coErr"></div>'+
    '<div style="margin-top:16px"><button class="btn btn-primary btn-lg btn-block" id="coPlace">'+
      'Place this order</button></div>'+
    '<p class="tiny muted" style="margin:10px 2px 0;text-align:center">'+
      'We reply on WhatsApp with the confirmed rates.</p>';
  scrollTop();
  document.getElementById('coPlace').onclick = placeOrder;
});

function readMeta(){
  const name = document.getElementById('coName').value.trim();
  const shop = document.getElementById('coShop').value.trim();
  const phone = PM.dg(document.getElementById('coPhone').value).slice(-10);
  const note = document.getElementById('coNote').value.trim();
  const err = document.getElementById('coErr');
  const fail = m => { err.innerHTML = '<div class="strip" style="background:var(--bad-wash);color:var(--bad)">'+
    esc(m)+'</div>'; return null; };
  if(!name) return fail('Please put a name on the order.');
  if(!shop) return fail('Please put the shop or firm name on the order.');
  if(phone.length!==10) return fail('That phone number needs ten digits.');
  err.innerHTML = '';
  return {name, shop, phone, note};
}

async function placeOrder(){
  const meta = readMeta(); if(!meta) return;
  const items = PM.cartItems(); if(!items.length) return;
  const btn = document.getElementById('coPlace');
  btn.disabled = true; btn.textContent = 'Placing…';

  let ref = PM.orderRef(), recorded = false;
  try{
    const {data,error} = await PMAuth.sb.rpc('place_order', {
      p_customer: null,
      // What they typed, which can differ from what we have on file: the
      // office should see the name and shop the order came in as.
      p_note: 'From: '+meta.name+' · '+meta.shop+' · +91'+meta.phone+
              (meta.note ? ' · '+meta.note : ''),
      p_items: items.map(it => ({slug:it.slug, name:it.name, size:it.size,
        unit:it.unit, qty:it.qty, price:it.price, mrp:it.mrp})),
    });
    if(!error && data){
      ref = data; recorded = true;
      PM.logEvent('order', {n:items.length,
        meta:{ref, pieces:items.reduce((a,i)=>a+i.qty,0), v:PM.VERSION}});
      PM.flushEvents();
    }
  }catch(e){}

  // Hold the lines for the follow-ups, then clear the cart: the order has
  // been placed, and leaving it filled invites placing it twice.
  LAST = {items, meta, ref, recorded, at:new Date()};
  try{ sessionStorage.setItem('v4_last_order', JSON.stringify({ref, recorded})); }catch(e){}
  PM.clearCart();
  btn.disabled = false; btn.textContent = 'Place this order';
  PM.go('/placed/'+encodeURIComponent(ref));
}

/* ============ order placed ========================================= */
let LAST = null;
PM.route('/placed/:ref', function(params){
  const ref = params.ref;
  header({back:false, title:'Order sent'});
  // The header on this screen has no Back arrow on purpose: going back
  // from a placed order lands on an empty checkout, and the one thing
  // this screen must not invite is placing it twice.
  document.getElementById('topbar').innerHTML =
    '<div class="topbar-in"><h1>Order sent</h1><a class="iconbtn" href="#/" aria-label="Home">'+
    icon('home')+'</a></div>';

  const info = LAST && LAST.ref===ref ? LAST : null;
  const recorded = info ? info.recorded : true;

  view().innerHTML =
    '<div class="card card-pad" style="margin-top:16px;text-align:center">'+
      '<div style="width:56px;height:56px;border-radius:50%;background:var(--ok-wash);color:var(--ok);'+
        'display:grid;place-items:center;margin:6px auto 12px">'+icon('receipt')+'</div>'+
      '<h2 style="font-size:1.15rem;font-weight:750;letter-spacing:-.02em">'+
        (recorded ? 'We have your order' : 'Send it to us')+'</h2>'+
      '<p class="muted tiny" style="margin-top:6px;line-height:1.55">'+
        (recorded
          ? 'It is on our books. We will reply on WhatsApp with the confirmed rates.'
          : 'We could not reach our system just now, so this is not recorded yet. '+
            'Send it on WhatsApp and it reaches us straight away.')+'</p>'+
      '<div class="badge badge-quiet" style="margin-top:12px;font-family:var(--mono);font-size:.8rem">'+
        esc(ref)+'</div>'+
    '</div>'+
    (info ? '<div class="btnrow" style="margin-top:14px">'+
      '<button class="btn btn-primary" id="opWa">'+icon('wa')+'Send on WhatsApp</button>'+
      '<button class="btn btn-secondary" id="opPdf">'+icon('pdf')+'Save PDF</button></div>' : '')+
    '<div class="btnrow" style="margin-top:8px">'+
      '<a class="btn btn-secondary" href="#/orders">Your orders</a>'+
      '<a class="btn btn-quiet" href="#/">Keep browsing</a></div>';
  scrollTop();

  if(info){
    document.getElementById('opWa').onclick = () => {
      window.open('https://wa.me/'+waNumber()+'?text='+
        encodeURIComponent(waOrderText(info.items, info.meta, ref)), '_blank','noopener');
    };
    document.getElementById('opPdf').onclick = () => printOrder(info.items, info.meta, ref);
  }
});

function waOrderText(items, meta, ref){
  const L = ['New order — '+ref, '',
    'Name: '+meta.name, 'Shop: '+meta.shop, 'Phone: +91 '+meta.phone, ''];
  items.forEach(it => {
    let line = it.qty+' × '+it.name+(it.size && it.size!=='Standard' ? ' ('+it.size+')' : '')+
      ' — '+PM.unitAbbr(it.unit);
    line += it.price!=null ? ' · ₹'+it.price+' = ₹'+(it.price*it.qty) : ' · rate on request';
    L.push(line);
  });
  const t = PM.cartTotal(items);
  if(t) L.push('', 'Grand total: ₹'+t.toLocaleString('en-IN'));
  if(meta.note) L.push('', 'Note: '+meta.note);
  L.push('', 'Sent from the Patel Marketing catalogue.');
  return L.join('\n');
}

/* Printing is the PDF. The browser's own "save as PDF" is on every
   phone, needs no library, and produces a file the office can read —
   a 300KB PDF generator to save one page is not a trade worth making. */
function printOrder(items, meta, ref){
  const t = PM.cartTotal(items);
  document.getElementById('printsheet').innerHTML =
    '<h1>Order form</h1>'+
    '<div class="pmeta"><b>'+esc(meta.shop||meta.name)+'</b><br>'+esc(meta.name)+
      ' · +91 '+esc(meta.phone)+'<br>Ref '+esc(ref)+' · '+
      new Date().toLocaleDateString('en-IN')+'</div>'+
    '<table><thead><tr><th>Product</th><th>Size</th><th>Unit</th><th class="num">Qty</th>'+
    '<th class="num">Rate</th><th class="num">Value</th></tr></thead><tbody>'+
    items.map(it => '<tr><td>'+esc(it.name)+'<br><small>'+esc(it.brand||'')+
      (it.code?' · '+esc(it.code):'')+'</small></td><td>'+esc(it.size)+'</td><td>'+
      esc(PM.unitAbbr(it.unit))+'</td><td class="num">'+it.qty+'</td><td class="num">'+
      (it.price!=null?'₹'+it.price:'on request')+'</td><td class="num">'+
      (it.price!=null?'₹'+(it.price*it.qty):'—')+'</td></tr>').join('')+
    '</tbody><tfoot><tr><td colspan="5">Grand total</td><td class="num">'+
    (t?'₹'+t.toLocaleString('en-IN'):'—')+'</td></tr></tfoot></table>'+
    (meta.note ? '<p><b>Note:</b> '+esc(meta.note)+'</p>' : '')+
    '<p class="foot">Patel Marketing · Wholesale Kitchenware · WhatsApp '+waNumber()+
    '<br>GST and freight are added on the invoice.</p>';
  window.print();
}

/* ============ order history ======================================== */
let ORDERS = null;
PM.route('/orders', function(){
  if(waitingForSession('Your orders')) return;
  header({back:true, title:'Your orders', actions:
    PM.canOrder() && PM.cartCount() ? ['<a class="iconbtn" href="#/cart" aria-label="Your order">'+
      icon('bag')+'<span class="dot num">'+PM.cartCount()+'</span></a>'] : []});

  if(!PM.signedIn()){
    view().innerHTML = empty('receipt','Sign in to see your orders',
      'Every order you have sent is kept against your number.',
      '<a class="btn btn-primary" href="#/signin">Sign in</a>');
    return;
  }
  if(PM.isOffice()){
    view().innerHTML =
      '<div class="menulist" style="margin-top:14px">'+
      '<a class="menurow" href="../orders.html">'+icon('receipt')+
        '<div class="grow"><b>The order book</b><small>Every order that came in</small></div>'+
        '<span class="chev">'+icon('chev')+'</span></a>'+
      '<a class="menurow" href="../admin.html">'+icon('edit')+
        '<div class="grow"><b>Admin panel</b><small>Rates, photos, stock</small></div>'+
        '<span class="chev">'+icon('chev')+'</span></a>'+
      '</div>';
    return;
  }

  view().innerHTML =
    (PM.canOrder() && PM.cartCount()
      ? '<a class="card card-pad" href="#/cart" style="display:flex;align-items:center;gap:11px;'+
        'margin-top:12px;color:inherit">'+icon('bag')+
        '<div class="grow"><b style="font-size:.88rem">'+PM.cartCount()+' '+
        PM.plural(PM.cartCount(),'item')+' not sent yet</b>'+
        '<div class="tiny muted">Finish the order you started</div></div>'+
        '<span class="chev">'+icon('chev')+'</span></a>' : '')+
    '<div id="orderList"><div class="skeleton" style="height:86px;margin-top:12px"></div>'+
    '<div class="skeleton" style="height:86px;margin-top:9px"></div></div>';
  scrollTop();
  loadOrders();
});

async function loadOrders(){
  const box = document.getElementById('orderList');
  if(!box) return;
  try{
    const {data,error} = await PMAuth.sb.from('order_summary').select('*')
      .order('created_at',{ascending:false}).limit(60);
    if(error) throw error;
    ORDERS = data||[];
  }catch(e){
    box.innerHTML = '<div class="strip" style="background:var(--bad-wash);color:var(--bad)">'+
      'Could not load your orders just now. They are safe — try again in a moment.</div>';
    return;
  }
  if(!document.getElementById('orderList')) return;
  if(!ORDERS.length){
    box.innerHTML = empty('receipt','No orders yet',
      'Add sizes to your order from any product, then send it. It will show up here.',
      '<a class="btn btn-primary" href="#/shop">Start an order</a>');
    return;
  }
  box.innerHTML = ORDERS.map(orderCard).join('');
}

const STATUS = {
  new:['badge-brand','New'], confirmed:['badge-ok','Confirmed'],
  packed:['badge-ok','Packed'], dispatched:['badge-ok','Dispatched'],
  completed:['badge-quiet','Completed'], cancelled:['badge-bad','Cancelled'],
};
function orderCard(o){
  const st = STATUS[o.status] || ['badge-quiet', o.status||'Sent'];
  const when = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN',
    {day:'numeric',month:'short',year:'numeric'}) : '';
  return '<div class="ordercard">'+
    '<div class="top"><span class="ref">'+esc(o.ref||('#'+o.id))+'</span>'+
      '<span class="badge '+st[0]+'">'+esc(st[1])+'</span>'+
      '<span class="grow"></span><span class="when">'+esc(when)+'</span></div>'+
    '<div class="row" style="gap:12px">'+
      '<div class="grow tiny muted">'+(o.lines!=null ? o.lines+' '+PM.plural(o.lines,'line') : '')+
        (o.pieces!=null ? ' · '+o.pieces+' '+PM.plural(o.pieces,'piece') : '')+
        (o.total!=null ? ' · '+money(o.total) : '')+'</div>'+
      '<a class="btn btn-quiet btn-sm" href="#/orders/'+encodeURIComponent(o.id)+'">Details</a>'+
      (PM.canOrder() ? '<a class="btn btn-secondary btn-sm" href="#/repeat/'+
        encodeURIComponent(o.id)+'">'+icon('repeat')+'Repeat</a>' : '')+
    '</div></div>';
}

/* One past order, in full. */
PM.route('/orders/:id', function(params){
  header({back:true, title:'Order'});
  view().innerHTML = '<div class="skeleton" style="height:200px;margin-top:14px"></div>';
  scrollTop();
  loadOrderDetail(params.id, false);
});

async function loadOrderDetail(id, forRepeat){
  let head = (ORDERS||[]).find(o => String(o.id)===String(id)) || null;
  let lines = [];
  try{
    if(!head){
      const {data} = await PMAuth.sb.from('order_summary').select('*').eq('id',id).maybeSingle();
      head = data || null;
    }
    const {data:ls, error} = await PMAuth.sb.from('order_items').select('*')
      .eq('order_id', id).order('sort');
    if(error) throw error;
    lines = ls || [];
  }catch(e){
    view().innerHTML = '<div class="strip" style="background:var(--bad-wash);color:var(--bad)">'+
      'Could not open that order just now.</div>';
    return;
  }
  if(forRepeat) return drawRepeat(head, lines);
  drawOrderDetail(head, lines);
}

function drawOrderDetail(head, lines){
  const st = STATUS[head && head.status] || ['badge-quiet','Sent'];
  const when = head && head.created_at
    ? new Date(head.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',
        hour:'numeric',minute:'2-digit'}) : '';
  const total = lines.reduce((s,l) => s + ((l.price!=null?l.price:0) * (l.qty||0)), 0);
  view().innerHTML =
    '<div class="card card-pad" style="margin-top:14px">'+
      '<div class="row"><span class="ref" style="font-family:var(--mono);font-weight:600">'+
        esc((head&&head.ref)||'')+'</span><span class="badge '+st[0]+'">'+esc(st[1])+'</span></div>'+
      '<div class="tiny muted" style="margin-top:4px">'+esc(when)+'</div>'+
      (head && head.note ? '<p class="tiny muted" style="margin-top:8px">'+esc(head.note)+'</p>' : '')+
    '</div>'+
    '<section class="section"><div class="section-head"><h2>'+lines.length+' '+
      PM.plural(lines.length,'line')+'</h2></div>'+
      '<div class="card card-pad">'+lines.map(l => {
        const p = PM.bySlug(l.product_slug);
        return '<div class="lrow">'+
          (p ? '<a class="lrow-img" href="#/product/'+encodeURIComponent(p.slug)+'">'+
                img(p.img, l.name)+'</a>' : '<span class="lrow-img"></span>')+
          '<div class="lrow-main"><b>'+esc(l.name||'')+'</b><div class="sub">'+
            esc(l.size||'')+' · '+l.qty+' × '+(l.price!=null?money(l.price):'rate on request')+'</div></div>'+
          '<div class="lrow-side"><b class="num">'+
            (l.price!=null?rupee(l.price*l.qty):'—')+'</b></div></div>';
      }).join('')+
      '<div class="sumline total"><span>Total</span><span class="num">'+
        (total?rupee(total):'—')+'</span></div></div></section>'+
    (PM.canOrder() ? '<div style="margin-top:14px">'+
      '<a class="btn btn-primary btn-block" href="#/repeat/'+encodeURIComponent(head?head.id:'')+'">'+
      icon('repeat')+'Repeat this order</a></div>' : '');
}

/* ============ repeat =============================================== */
/* A repeat is a review, not a shortcut. Every line comes back with a
   stepper and a remove, because a month later the quantities are never
   the same and a dealer who cannot change them just abandons the whole
   thing and searches for each product again. */
let REPEAT = null;
PM.route('/repeat/:id', function(params){
  if(waitingForSession('Repeat order')) return;
  if(!PM.canOrder()){ PM.go('/orders', true); return; }
  header({back:true, title:'Repeat order'});
  view().innerHTML = '<div class="skeleton" style="height:220px;margin-top:14px"></div>';
  scrollTop();
  loadOrderDetail(params.id, true);
});

function drawRepeat(head, lines){
  REPEAT = {
    ref: head && head.ref,
    lines: lines.map(l => {
      const p = PM.bySlug(l.product_slug);
      const row = p ? PM.sizesOf(p).find(v => v.size===l.size) : null;
      return {slug:l.product_slug, name:l.name, size:l.size, qty:l.qty||1,
        gone: !p || !row, img:p?p.img:null,
        price: row ? row.price : null, unit: row ? row.unit : (l.unit||'Piece'),
        moq: row ? row.moq : 1, wasPrice: l.price};
    }),
  };
  paintRepeat();
}

function paintRepeat(){
  const live = REPEAT.lines.filter(l => !l.gone);
  const gone = REPEAT.lines.filter(l => l.gone);
  const chosen = live.filter(l => l.qty>0);
  const total = chosen.reduce((s,l) => s + (l.price!=null ? l.price*l.qty : 0), 0);

  view().innerHTML =
    '<p class="tiny muted" style="margin:12px 2px">Everything from '+esc(REPEAT.ref||'that order')+
      ', at today’s rates. Change the quantities or drop what you do not need, '+
      'then add it to your order.</p>'+
    (gone.length ? '<div class="strip">'+gone.length+' '+PM.plural(gone.length,'item')+
      ' from that order '+(gone.length===1?'is':'are')+' no longer in the catalogue</div>' : '')+
    '<div class="card card-pad" style="margin-top:12px" id="repLines">'+
      (live.length ? live.map(repeatRow).join('')
                   : '<p class="muted tiny">Nothing from that order is still available.</p>')+
    '</div>'+
    (live.length ? '<div class="card card-pad" style="margin-top:12px">'+
      '<div class="sumline"><span>Lines</span><span class="num">'+chosen.length+'</span></div>'+
      '<div class="sumline total"><span>Total</span><span class="num">'+
        (total?rupee(total):'—')+'</span></div></div>'+
      '<div style="margin-top:14px"><button class="btn btn-primary btn-lg btn-block" id="repAdd"'+
        (chosen.length?'':' disabled')+'>Add '+chosen.length+' '+
        PM.plural(chosen.length,'line')+' to my order</button></div>' : '')+
    '<div style="margin-top:8px"><a class="btn btn-quiet btn-block" href="#/orders">Back to orders</a></div>';

  document.querySelectorAll('#repLines [data-rep]').forEach(b => {
    b.onclick = () => {
      const i = Number(b.getAttribute('data-rep'));
      const act = b.getAttribute('data-act');
      const l = REPEAT.lines[i];
      if(act==='drop') l.qty = 0;
      else l.qty = Math.max(0, l.qty + Number(act)*(l.moq||1));
      paintRepeat();
    };
  });
  const add = document.getElementById('repAdd');
  if(add) add.onclick = () => {
    let n = 0;
    REPEAT.lines.forEach(l => { if(!l.gone && l.qty>0){ PM.setQty(l.slug, l.size, l.qty); n++; } });
    UI.toast(n+' '+PM.plural(n,'line')+' added to your order');
    PM.go('/cart');
  };
}

function repeatRow(l){
  const i = REPEAT.lines.indexOf(l);
  const dim = l.qty>0 ? '' : ' style="opacity:.45"';
  return '<div class="lrow"'+dim+'>'+
    '<a class="lrow-img" href="#/product/'+encodeURIComponent(l.slug)+'">'+img(l.img, l.name)+'</a>'+
    '<div class="lrow-main"><b>'+esc(l.name||'')+'</b>'+
      '<div class="sub">'+esc(l.size||'')+' · '+
        (l.price!=null ? money(l.price)+' / '+PM.unitAbbr(l.unit) : 'rate on request')+
        (l.wasPrice!=null && l.price!=null && l.wasPrice!==l.price
          ? ' <span class="badge badge-warn">was '+money(l.wasPrice)+'</span>' : '')+
        (l.moq>1 ? ' · in '+l.moq+'s' : '')+'</div>'+
      '<div class="row" style="margin-top:7px">'+
        '<div class="stepper">'+
          '<button data-rep="'+i+'" data-act="-1" aria-label="One less">−</button>'+
          '<span class="n num">'+l.qty+'</span>'+
          '<button data-rep="'+i+'" data-act="1" aria-label="One more">+</button>'+
        '</div>'+
        '<button class="iconbtn" data-rep="'+i+'" data-act="drop" aria-label="Remove">'+
          icon('trash')+'</button>'+
      '</div></div>'+
    '<div class="lrow-side"><b class="num">'+
      (l.price!=null && l.qty ? rupee(l.price*l.qty) : '—')+'</b></div>'+
  '</div>';
}
})();
