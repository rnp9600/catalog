/* Patel Marketing catalogue — v3 shared Supabase auth helpers.
   Loaded by both index.html and admin.html, after config.js and after the
   Supabase JS CDN script. Wraps phone OTP sign-in and the caller's own
   allowlist row (name, is_admin) behind window.PMAuth so neither page
   duplicates the Supabase wiring.

   Real SMS delivery needs the MSG91 + DLT template hookup done once in the
   Supabase dashboard (Authentication → Providers → Phone). Until that is
   done, signInWithOtp() below will reach Supabase but no code will arrive
   by SMS — everything else keeps working. */
(function(){
  const CFG = window.PM_CONFIG || {};
  const SUPABASE_URL = CFG.supabaseUrl || 'https://vcrzauuxvgpsbforiszz.supabase.co';
  const SUPABASE_ANON_KEY = CFG.supabaseAnonKey ||
    'sb_publishable_HMTnoyLJiLTvtnoKad3koQ_CaKKj-5s';

  const dg = s => String(s || '').replace(/\D/g, '');
  const toE164 = digits => '+91' + dg(digits).slice(-10);

  let sb = null;
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: 'v3_sb_auth', persistSession: true, autoRefreshToken: true }
    });
  } catch (e) { /* CDN script failed to load — PMAuth degrades to signed-out */ }

  // Supabase's auth calls normally resolve with {data, error}. But a dropped
  // connection can make the underlying fetch reject, and an auth hook that
  // stalls (ours calls an SMS provider) can leave the request open with no
  // answer at all. Either way the caller's `await` would never come back and
  // the button would sit on "Sending…" forever with nothing to tell the
  // reader. settle() guarantees an answer: always an object, never a throw,
  // never longer than TIMEOUT_MS.
  const TIMEOUT_MS = 30000;
  async function settle(promise, what) {
    let timer;
    try {
      return await Promise.race([
        promise,
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
    return settle(sb.auth.signInWithOtp({ phone: toE164(phoneDigits) }), 'Sending the code');
  }
  async function verifyOtp(phoneDigits, code) {
    if (!sb) return { error: { message: 'Sign-in could not load — check your connection and reload the page.' } };
    return settle(sb.auth.verifyOtp({ phone: toE164(phoneDigits), token: dg(code), type: 'sms' }), 'Checking the code');
  }
  async function currentSession() {
    if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data && data.session; }
    catch (e) { return null; }
  }
  // RLS on catalog.allowlist restricts SELECT to the signed-in caller's own
  // row (phone = auth.jwt()->>'phone'), so this never sees anyone else's.
  async function myAllowlistRow() {
    if (!sb) return null;
    try { const { data } = await sb.from('allowlist').select('*').maybeSingle(); return data || null; }
    catch (e) { return null; }
  }
  async function signOut() {
    if (!sb) return;
    try { await sb.auth.signOut(); } catch (e) {}
  }
  function friendlyAuthError(error) {
    if (!error) return '';
    const m = error.message || '';
    if (error.status === 429 || /rate limit/i.test(m)) return 'Too many attempts. Please try again in an hour.';
    return m || 'Something went wrong — please try again.';
  }

  window.PMAuth = { sb, dg, toE164, sendOtp, verifyOtp, currentSession, myAllowlistRow, signOut, friendlyAuthError };
})();
