/* Patel Marketing — signing up, and being let in.
   ------------------------------------------------------------------
   Before this, a number the allowlist did not know hit a wall: "we do
   not recognise that number", and the only way past it was to telephone
   the office and have an admin type you in. Every dealer, every member
   of staff, one at a time, by hand.

   Now the OTP proves the phone and the form does the rest. What you are
   applying to BE decides which form you get, who is told about it, and
   who may say yes:

     dealer        a business buying to resell — firm name, area, GST if
                   they have one, and plenty do not
     end customer  buying for their own kitchen — attached to a shop if
                   they name one, otherwise somebody has to place them
     staff         Patel Marketing's own — and a department, because a
                   delivery boy and an accountant need different things

   Nothing here decides anything. Every rule about who may approve what
   lives in the database (catalog.can_approve), so a screen that got it
   wrong would still be refused.
   ------------------------------------------------------------------ */
(function(){
'use strict';
const {esc} = PM;
const {icon, sheet, closeSheet, toast, empty, header, headerAction, waitingForSession} = UI;
const view = () => document.getElementById('view');
const scrollTop = () => { const m=document.querySelector('main'); if(m) m.scrollTop=0; window.scrollTo(0,0); };
const waNumber = () => { const n=String(PM.CFG.whatsapp||'').replace(/\D/g,'');
  return n.length>=10 ? n : '917892967505'; };
const site = () => (PM.CFG.site || location.origin);

/* What the applicant typed, kept across the two steps so going Back to
   change an answer does not empty the form. */
let FORM = null;

/* ============ 1. which kind of person is this? ===================== */
/* The one question that has to be asked plainly. "Dealer" and "customer"
   are trade words; a person signing up on their phone needs to be asked
   what they DO, not which of our categories they fall into. */
PM.route('/join', function(){
  if(waitingForSession('Join')) return;
  if(PM.signedIn()){ PM.go('/account', true); return; }
  const st = PM.SIGNUP;
  // Already applied? Then this screen is the wrong one.
  if(st && (st.status === 'pending' || st.status === 'rejected')){ PM.go('/join/status', true); return; }

  header({back:true, title:'Set up your account'});
  view().innerHTML =
    '<p class="tiny muted" style="margin:14px 2px 12px;line-height:1.6">'+
      'Your number is confirmed. Tell us who you are and the office will switch '+
      'the account on — usually the same day.</p>'+
    '<div class="menulist">'+
      pick('tag','dealer','I run a business',
           'A shop, a firm or a stall buying to sell on. You get trade rates and the order pad.')+
      pick('user','end_customer','I am buying for myself',
           'For your own kitchen or home. You see your shop’s prices and offers.')+
      pick('shield','staff','I work at Patel Marketing',
           'Office, sales, accounts, purchase, delivery or collection.')+
    '</div>'+
    '<div class="strip" style="margin-top:16px">'+
      '<div class="grow">Not sure? Ask us and we will set it up for you.</div>'+
      '<button class="btn btn-quiet btn-sm" id="joinWa">'+icon('wa')+'Ask</button>'+
    '</div>';
  scrollTop();
  view().querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
    FORM = Object.assign({}, FORM, {kind:b.getAttribute('data-kind')});
    PM.go('/join/form');
  });
  document.getElementById('joinWa').onclick = () => openWa(
    'Hello Patel Marketing, I would like an account on the catalogue. '+
    'My number is +91'+tail()+'.');
});

const pick = (ic, kind, title, blurb) =>
  '<button class="menurow" data-kind="'+kind+'">'+icon(ic)+
  '<div class="grow"><b>'+esc(title)+'</b><small>'+esc(blurb)+'</small></div>'+
  '<span class="chev">'+icon('chev')+'</span></button>';

const tail = () => {
  try{
    const s = PM.SESS;
    if(s && s.phone) return s.phone.slice(-10);
  }catch(e){}
  return (window.__PM_PHONE_TAIL || '');
};

