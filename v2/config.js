/* Patel Marketing catalogue — v2 settings.

   Numbers are in plain text for now, as you asked. Anyone who opens the page
   source can read this list, so it holds business numbers only — no notes,
   no addresses. v3 moves this to Supabase phone OTP and the list stops being
   public at all. */

window.PM_CONFIG = {

  firm: 'Patel Marketing',
  tagline: 'Wholesale Kitchenware',
  whatsapp: '917892967505',
  site: 'https://patelmarketing-catalog.vercel.app',

  auth: {
    admins: [
      { n:'Raj',     p:'919686754024' },
      { n:'Admin 2', p:'8800353840' },
      /* Third admin: add it here as another line, or from the admin panel.
         I have not invented a number — a made-up one could belong to a real
         person who would then be able to edit the catalogue. */
    ],
    customers: [
      { n:'Customer 1', p:'919448666177' },
      { n:'Customer 2', p:'918880050050' },
      { n:'Customer 3', p:'918431625230' },
      { n:'Customer 4', p:'919448471795' },
      { n:'Customer 5', p:'919448463254' },
      { n:'Customer 6', p:'918800353843' },
      { n:'Customer 7', p:'9686754026' },
    ],
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
