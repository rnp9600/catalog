/* Patel Marketing catalogue — v3 settings.

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

  /* Strips across the top of the catalogue. Add as many as you like — a
     festival, a clearance, a new range — and they appear in this order.

       enabled  turn one off without deleting it
       from/until   optional; outside these dates the strip does not show,
                    and "N days to go" counts down to `until`
       tone     festive (teal) · offer (amber) · new (blue) · top (purple)
       max      how many products at most (default 24)
       match    a product joins the strip if ANY of these hit:
                words   matched in the name, "also called", or sub-group
                subs / brands / cats / codes   matched exactly

     Two more strips appear on their own and need nothing here: what customers
     have rated highest, and what this reader opened recently. */
  promos: [
    {
      id: 'ganesh',
      enabled: true,
      tone:  'festive',
      title: 'Ganesh Chaturthi',
      note:  'Modak and gujiya moulds — order now for the festival rush',
      from:  '2026-08-01',
      until: '2026-09-24',
      match: {
        words:  ['modak','gujiya','karanji','samosa','sansa','ghughra'],
        subs:   ['Samosa & Gujiya Moulds'],
        brands: [], cats: [], codes: [],
      },
    },
    {
      id: 'orbit-new',
      enabled: false,            // flip to true when you want it running
      tone:  'new',
      title: 'New in — Orbit',
      note:  'Strainers, tongs and serving ware, just landed',
      match: { brands: ['Orbit'], words: [], subs: [], cats: [], codes: [] },
    },
  ],

  /* The old single-strip setting. Still read when `promos` is absent, so an
     older copy of this file keeps working. `promos` wins where both exist. */
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
