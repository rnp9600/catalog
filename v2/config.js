/* v2 settings — the only file you edit.
   v2 is your live catalogue plus a festive strip and motion.
   Everything else (themes, fonts, filters, help, PDF) is unchanged. */

window.PM_CONFIG = {

  /* ---- festive / trending -------------------------------------------
     Pins seasonal products into their own strip above the grid, with a
     countdown. Disappears by itself after `until` — nothing to remember.
     Match on any of: words in the name/alias/sub-group, sub, brand, code. */
  festive: {
    enabled: true,
    title: 'Ganesh Chaturthi',
    note:  'Modak and gujiya moulds — order now for the festival rush',
    from:  '2026-08-01',
    until: '2026-09-24',              // Chaturthi is 14 Sep 2026
    match: {
      words:  ['modak','gujiya','karanji','samosa','sansa','ghughra'],
      subs:   ['Samosa & Gujiya Moulds'],
      brands: [],
      codes:  [],
    },
  },

  /* ---- motion --------------------------------------------------------
     'full'  cards reveal on scroll, photos fade in, buttons respond
     'off'   no animation at all
     A phone set to reduce motion is always respected either way.        */
  motion: 'full',
};
