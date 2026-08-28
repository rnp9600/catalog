/* Patel Marketing catalogue — settings.
   This is the only file you need to edit for day-to-day changes.
   It is loaded by both index.html and admin.html.                      */

window.PM_CONFIG = {

  /* ---- business ---------------------------------------------------- */
  firm: 'Patel Marketing',
  tagline: 'Wholesale Kitchenware',
  whatsapp: '919999999999',        // << your business number, country code, no +
  site: 'https://patelmarketing-catalog.vercel.app',

  /* Where product photos live. Two options — no code change either way.
     Repo:     '../images/'
     Supabase: 'https://<project>.supabase.co/storage/v1/object/public/catalog-images/'
     The brand folder + filename from data.json is added on the end.          */
  imageBase: '../images/',

  /* ---- what customers see ------------------------------------------ */
  showPricesToGuests: false,       // false = rates hidden until someone signs in
  gstNote: 'incl. GST',
  currency: '₹',

  /* ---- sign-in ------------------------------------------------------
     mode: 'off'      no sign-in, everyone sees everything
           'local'    allowlist below, checked in the browser (no server)
           'supabase' Supabase phone OTP + allowlist table (needs keys)     */
  dbSchema: 'catalog',   // tables live in the catalog schema, not public

  auth: {
    mode: 'local',   // switch to 'supabase' once SMS is set up (see README)
    supabaseUrl: 'https://vcrzauuxvgpsbforiszz.supabase.co',
    supabaseAnonKey: 'sb_publishable_HMTnoyLJiLTvtnoKad3koQ_CaKKj-5s',  // publishable key only — never the secret key
    // Used when mode is 'local'. Digits only, with country code.
    allowlist: [
      // '919876543210',
    ],
    admins: [
      // '919999999999',
    ],
    noAccessMessage:
      'This number is not on our customer list yet. Send us a WhatsApp and we will add you.',
  },

  /* ---- retail mode --------------------------------------------------
     Lets a shopkeeper show the catalogue to walk-in customers under
     their own name, so enquiries reach them and not us.                */
  retail: {
    enabled: true,
    defaultMarkupPct: 0,           // 0 = show MRP as the retail price
  },

  /* ---- festive / trending -------------------------------------------
     Pins seasonal products to the top with their own strip.
     Set `until` to the day the push should stop. After that date the
     strip disappears on its own — nothing to remember.
     Match on any of: brand, category, sub-group, code, or a word in
     the product name or its aliases.                                    */
  festive: {
    enabled: true,
    title: 'Ganesh Chaturthi',
    note: 'Modak and gujiya moulds — order now for the festival rush',
    from: '2026-08-01',
    until: '2026-09-24',          // Chaturthi falls on 14 Sep 2026
    match: {
      words: ['modak', 'gujiya', 'karanji', 'samosa', 'sansa', 'ghughra'],
      subs:  ['Samosa & Gujiya Moulds'],
      codes: [],
    },
    pinToTop: true,               // also lifts them up the main grid
  },

  /* ---- motion --------------------------------------------------------
     'full'  everything on
     'calm'  only fades, no movement
     'off'   no animation at all
     A phone set to reduce motion is always respected regardless.        */
  motion: 'full',

  /* ---- pdf ----------------------------------------------------------- */
  pdf: {
    showcaseWarnAbove: 200,
    footer: 'Rates are subject to change. E&OE.',
  },
};
