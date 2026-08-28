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
  imageBase: 'https://vcrzauuxvgpsbforiszz.supabase.co/storage/v1/object/public/catalog-images/',

  /* ---- what customers see ------------------------------------------ */
  showPricesToGuests: false,       // false = rates hidden until someone signs in
  gstNote: 'incl. GST',
  currency: '₹',

  /* ---- sign-in ------------------------------------------------------
     mode: 'off'      no sign-in, everyone sees everything
           'local'    allowlist below, checked in the browser (no server)
           'supabase' Supabase phone OTP + allowlist table (needs keys)     */
  auth: {
    mode: 'local',
    supabaseUrl: '',               // https://xxxx.supabase.co
    supabaseAnonKey: '',           // anon/publishable key ONLY — never the service key
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

  /* ---- pdf ----------------------------------------------------------- */
  pdf: {
    showcaseWarnAbove: 200,
    footer: 'Rates are subject to change. E&OE.',
  },
};
