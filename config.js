/* Patel Marketing catalogue — v2 settings.
   Numbers are stored as one-way hashes, never in the clear, so opening the
   page source does not reveal your customer list. The admin panel generates
   this file for you — you should not need to hand-edit it. */

window.PM_CONFIG = {

  firm: 'Patel Marketing',
  tagline: 'Wholesale Kitchenware',
  whatsapp: '917892967505',
  site: 'https://patelmarketing-catalog.vercel.app',

  /* hashing salt — changing this invalidates every number below */
  salt: 'patel-marketing-catalogue-v2',

  auth: {
    admins: [
      { n:'Raj', t:'…024', h:'30ddf9c8f34b9bbbfd6e81c0252d9482313e6720c5c39feac84432d79942bc6b' },
      { n:'Admin 2', t:'…840', h:'39c34264f152a7812d3d81eb222885727568219417b38ea5374f787f4d96bd60' }
      /* Third admin: add from the admin panel — Customers tab — rather than
         picking a number here. I have deliberately not invented one, because
         any number I made up could belong to a real person who would then be
         able to edit your catalogue. */
    ],
    customers: [
      { n:'Customer 1', t:'…177', h:'55cabff00261ca2b53fdab9a20475646f0028914fc6cbd56ccf8d1ac2dd97219' },
      { n:'Customer 2', t:'…050', h:'2f2e79202d1e4d1103f56cfa2408fb920b6ffc923d51727ec1f94648065bc6cb' },
      { n:'Customer 3', t:'…230', h:'d56d6451f75168cd64b37e9e4667503390afd540f75709e3153bd47f14e96e50' },
      { n:'Customer 4', t:'…795', h:'0d594ad7cd2acf0bc3e565e88f3016bdbeb76a82dadca27cb6ea4bedeb933b9b' },
      { n:'Customer 5', t:'…254', h:'ef2442ce2d62592652731c19e867b479129e759ecbba38d73576e58c031ea82a' },
      { n:'Customer 6', t:'…843', h:'533ac18a93ac1f27224efe9211d23d80cb0a15ba9e1f9a4441f932205fbd0a88' },
      { n:'Customer 7', t:'…026', h:'701d69c97b03aeb7992ae5b7060970d2b79c149a52bbc8224f5e91d1b36377a1' }
    ],
    noAccessMessage: 'This number is not on our customer list yet.',
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