/* ============ 2. the form ========================================== */
PM.route('/join/form', function(){
  if(waitingForSession('Your details')) return;
  if(PM.signedIn()){ PM.go('/account', true); return; }
  if(!FORM || !FORM.kind){ PM.go('/join', true); return; }
  const kind = FORM.kind;
  const isDealer = kind === 'dealer';
  const isStaff  = kind === 'staff';

  header({back:true, title: isDealer ? 'Your business'
                        : isStaff  ? 'Your role' : 'Your details'});

  const f = (id, label, opts) => {
    const o = opts || {};
    return '<label class="field"><span>'+esc(label)+(o.optional?' <span class="muted">— optional</span>':'')+'</span>'+
      (o.textarea
        ? '<textarea class="input" id="'+id+'" placeholder="'+esc(o.ph||'')+'">'+esc(FORM[o.key||id]||'')+'</textarea>'
        : '<input class="input" id="'+id+'" '+(o.attrs||'')+' placeholder="'+esc(o.ph||'')+'" '+
          'value="'+esc(FORM[o.key||id]||'')+'">')+
      (o.help?'<span class="help">'+esc(o.help)+'</span>':'')+'</label>';
  };

  view().innerHTML =
    '<div class="card card-pad" style="margin-top:14px">'+
      // The nickname sits at the top and is the only blank on an otherwise
      // filled form. Where it is set the office sees it; where it is not
      // they see "Firm (Area)", which is how two Sharma Traders are told
      // apart at the counter.
      f('jNick', isStaff ? 'What the office should call you' : 'Nickname',
        {optional:true, key:'nickname',
         ph: isDealer ? 'e.g. Sharma bhai' : 'e.g. Anita',
         help:'Leave it blank and we will use your '+(isDealer?'firm and area':'name and area')+'.'})+
      f('jName','Your name',{key:'name', attrs:'autocomplete="name"', ph:'Full name'})+
      (isDealer ? f('jBiz','Business name',{key:'business_name',
                    attrs:'autocomplete="organization"', ph:'Firm or shop name'}) : '')+
      (isStaff ? '<label class="field"><span>Department</span>'+
        '<select class="input" id="jDept"><option value="">Choose…</option>'+
        PM.DEPARTMENTS.map(d => '<option value="'+esc(d.id)+'"'+
          (FORM.dept===d.id?' selected':'')+'>'+esc(d.label)+'</option>').join('')+
        '</select><span class="help">This decides what you are shown and what you can approve.</span></label>' : '')+
      f('jArea','Area',{key:'area', ph:'e.g. Gokul Road',
        help:'Shown next to your name so the office knows which one you are.'})+
      f('jCity','City',{key:'city', attrs:'autocomplete="address-level2"', ph:'Hubli'})+
      (isDealer || kind==='end_customer'
        ? f('jAddr','Address',{optional:true, key:'address', textarea:true, ph:'Shop or delivery address'}) : '')+
      (isDealer ? gstBlock() : '')+
      (kind==='end_customer'
        ? f('jOwner','The shop you buy from',{optional:true, key:'owner_phone',
            attrs:'inputmode="numeric" maxlength="10"', ph:'Their 10-digit number',
            help:'If you know it, we put you straight onto their list.'}) : '')+
      f('jNote','Anything else',{optional:true, key:'note', textarea:true,
        ph: isDealer ? 'What you sell, how many shops' : ''})+
    '</div>'+
    '<div id="jErr"></div>'+
    '<div style="margin-top:14px"><button class="btn btn-primary btn-lg btn-block" id="jSend">'+
      'Send to the office</button></div>'+
    '<p class="tiny muted" style="margin:10px 2px 0;text-align:center;line-height:1.55">'+
      'Nothing is switched on until someone has looked at it. '+
      'You can browse the catalogue while you wait.</p>';
  scrollTop();
  wireGst();
  document.getElementById('jSend').onclick = send;

  function gstBlock(){
    const st = FORM.gst_status || '';
    return '<div class="field"><span>GST</span>'+
      '<div class="segmented" id="jGstSeg" style="margin-bottom:8px">'+
        '<button data-gst="registered"'+(st==='registered'?' class="on"':'')+'>Registered</button>'+
        '<button data-gst="unregistered"'+(st==='unregistered'?' class="on"':'')+'>Not registered</button>'+
      '</div>'+
      '<input class="input" id="jGst" placeholder="GST number"'+
        (st==='registered'?'':' hidden')+' value="'+esc(FORM.gst||'')+'">'+
      '<span class="help">Plenty of our dealers are not registered. It changes nothing here.</span>'+
      '</div>';
  }
  function wireGst(){
    const seg = document.getElementById('jGstSeg'); if(!seg) return;
    seg.querySelectorAll('[data-gst]').forEach(b => b.onclick = () => {
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      FORM.gst_status = b.getAttribute('data-gst');
      const box = document.getElementById('jGst');
      box.hidden = FORM.gst_status !== 'registered';
      if(box.hidden) box.value = '';
    });
  }

  function read(){
    const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    return {
      kind,
      nickname: v('jNick'), name: v('jName'),
      business_name: v('jBiz'), area: v('jArea'), city: v('jCity'),
      address: v('jAddr'), note: v('jNote'),
      dept: (document.getElementById('jDept')||{}).value || '',
      gst: v('jGst'), gst_status: FORM.gst_status || '',
      owner_phone: PM.dg(v('jOwner')).slice(-10),
    };
  }
  async function send(){
    const p = read();
    FORM = Object.assign({}, FORM, p);          // keep it across a Back
    const err = document.getElementById('jErr');
    const fail = m => { err.innerHTML = '<div class="strip" style="background:var(--bad-wash);'+
      'color:var(--bad)">'+esc(m)+'</div>'; scrollTo(0, err.offsetTop-120); };
    if(!p.name) return fail('Please put in your name.');
    if(isDealer && !p.business_name) return fail('Please put in the business name.');
    if(isStaff && !p.dept) return fail('Please choose a department.');
    if(!p.area) return fail('Please put in your area — it is how the office tells people apart.');
    err.innerHTML = '';

    const btn = document.getElementById('jSend');
    btn.disabled = true; btn.textContent = 'Sending…';
    try{
      await PM.submitSignup(p);
    }catch(e){
      btn.disabled = false; btn.textContent = 'Send to the office';
      return fail((e && e.message) || 'Could not send that just now.');
    }
    btn.disabled = false; btn.textContent = 'Send to the office';
    PM.go('/join/status');
  }
});

