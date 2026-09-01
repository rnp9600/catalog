# Patel Marketing — wholesale kitchenware catalogue

One live site. `patelmarketing-catalog.vercel.app` serves it from the repo root;
Vercel redeploys on every push to `main`.

There is no v1, v2 or v3 to choose between any more. What used to be v3 **is**
the site. `/v3/…` redirects to the root, so links and bookmarks from testing
still work. `/v2/` is kept as a fallback — the older build with the old
plain-text sign-in, in case OTP sign-in ever fails for someone. v1 is retired
and no longer deployed; it is still in git history if it is ever wanted back
(`git log --diff-filter=D -- index.html`).

## Files

| Path | What it is |
|---|---|
| `index.html` | The catalogue everyone sees |
| `admin.html` | Admin panel — products, contacts, reviews, publishing |
| `shop.html` | A dealer's own customer list and their offers |
| `exchange.html` | Dealer-to-dealer stock exchange |
| `config.js`, `supabase-auth.js` | Supabase URL, publishable key, shared sign-in |
| `data.json` | What the public catalogue reads. **Not** the database — see Publishing |
| `images/` | Product photos |
| `api/p.js` | Server-renders one product's `<head>` so WhatsApp shows a real link preview |
| `supabase/` | Edge function for OTP delivery, plus schema notes |
| `v2/` | The previous build, kept as a fallback |

## The three levels

The business has three, and so does the software.

**Patel Marketing (`admin`)** — the wholesaler. Buys from manufacturers, sells
wholesale to retail outlets. Edits products, sets everyone's role, moderates
reviews, publishes the catalogue.

`staff` is the office, working for the admin — not a fourth level of the
business. Staff open the same admin panel and do all the catalogue work
(products, brands, publishing) and can use the stock exchange, but they cannot
add or remove people, change anyone's role, or hide a review. A mispriced
product is fixed in a minute and the old `data.json` is still in git; a
wrongly granted admin is a different kind of mistake. The panel hides those two
tabs for staff, but that is presentation — the database refuses the writes
regardless of what the page shows.

**Dealers (`dealer`)** — who Patel Marketing sells to. Every dealer sees trade
rates, can list slow stock on the exchange, and keeps their own customer list.
`dealer_type` says which kind:

- `retailer` — a shop consumers walk into. Given a **city**, they are listed in
  the consumer-facing shop directory for people to find and follow. Leave the
  city blank to keep a dealer unlisted.
- `wholesaler` — trades at a smaller scale than Patel Marketing. Same access,
  but never shown to consumers.

A dealer sees their own customers and nobody else's. That is enforced in the
database, not in the page.

**End customers (`end_customer`)** — consumers. They do not order online; they
see what a shop has in stock, what is arriving, what is being kept aside, and
they review products they have used. They arrive one of two ways:

- A shop asks for their number and adds them.
- They sign up themselves, pick their city, and follow a shop. A dealer who
  later adds that same number claims them; a number already on another dealer's
  list is refused.

`shop_owner` was a fourth role in the original plan. It turned out to be the
same thing as a retail dealer, so it was collapsed into `dealer`. The value is
still accepted everywhere so nothing written before the merge lost access.

## Saved is not published

The two get confused, so the admin panel now separates them explicitly.

- **Saved** — an edit hits `catalog.products` / `catalog.variants` the moment
  you tap Done. This is the source of truth.
- **Published** — the public catalogue reads the static `data.json` in this
  repo. It only changes when that file is uploaded to GitHub, which redeploys
  the site.

The Publish tab does the three steps in order: compare the draft against the
database, download `data.json`, then open the GitHub upload page.

## Sign-in

Phone OTP through Supabase Auth. Supabase generates the code; the `send-sms`
edge function delivers it through Fast2SMS. See
`supabase/functions/send-sms/README.md` for the routes and their costs, and
`supabase/SCHEMA-EXPOSURE.md` for how the `catalog` schema is exposed to
PostgREST — a setting that has silently broken sign-in before.

Two things must never enter this repo: the Fast2SMS API key and the Send SMS
hook secret. They live only as Supabase edge function secrets. The Supabase
*publishable* key in `config.js` is meant to be public and is protected by
row-level security.

## Notes for whoever edits this next

- Product names are copied exactly from supplier price lists. Do not tidy or
  rename them. WH means Wooden Handle here, not White.
- `localStorage` keys stay namespaced (`v3_*`). They are not renamed now that
  the version prefix is gone: `v3_sb_auth` holds the Supabase session, so
  renaming it would sign every signed-in person out, and the rest hold baskets
  and preferences people would lose.
- The footer prints a build number, and the sign-in panel prints whether the
  Supabase library, client and auth wiring loaded. Both exist because this site
  cannot be inspected remotely — bump the build number and the `?v=` on
  `config.js` / `supabase-auth.js` on every change, or phones keep serving the
  cached old file and a fix looks like it did nothing.
