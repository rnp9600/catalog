# What to build next

`APP.md` answers one question — how this becomes an app. This answers the
wider one: what is missing, what it is worth, and what was deliberately left
alone.

Everything below was written against the repo as it stood at build 29, after
reading all five pages and `data.json`. The numbers are counted from
`data.json`, not estimated.

## The state of things

The catalogue itself is in good shape. Search understands trade abbreviations,
retail mode hides trade rates at the counter, promo strips are configuration
rather than code, reviews and the noticeboard are live, and a shared product
link produces a real WhatsApp preview. None of that needs revisiting.

What was missing fell into four groups.

### 1. A dealer could not re-order

This was the largest gap in the repo, and it was invisible because every
individual piece already worked. An order is placed through `place_order`, and
the office sees it in `orders.html`. But on the catalogue — where the dealer
actually is — there was no order history, no way to repeat an order, no saved
list, and no way to sort.

A wholesale customer buys roughly the same forty items every month. Without
repeat ordering they search for all forty, one at a time, every time. The
catalogue was built for someone discovering the range, and the people using it
most already know the range.

### 2. It was not installable and did not work offline

`APP.md` said a PWA was a day's work, cost nothing, and should come before
everything else. It had not been built — there was no manifest and no service
worker anywhere in the repo.

### 3. Nothing was measured

There was no record of what anyone searched for, so there was no way to answer
the two questions that actually decide what to stock and how to name it:

- What did someone search for and get **nothing** back?
- What do people open and never order?

The first is the cheapest useful information this business can collect, and it
was being thrown away on every search.

The catalogue's own gaps had the same problem — they were known but not
tracked. Counted from `data.json`:

| Missing | Products |
|---|---|
| No rate at all (cannot be quoted) | 127 |
| No MRP, product or variant | 178 |
| No HSN (blocks a GST invoice) | 483 |
| No product code | 128 |
| Only one photo | 583 |
| No description | 24 |

### 4. The signed-in pages were copies of each other

`admin.html`, `orders.html`, `shop.html` and `exchange.html` each carried their
own copy of the Supabase bootstrap, the entire phone/OTP sign-in gate, the
account menu, the product lookup, and the small formatting helpers.

That is not a tidiness complaint. The copies had already drifted: `money()` in
`admin.html` had lost the null guard the other three kept, so a product with no
rate printed `₹NaN` in the admin panel and `—` everywhere else. Four copies
means every fix has four chances to be applied three times.

Separately, `supabase/01_schema.sql` described four tables. The live database
had roughly a dozen, five views, and thirteen functions, none of it in the
repo. If the Supabase project were lost, the site could not be rebuilt from
this repository.

## What was done

In this order, because the shared module had to come first — the other three
all touch the same files, and de-duplicating afterwards would mean writing
every change four times.

1. **`pm-ui.js`** — one copy of the sign-in gate, account menu, product lookup
   and helpers, used by all four signed-in pages. `money()` keeps the guarded
   form. Plus `supabase/SCHEMA.md`: how to capture the real schema, and where
   the dump belongs.
2. **Repeat ordering** — "Your orders" with an **Order again** button, a saved
   list, and a sort control on the catalogue.
3. **PWA and thumbnails** — a manifest, a service worker, and WebP grid
   thumbnails.
4. **Measurement and data quality** — a `catalog.events` log, and a work queue
   in the admin panel for the table above.

### Two things still need someone with dashboard access

Both are one paste-and-run in Supabase → SQL Editor, and both are written and
waiting in the repo. Nothing breaks until they happen; they just do not start
working.

- **`supabase/03_events.sql`** — creates the event log. Until it is run the
  catalogue quietly does not log and the admin panel says so. Every day it is
  not run is a day of searches thrown away, so it is the more urgent of the two.
- **The schema dump** — `supabase/SCHEMA.md` carries the query. Until it is run,
  the only complete copy of the database's shape is inside the Supabase project.
  Nothing is broken today; it is insurance, and it costs ten minutes.

### Notes on the ones with teeth

**Order again** reloads a past order at *today's* prices, not the prices it was
placed at. That falls out of the basket format rather than being special-cased:
the basket has only ever stored `{slug, size, qty}` and resolves everything else
from the catalogue at render time. Lines whose product or size no longer exists
are dropped, and the count is shown rather than swallowed.

**The saved list is in `localStorage`, not the database.** It needs no schema
change, works offline, and is a per-device convenience rather than business
data. If dealers come to rely on it across phones, promoting it to a table is a
small isolated change.

