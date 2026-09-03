/* Patel Marketing — shared bits for the four signed-in pages.

   admin.html, orders.html, shop.html and exchange.html each used to carry
   their own copy of everything below: the config fallback merge, the whole
   phone/OTP sign-in gate, the account button, the type-a-name product lookup,
   and the small formatting helpers.

   Four copies is not just untidy, it drifts, and it had:

     money(null)   admin printed  ₹NaN
                   shop  printed  (nothing)
                   orders/exchange printed  —
     findProduct() shop and exchange called text.trim() on a value orders
                   guarded as (text||''), so an undefined argument threw
     the account button
                   exchange still had the old dropdown with its own Sign out
                   in it, months after the other three moved to "sign out
                   lives in exactly one place, on the catalogue"

   The guarded behaviour wins in each case. Loaded after supabase-auth.js,
   because the gate calls PMAuth. Exposes one global, PMUI.

   Every page keeps its own markup and its own start(row) — this file assumes
   the gate element ids only (#gate #gp #gb #gm #gEcho #gStepPhone #gStepOtp
   #gCode #gv #gBack #gOtpTo), which all four already shared. */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const dg = s => String(s || '').replace(/\D/g, '');
  const last10 = s => dg(s).slice(-10);

  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // A missing rate is a real and common state in this catalogue — 127 products
  // carry no rate at all — so it has to render as something a person can read.
  const money = n => n == null || n === '' || isNaN(Number(n))
    ? '—' : '₹' + Number(n).toLocaleString('en-IN');

  const IMG = n => 'images/' + n + '.jpg';

  /* The per-page defaults merged over config.js. supabase-auth.js carries the
     same URL/key fallbacks itself, so this really only matters for `whatsapp`
     and the auth copy — but it stays because a page should not depend on the
     order two other files happen to load in. */
  function config(defaults) {
    const D = defaults || {};
    const K = window.PM_CONFIG || {};
    const M = Object.assign({}, D, K);
    if (D.auth || K.auth) M.auth = Object.assign({}, D.auth || {}, K.auth || {});
    if (!M.supabaseUrl) M.supabaseUrl = D.supabaseUrl;
    if (!M.supabaseAnonKey) M.supabaseAnonKey = D.supabaseAnonKey;
    if (D.whatsapp && (!M.whatsapp || dg(M.whatsapp).length < 10)) M.whatsapp = D.whatsapp;
    window.PM_CONFIG = M;
    return M;
  }

  /* The header shows whose account this is, not the word "Account": the photo
     they uploaded, or their initials. It links to the catalogue's account
     screen, which is the only place sign out lives — so there is deliberately
     no sign-out button here, on any of these pages. */
  function accountMenu(row) {
    const btn = document.getElementById('acctBtn');
    if (!btn) return;
    const name = (row && (row.nickname || row.name || row.shop)) || '';
    const what = row && row.is_admin ? 'admin'
      : row && row.role === 'staff' ? 'office'
      : row && (row.role === 'dealer' || row.role === 'shop_owner') ? 'dealer' : '';
    const initials = String(name).replace(/[^A-Za-z ]/g, '').trim().split(/\s+/)
      .slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'PM';
    const photo = row && row.photo_url;
    btn.innerHTML = photo
      ? '<img src="' + String(photo).replace(/"/g, '&quot;') + '" alt="">'
      : esc(initials);
    btn.title = (name || 'Your account') + (what ? ' · ' + what : '');
    btn.setAttribute('aria-label', btn.title);
  }

  /* Type a product name, get the product. The list is passed in because each
     page loads its own copy of data.json into its own P. */
  function findProduct(text, list) {
    const P = list || window.P || [];
    const whole = String(text || '').trim().toLowerCase();
    const head = whole.split(' — ')[0].trim();
    return P.find(p => String(p.name || '').toLowerCase() === head) ||
      P.find(p => (p.name + ' — ' + (p.code || '')).toLowerCase() === whole) || null;
  }

  /* The sign-in gate. Callers supply only what actually differs between the
     four pages:

       allow(row)  may this person open this page at all
       refusal     what to say to someone who signed in but may not
       onReady(row)  the page's own start()

     Everything else — the digit echo, the test-number PIN path, Enter to
     submit, the back step, resuming an existing session — is the same on all
     four and lives here. */
  function gate(opts) {
    const allow = opts.allow || (r => !!r);
    const refusal = opts.refusal || 'That number signed in, but it does not have access to this screen.';
    const onReady = opts.onReady;
    let pending = null;

    const msg = t => { const m = $('#gm'); m.textContent = t; m.classList.add('on'); };
    const clearMsg = () => $('#gm').classList.remove('on');
    const toPhoneStep = () => {
      $('#gStepOtp').style.display = 'none';
      $('#gStepPhone').style.display = 'block';
    };

    $('#gp').oninput = function () {
      const d = dg($('#gp').value);
      $('#gEcho').textContent = d.length >= 10
        ? 'Signing in as +91 ' + d.slice(-10)
        : (d.length ? d.length + ' of 10 digits' : '');
    };
    $('#gp').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#gb').click(); } };

    $('#gb').onclick = async function () {
      const raw = dg($('#gp').value);
      clearMsg();
      if (raw.length < 10) {
        msg('That is only ' + raw.length + ' digit' + (raw.length === 1 ? '' : 's') +
          '. Type the 10-digit number — 91 in front is fine too.');
        return;
      }
      // Test numbers carry a PIN instead of a texted code — no SMS, no cost.
      const testNo = !!(window.PMAuth.isTestNumber && PMAuth.isTestNumber(raw));
      if (!testNo) {
        const gb = $('#gb');
        gb.disabled = true; gb.textContent = 'Sending…';
        const { error } = await PMAuth.sendOtp(raw);
        gb.disabled = false; gb.textContent = 'Send code';
        if (error) { msg(PMAuth.friendlyAuthError(error)); return; }
      }
      pending = raw;
      $('#gOtpTo').textContent = testNo
        ? 'Test account. No SMS is sent for these — type the 6-digit PIN.'
        : 'Sent by SMS to +91 ' + raw.slice(-10) + '. It can take a minute to arrive.';
      $('#gCode').placeholder = testNo ? '6-digit PIN' : '6-digit code';
      $('#gStepPhone').style.display = 'none';
      $('#gStepOtp').style.display = 'block';
      $('#gCode').focus();
    };

    $('#gBack').onclick = function () {
      pending = null; clearMsg(); toPhoneStep(); $('#gp').focus();
    };
    $('#gCode').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#gv').click(); } };

    $('#gv').onclick = async function () {
      const code = dg($('#gCode').value);
      clearMsg();
      if (code.length < 4) { msg('Enter the code as texted to you.'); return; }
      const isTest = !!(PMAuth.isTestNumber && PMAuth.isTestNumber(pending));
      const gv = $('#gv');
      gv.disabled = true; gv.textContent = isTest ? 'Signing in…' : 'Verifying…';
      const { error } = isTest ? await PMAuth.signInWithPin(pending, code)
        : await PMAuth.verifyOtp(pending, code);
      gv.disabled = false; gv.textContent = isTest ? 'Sign in' : 'Verify & sign in';
      if (error) { msg(PMAuth.friendlyAuthError(error)); return; }
      pending = null;
      const row = await PMAuth.myAllowlistRow();
      if (!row || !allow(row)) {
        await PMAuth.signOut();
        msg(refusal);
        toPhoneStep();
        return;
      }
      onReady(row);
    };

    // Someone already signed in on this device goes straight through.
    (async function () {
      const sess = await PMAuth.currentSession();
      if (!sess) return;
      const row = await PMAuth.myAllowlistRow();
      if (row && allow(row)) onReady(row); else await PMAuth.signOut();
    })();
  }

  window.PMUI = { $, dg, last10, esc, money, IMG, config, accountMenu, findProduct, gate };
})();
