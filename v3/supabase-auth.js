/* Patel Marketing catalogue — v3 shared Supabase auth helpers.
   Loaded by both index.html and admin.html, after config.js and after the
   Supabase JS CDN script. Wraps phone OTP sign-in and the caller's own
   allowlist row (name, is_admin) behind window.PMAuth so neither page
   duplicates the Supabase wiring.

   Delivery goes: this page → Supabase Auth → the send-sms Edge Function →
   Fast2SMS. Supabase generates the code; the function only carries it.
   Which Fast2SMS route it goes out on is a secret, not code — see
   supabase/functions/send-sms/README.md. */
(function(){
  const CFG = window.PM_CONFIG || {};
  const SUPABASE_URL = CFG.supabaseUrl || 'https://vcrzauuxvgpsbforiszz.supabase.co';
  const SUPABASE_ANON_KEY = CFG.supabaseAnonKey ||
    'sb_publishable_HMTnoyLJiLTvtnoKad3koQ_CaKKj-5s';

  const dg = s => String(s || '').replace(/\D/g, '');
  const toE164 = digits => '+91' + dg(digits).slice(-10);

  // By default supabase-js serialises auth calls with a Web Lock
  // (navigator.locks), shared across every tab on the same origin. On a phone
  // with many tabs open, a backgrounded tab can be suspended while holding
  // that lock — and then every auth call in this tab waits on it forever:
  // no network request is ever made, no error is raised, the button just sits
  // there. That matches the failure seen on /v3/ exactly.
  //
  // This page only ever has one client doing auth, so cross-tab coordination
  // buys us nothing. Queue calls in-page instead: same ordering guarantee,
  // no dependency on a lock another tab might be sitting on.
  let chain = Promise.resolve();
  function inPageLock(_name, _acquireTimeout, fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {}); // never let a failure break the queue
    return run;
  }

  let sb = null;
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // Every table and function this app uses lives in the `catalog` schema,
      // not `public`. Without this the client silently queries public.* —
      // sb.from('allowlist') looks for public.allowlist, sb.rpc() looks for
      // public.<function> — and every one of them fails. The sign-in symptom
      // was the worst kind: the OTP verified fine, then the allowlist lookup
      // came back empty and the screen said "we do not recognise that number"
      // about a number that was plainly there.
      db: { schema: 'catalog' },
      auth: {
        storageKey: 'v3_sb_auth',
        persistSession: true,
        autoRefreshToken: true,
        lock: inPageLock,
      }
    });
  } catch (e) { /* CDN script failed to load — PMAuth degrades to signed-out */ }

  // Supabase's auth calls normally resolve with {data, error}. But a dropped
  // connection can make the underlying fetch reject, and an auth hook that
  // stalls (ours calls an SMS provider) can leave the request open with no
  // answer at all. Either way the caller's `await` would never come back and
  // the button would sit on "Sending…" forever with nothing to tell the
  // reader. settle() guarantees an answer: always an object, never a throw,
  // never longer than TIMEOUT_MS.
  // Takes a function, not a promise. If `sb.auth` is not the shape we expect
  // (a mismatched library build, say), calling the method throws
  // *synchronously* — and had we been handed the already-created promise, the
  // throw would happen while evaluating the argument, before this try block,
  // leaving the caller's await to reject and the button stuck. Starting the
  // call in here means a synchronous throw is caught too.
  const TIMEOUT_MS = 30000;
  async function settle(start, what) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(start),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(what + ' took too long. Please try again.')),
            TIMEOUT_MS,
          );
        }),
      ]);
    } catch (e) {
      // Surface the real reason rather than a generic failure — it is the
      // only diagnostic the person on the phone can read back to us.
      return { error: { message: (e && e.message) || (what + ' failed.') } };
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendOtp(phoneDigits) {
    if (!sb) return { error: { message: 'Sign-in could not load — check your connection and reload the page.' } };
    return settle(() => sb.auth.signInWithOtp({ phone: toE164(phoneDigits) }), 'Sending the code');
  }
  async function verifyOtp(phoneDigits, code) {
    if (!sb) return { error: { message: 'Sign-in could not load — check your connection and reload the page.' } };
    return settle(() => sb.auth.verifyOtp({ phone: toE164(phoneDigits), token: dg(code), type: 'sms' }), 'Checking the code');
  }
  async function currentSession() {
    if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data && data.session; }
    catch (e) { return null; }
  }
  // Filter by the caller's own phone rather than leaning on RLS to return a
  // single row. There are two SELECT policies on catalog.allowlist: everyone
  // may read their own row, but an admin may read them all. So for an admin
  // an unfiltered select returns every row, maybeSingle() rejects ("multiple
  // rows returned"), and the caller reads that failure as "not on the list" —
  // which is exactly how a real admin got told their number was unrecognised.
  // Why the last lookup came back empty. A failed lookup and a genuinely
  // absent row are indistinguishable to the caller otherwise, and the caller
  // reports both as "we do not recognise that number" — which is what let a
  // 404 masquerade as a rejected number for a whole round of testing.
  let lastLookupError = '';
  async function myAllowlistRow() {
    lastLookupError = '';
    if (!sb) { lastLookupError = 'client not created'; return null; }
    try {
      const session = await currentSession();
      const phone = dg(session && session.user && session.user.phone);
      if (!phone) { lastLookupError = 'no phone on the session'; return null; }
      const { data, error } = await sb
        .from('allowlist').select('*').eq('phone', phone).maybeSingle();
      if (error) {
        lastLookupError = (error.code ? error.code + ' ' : '') + (error.message || 'lookup failed');
        console.warn('allowlist lookup failed:', lastLookupError);
        return null;
      }
      if (!data) lastLookupError = 'no row for this number';
      return data || null;
    } catch (e) {
      lastLookupError = (e && e.message) || 'lookup threw';
      return null;
    }
  }
  function lookupError() { return lastLookupError; }
  async function signOut() {
    if (!sb) return;
    try { await sb.auth.signOut(); } catch (e) {}
  }
  function friendlyAuthError(error) {
    if (!error) return '';
    const m = error.message || '';
    if (error.status === 429 || /rate limit/i.test(m)) return 'Too many attempts. Please try again in an hour.';
    // Supabase reports a failing Send SMS hook as a bare status code, which
    // means nothing to the reader. The code is kept for us; the sentence is
    // for them.
    if (/from hook/i.test(m) || /\b50[0-9]\b/.test(m)) {
      return 'We could not send the code just now — the SMS service refused it. ' +
             'Please try again in a moment. (' + m + ')';
    }
    return m || 'Something went wrong — please try again.';
  }

  // Printed on the sign-in screen. Remote debugging is impossible here — the
  // live site is not reachable from where this gets written — so the page has
  // to be able to say for itself which build it is running and how far the
  // Supabase wiring got.
  const BUILD = 15;
  function diagnostics() {
    return {
      build: BUILD,
      lib: typeof window.supabase !== 'undefined' && !!window.supabase.createClient,
      client: !!sb,
      auth: !!(sb && sb.auth && typeof sb.auth.signInWithOtp === 'function'),
    };
  }
  function diagLine() {
    const d = diagnostics();
    return 'build ' + d.build +
      ' · library ' + (d.lib ? 'ok' : 'MISSING') +
      ' · client ' + (d.client ? 'ok' : 'FAILED') +
      ' · auth ' + (d.auth ? 'ok' : 'MISSING');
  }

  window.PMAuth = { sb, dg, toE164, sendOtp, verifyOtp, currentSession, myAllowlistRow, signOut, friendlyAuthError, diagnostics, diagLine, lookupError, BUILD };
})();