**The service worker is the dangerous one**, and this repo already knows why:
the build number and the `?v=` convention exist because phones served stale
files and a fix looked like it had done nothing. A service worker makes that
permanent if you get it wrong. So:

- the cache name *is* the build number, and activation deletes every other
  cache — no second thing to remember, because the number is already bumped on
  every change;
- `data.json` is network-first, falling back to cache only when the network
  fails, so the published catalogue can never be pinned to an old copy;
- anything to `*.supabase.co`, and anything that is not a `GET`, is never
  cached — an explicit early return, not an omission;
- there is no `skipWaiting()`. A new version waits, and the reader is offered a
  reload. Swapping the code under an open order pad is not worth the speed.

If a worker ever does go wrong, the fix is a normal push, not a message asking
every dealer to clear their browser. Replace `sw.js` with:

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
});
```

**Thumbnails turned out to be a bigger win than expected.** The photos were
already sensible — median 25KB, mostly 900×900 — so the estimate here was a
threefold saving. Measured, 300px WebP took **30.3 MB of photos down to 2.7 MB
of thumbnails, 91% smaller**, and a first paint of the catalogue from about
650KB of images to 88KB. The reason is simply that a 900px photo was being sent
to fill a card 160px wide.

The fallback took two attempts and the first one was wrong, which is worth
recording. `<picture><source type="image/webp">` with the JPEG as the inner
`<img>` looks like the textbook answer and does not do the job here: a browser
that supports WebP picks the `<source>`, and if that file is missing it shows a
broken image rather than falling back. The case that had to work is exactly
that one — a photo uploaded through GitHub before its thumbnail exists. So it
is a plain `<img>` at the thumbnail with an `onerror` that swaps in the
original, which covers both a thumbnail that was never built and a browser that
cannot decode WebP, and lands on precisely the old behaviour.

Because photos are added through the GitHub upload page rather than a local
checkout, a GitHub Action regenerates them on push — a script nobody can run is
a script nobody runs.

**The event log only writes.** Anyone may insert; only admin and staff may
read. A browsing log that the page can read back out is a different and worse
thing than a browsing log.

## V4 — the shop

Everything above improved the catalogue. V4 changes what it is.

The trigger was a customer, not a wishlist. He opened a product link we had
shared on WhatsApp, did not notice the small × in the corner, and pressed Back
to see the rest of the shop. The browser closed. He opened the link again, was
told about the ×, browsed on from one product to another, pressed Back — and
the browser closed again.

Nothing threw an error. A shared link loads a page with exactly one history
entry, and opening a product sheet never added one, so Back and the edge-swipe
had nothing to return to and left the site. The root version has since been
given a router that pushes an entry for each of its twelve overlays, and that
fixes the reported case. But it is a router retrofitted onto overlays that were
each written assuming they were the only thing on screen, and every new overlay
is another chance to forget.

V4 removes the shape of the problem. Every destination — home, a category, a
search, a product, the cart, the checkout, an order, a repeat, the account — is
its own address, so Back walks the reader's actual route without a line of code
simulating it. On top of that it is built mobile-first: a bottom tab bar in
thumb reach, sheets that rise from the bottom, safe areas honoured, and a 44px
floor on anything you press.

It shares the catalogue, the photos, the settings, the sign-in wiring, the
database and even the `localStorage` keys with the previous build, so there is
one copy of each to keep current and nothing was lost in the move.

It was tried at `/v4/` and **is now the site**. The previous build is archived
at `/v3/` and still works; `/v2/` is retired, because it existed as a fallback
for OTP trouble and a second sign-in path is now more liability than insurance;
`/v4/…` redirects to the root so links from the trial still work.
`ARCHITECTURE.md` has the module list, the rules the code keeps and the
service-worker kill switch.

## Not done, and why

**Push notifications for order status.** `APP.md` is right that this is the
reason to have an app at all — "your order has been packed" is what a website
cannot do. It needs a device-token table and a trigger on status change. Worth
doing when the order book is in daily use and there is something to notify
about.

**Fuzzy search.** The database already carries a `pg_trgm` index on
`products.name` that nothing uses. The obvious move is a "did you mean" on a
zero-result search — but which misspellings to handle is a guess until the
search log has run for a few weeks. That is the sequencing: measure first, then
build. Come back to this once the zero-result list has a month in it.

**Automating publish.** Half done, and from the other end than expected. Rather
than automating download-and-upload, the app can now read `catalog.catalogue`
directly, so an edit in the admin panel is on the site the moment it is saved
with no publish step at all. It is opt-in at `/v4.1/` while it is tried, and
falls back to `data.json` if the database is unreachable. `data.json` stays as
the default, as the fallback, and as the thing git has a history of.

**Finishing the stock exchange.** `exchange.html` works but is thin:
`contact_pref` is collected and never shown, `expires_at` is displayed but never
set by the client, Browse has no filters, and an enquiry never touches the
database — it opens WhatsApp to Patel Marketing, so the dealer who listed the
stock never learns anyone asked. Either it matters and wants a real enquiry
record, or it does not and should be left as the brokered thing it currently
is. That is a business decision, not a technical one.

**Paging the catalogue, and a 1,000-product ceiling.** *Asked for, agreed, and
deliberately deferred — this is the one to raise next time someone asks what to
build.*

Everything renders in one pass. The app caps the home screen at 12, but a
category draws every product in it, a search draws every hit, and "Show all" on
the search screen draws all 743. At today's size that is fine and measurably so.

First, a correction to the reason this came up. **The catalogue never reads
products from Supabase.** `data.json` is a static file served from Vercel's CDN,
so browsing costs no database reads and no rows, whatever the SKU count. Only
sign-in, orders, ratings and the noticeboard touch Supabase. The worry that
10,000 SKUs would make browsing expensive on the database side does not apply.

What *is* real is the payload and the render. 743 products is 509KB; 10,000
would be roughly 7MB downloaded on every first visit, on a phone, on Indian
mobile data — and building 10,000 cards in one pass would stutter a cheap
Android badly. Both get worse smoothly, not suddenly, which is exactly why this
is easy to keep putting off.

Four pieces, in the order they earn their keep:

1. **Render in pages of about 48**, with a sentinel element at the bottom of
   the grid that draws the next batch as it scrolls into view. This is the one
   that fixes the render cost at any catalogue size and it changes no data and
   no publish step. Cheap. Worth doing before it is needed.
2. **A hard ceiling of 1,000 on any one list**, with a line saying "showing the
   first 1,000 of N — narrow it down with a category or a search" rather than
   silently truncating. 1,000 is the number the office wants dealers held to for
   a smooth screen.
3. **Split `data.json` in two**: a small index carrying only what a card needs
   (name, brand, cat, sub, price, slug, img) and per-product detail fetched when
   a product is opened. This is what actually caps the *download*, and it is the
   only piece that touches `admin.html`'s publish step, so it wants its own
   change and its own testing.
4. **"Download the full catalogue"** — a button that produces the whole thing as
   a PDF for the dealer who genuinely wants everything, so the ceiling in (2) is
   a nudge rather than a wall. The PDF machinery already exists in
   `index.html`'s catalogue sheet.

**When to do it.** Items 1 and 2 help today and are a day's work between them.
Item 3 does not pay for itself until the catalogue is past roughly 2,000
products — before that, splitting the file adds a round trip per product open
for no saving worth having. Item 4 whenever (2) lands. The signal to stop
waiting on any of them: `data.json` past about 1.5MB, or the unfiltered grid
taking more than a beat to appear on a mid-range Android.

**Letting a Claude session write to Storage.** Sessions can already do SQL,
migrations and Edge Function deploys through the Supabase MCP — that is how the
sign-up schema and the live catalogue were built and tested. What they cannot do
is reach `<project>.supabase.co` over HTTPS, so no PostgREST, no Auth and no
Storage upload. That is the sandbox's network policy, not a Supabase setting.

It turns out not to be a blocker for photos: the Action added alongside this
keeps the bucket in step from GitHub, which is better than a session doing it by
hand anyway. `supabase/AGENT-ACCESS.md` has the three routes, what each costs,
and the checks behind them — including the one that surprised me, which is that
the *database* can reach both the bucket and GitHub raw, so a route exists today
with nothing reconfigured at all.

The smallest useful change, if it is ever wanted, is to allow the project domain
in the environment's network policy and supply only the publishable key: that
buys read access for verification, with no write privilege.

**Never redirect an address that was ever installable.** `/v4/` was a trial
address people installed from; turning it into a redirect put a browser bar
across the top of their app, because a redirect sends an installed app outside
its own scope. It is a rewrite now, so the old icons keep working. Worth
remembering the next time a folder is promoted — `ARCHITECTURE.md` has the
detail.

## The one thing that is not a feature

The five test numbers are live credentials on the live site, and `README.md`
already says so. `9686754020` is a full admin, the numbers are sequential, and
the PIN is `765432`. They exist so the site can be walked at every level
without paying for an SMS, which is a good reason — for a testing run, not
indefinitely. The SQL to remove them is in the README. When testing is done,
run it.