/* ============ 3. where it stands =================================== */
PM.route('/join/status', function(){
  if(waitingForSession('Your application')) return;
  const st = PM.SIGNUP;
  if(PM.signedIn()){ PM.go('/account', true); return; }
  if(!st || st.status === 'none'){ PM.go('/join', true); return; }

  const rejected = st.status === 'rejected';
  header({back:true, title: rejected ? 'Not approved' : 'With the office'});

  view().innerHTML =
    '<div class="card card-pad" style="margin-top:16px;text-align:center">'+
      '<div style="width:56px;height:56px;border-radius:50%;margin:6px auto 12px;display:grid;'+
        'place-items:center;background:'+(rejected?'var(--bad-wash);color:var(--bad)':'var(--warn-wash);color:var(--warn)')+'">'+
        icon(rejected?'info':'clock')+'</div>'+
      '<h2 style="font-size:1.1rem;font-weight:750;letter-spacing:-.02em">'+
        (rejected ? 'We could not approve this yet' : 'Sent — waiting on the office')+'</h2>'+
      '<p class="muted tiny" style="margin-top:8px;line-height:1.6">'+
        (rejected
          ? (st.decided_note ? esc(st.decided_note)
             : 'Give us a ring or send a message and we will sort it out.')
          : 'Someone will look at it and switch the account on, usually the same day. '+
            'You can browse the catalogue in the meantime.')+'</p>'+
      (st.created_at ? '<div class="badge badge-quiet" style="margin-top:12px">Sent '+
        new Date(st.created_at).toLocaleDateString('en-IN',
          {day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+'</div>' : '')+
    '</div>'+

    // The nudge that actually gets these looked at. The office lives on
    // WhatsApp, so the whole form goes there as text with a link that opens
    // it — and if the person who taps that link is signed in as an admin or
    // an office manager, it opens straight onto the approve screen.
    '<div style="margin-top:14px"><button class="btn btn-primary btn-block" id="stWa">'+
      icon('wa')+(rejected ? 'Message the office' : 'Send it to the office on WhatsApp')+'</button></div>'+
    (rejected ? '<div style="margin-top:8px"><a class="btn btn-secondary btn-block" href="#/join">'+
      'Start again</a></div>' : '')+
    '<div class="btnrow" style="margin-top:8px">'+
      '<a class="btn btn-quiet" href="#/">Browse the catalogue</a>'+
      '<button class="btn btn-quiet" id="stAgain">Check again</button>'+
    '</div>';
  scrollTop();

  document.getElementById('stWa').onclick = () => openWa(waText(st));
  document.getElementById('stAgain').onclick = async function(){
    this.disabled = true; this.textContent = 'Checking…';
    await PM.refreshSession();
    UI.tabbar(); UI.cartbar();
    this.disabled = false; this.textContent = 'Check again';
    if(PM.signedIn()){ toast('You are in — welcome'); PM.go('/account', true); }
    else { PM.dispatch(); toast('Still with the office'); }
  };
});

function waText(st){
  const f = FORM || {};
  const L = ['Patel Marketing — account request', ''];
  L.push('Name: '+(f.name||''));
  if(f.nickname) L.push('Nickname: '+f.nickname);
  if(f.business_name) L.push('Business: '+f.business_name);
  if(f.dept) L.push('Department: '+f.dept);
  if(f.area) L.push('Area: '+f.area);
  if(f.city) L.push('City: '+f.city);
  if(f.address) L.push('Address: '+f.address);
  if(f.gst_status) L.push('GST: '+(f.gst_status==='registered' ? (f.gst||'registered') : 'not registered'));
  if(f.owner_phone) L.push('Buys from: +91'+f.owner_phone);
  if(f.note) L.push('Note: '+f.note);
  L.push('Phone: +91'+tail(), '');
  if(st && st.id) L.push('Open it: '+site()+'/#/approve/'+st.id);
  return L.join('\n');
}
const openWa = text =>
  window.open('https://wa.me/'+waNumber()+'?text='+encodeURIComponent(text), '_blank', 'noopener');

/* ============ 4. the queue ========================================= */
/* Only reachable by someone the database says may decide something, and
   it lists only what they may decide — the view does that filtering, so
   this screen cannot show more than it should even if it tried. */
PM.route('/approvals', function(){
  if(waitingForSession('Approvals')) return;
  if(!PM.CAN_APPROVE){ PM.go('/account', true); return; }
  header({back:true, title:'Approvals'});
  view().innerHTML = '<div class="skeleton" style="height:96px;margin-top:14px"></div>'+
                     '<div class="skeleton" style="height:96px;margin-top:9px"></div>';
  scrollTop();
  PM.loadDepartments().then(drawQueue);
});

async function drawQueue(highlight){
  let rows;
  try{ rows = await PM.loadApprovals(); }
  catch(e){
    view().innerHTML = '<div class="strip" style="background:var(--bad-wash);color:var(--bad)">'+
      'Could not load the queue just now.</div>';
    return;
  }
  if(!/^#\/approvals/.test(location.hash)) return;
  const pending = rows.filter(r => r.status === 'pending');
  const done    = rows.filter(r => r.status !== 'pending').slice(0, 20);

  view().innerHTML =
    (pending.length
      ? '<p class="tiny muted" style="margin:14px 2px 10px">'+pending.length+' waiting</p>'+
        pending.map(r => card(r, r.id === highlight)).join('')
      : empty('shield','Nothing waiting',
          'New dealers, customers and staff show up here as they apply.'))+
    (done.length ? '<section class="section"><div class="section-head"><h2>Recently decided</h2></div>'+
      done.map(r => card(r, false)).join('')+'</section>' : '');

  view().querySelectorAll('[data-decide]').forEach(b => b.onclick = () => {
    const id = Number(b.getAttribute('data-decide'));
    const ok = b.getAttribute('data-ok') === '1';
    confirmDecision(rows.find(r => r.id === id), ok);
  });
}

// The id is what the database stores; the label is what the office says.
const deptLabel = id => {
  if(!id) return '';
  const d = (PM.DEPARTMENTS||[]).find(x => x.id === id);
  return d ? d.label : id;
};

const KIND = {dealer:['badge-brand','Dealer'], staff:['badge-gold','Staff'],
              end_customer:['badge-quiet','Customer']};
const STATUS = {pending:['badge-warn','Waiting'], approved:['badge-ok','Approved'],
                rejected:['badge-bad','Not approved']};

function card(r, highlight){
  const k = KIND[r.kind] || ['badge-quiet', r.kind];
  const s = STATUS[r.status] || ['badge-quiet', r.status];
  const when = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN',
    {day:'numeric',month:'short'}) : '';
  const line = (label, val) => val
    ? '<div class="sumline"><span class="muted">'+esc(label)+'</span><span>'+esc(val)+'</span></div>' : '';
  return '<div class="ordercard"'+(highlight?' style="border-color:var(--brand);border-width:2px"':'')+'>'+
    '<div class="top"><span class="badge '+k[0]+'">'+k[1]+'</span>'+
      '<span class="badge '+s[0]+'">'+s[1]+'</span>'+
      '<span class="grow"></span><span class="when">'+esc(when)+'</span></div>'+
    '<b style="font-size:.95rem;font-weight:730;display:block">'+esc(r.display)+'</b>'+
    '<div class="tiny muted num" style="margin:2px 0 8px">+91 '+esc(String(r.phone).slice(-10))+'</div>'+
    line('Name', r.name!==r.display ? r.name : '')+
    line('Department', deptLabel(r.dept))+
    line('City', r.city)+
    line('GST', r.gst_status==='registered' ? (r.gst||'registered') : (r.gst_status ? 'Not registered' : ''))+
    line('Address', r.address)+
    line('Buys from', r.owner_phone ? '+91'+String(r.owner_phone).slice(-10) : '')+
    line('Note', r.note)+
    line('Decided by', r.decided_by ? '+91'+String(r.decided_by).slice(-10) : '')+
    line('Reason', r.decided_note)+
    (r.status === 'pending'
      ? '<div class="btnrow" style="margin-top:10px">'+
        '<button class="btn btn-danger btn-sm" data-decide="'+r.id+'" data-ok="0">Not now</button>'+
        '<button class="btn btn-primary btn-sm" data-decide="'+r.id+'" data-ok="1">Approve</button>'+
        '</div>' : '')+
  '</div>';
}

function confirmDecision(r, ok){
  if(!r) return;
  sheet({
    title: ok ? 'Approve '+r.display+'?' : 'Turn this down?',
    body: ok
      ? '<p class="muted" style="line-height:1.6">They become a <b>'+
        esc((KIND[r.kind]||['','']) [1].toLowerCase())+'</b> straight away and can sign in on '+
        'their own number.'+(r.kind==='end_customer' && !r.owner_phone
          ? ' Nobody has claimed them yet, so we will flag it for sales.' : '')+'</p>'
      : '<p class="muted" style="line-height:1.6">They are told, and they can apply again. '+
        'A reason helps — they see it.</p>'+
        '<label class="field" style="margin-top:12px"><span>Reason — optional</span>'+
        '<input class="input" id="decNote" placeholder="e.g. we could not place the shop"></label>',
    foot:'<div class="btnrow"><button class="btn btn-secondary" data-sheet-close>Cancel</button>'+
         '<button class="btn '+(ok?'btn-primary':'btn-danger')+'" id="decGo">'+
         (ok?'Approve':'Turn down')+'</button></div>',
    wire(el){
      el.querySelector('#decGo').onclick = async function(){
        const note = (el.querySelector('#decNote')||{}).value || null;
        this.disabled = true; this.textContent = 'Saving…';
        try{ await PM.decideSignup(r.id, ok, note); }
        catch(e){
          this.disabled = false; this.textContent = ok?'Approve':'Turn down';
          toast((e && e.message) || 'Could not record that');
          return;
        }
        closeSheet();
        toast(ok ? r.display+' is in' : 'Turned down');
        drawQueue();
      };
    }});
}

/* One request, opened straight from the WhatsApp link. Whoever taps it
   gets what their account allows: the approve screen if they may decide,
   and otherwise their own status. */
PM.route('/approve/:id', function(params){
  if(waitingForSession('Request')) return;
  if(!PM.CAN_APPROVE){
    // Not a decider. If it is their own application, show them that.
    if(PM.SIGNUP && PM.SIGNUP.status !== 'none' && !PM.signedIn()){ PM.go('/join/status', true); return; }
    header({back:true, title:'Request'});
    view().innerHTML = empty('shield','That link is for the office',
      'It opens an account request. Only an admin or the office can act on it.',
      '<a class="btn btn-primary" href="#/">Go to the catalogue</a>');
    return;
  }
  header({back:true, title:'Request'});
  view().innerHTML = '<div class="skeleton" style="height:180px;margin-top:14px"></div>';
  scrollTop();
  PM.go('/approvals', true);
  setTimeout(() => drawQueue(Number(params.id)), 0);
});

/* ============ 5. notifications ===================================== */
PM.route('/notifications', function(){
  if(waitingForSession('Notifications')) return;
  header({back:true, title:'Notifications'});
  view().innerHTML = '<div class="skeleton" style="height:70px;margin-top:14px"></div>'+
                     '<div class="skeleton" style="height:70px;margin-top:9px"></div>';
  scrollTop();
  drawNotifications();
});

async function drawNotifications(){
  const rows = await PM.loadNotifications();
  if(!/^#\/notifications/.test(location.hash)) return;
  if(!rows.length){
    view().innerHTML = empty('bell','Nothing yet',
      'New applications and anything that needs your department show up here.');
    return;
  }
  view().innerHTML = '<div class="menulist" style="margin-top:14px">'+rows.map(n => {
    const when = new Date(n.created_at).toLocaleDateString('en-IN',
      {day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
    const href = n.ref_id ? '#/approve/'+n.ref_id : '#/approvals';
    return '<a class="menurow" href="'+href+'">'+
      icon(n.kind==='customer_unattached' ? 'user' : 'shield')+
      '<div class="grow"><b>'+esc(n.title)+(n.is_read?'':' <span class="badge badge-brand">new</span>')+'</b>'+
      '<small>'+esc(n.body||'')+' · '+esc(when)+'</small></div>'+
      '<span class="chev">'+icon('chev')+'</span></a>';
  }).join('')+'</div>';
  PM.markNotificationsRead(rows.filter(n => !n.is_read).map(n => n.id));
}

window.PM_SIGNUP_FORM = () => FORM;
})();
