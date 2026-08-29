/* Patel Marketing catalogue — v2 settings.

   v3: sign-in numbers no longer live here. They are in Supabase's
   catalog.allowlist table behind phone OTP — nobody can read the customer
   list from the page source any more. supabaseAnonKey below is meant to be
   public: it is the publishable key, restricted by row-level security on
   the database side, not a secret. */

window.PM_CONFIG = {

  firm: 'Patel Marketing',
  tagline: 'Wholesale Kitchenware',
  whatsapp: '917892967505',
  site: 'https://patelmarketing-catalog.vercel.app',

  supabaseUrl: 'https://vcrzauuxvgpsbforiszz.supabase.co',
  supabaseAnonKey: 'sb_publishable_HMTnoyLJiLTvtnoKad3koQ_CaKKj-5s',

  auth: {
    noAccessMessage: 'We do not recognise that number yet.',
  },

  festive: {
    enabled: true,
    title: 'Ganesh Chaturthi',
    note:  'Modak and gujiya moulds — order now for the festival rush',
    from:  '2026-08-01',
    until: '2026-09-24',
    match: {
      words:  ['modak','gujiya','karanji','samosa','sansa','ghughra'],
      subs:   ['Samosa & Gujiya Moulds'],
      brands: [], codes: [],
    },
  },

  motion: 'full',
};
