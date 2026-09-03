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
database and even the `localStorage` keys with the root version, so there is one
copy of each to keep current and a dealer can move between the two mid-order.
It lives at `/v4/` while it is tried, exactly as `/v2/` did, so a bad day there
costs nothing. `v4/README.md` has the module list, the rules the code keeps, the
service-worker kill switch and what promoting it would involve.

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

**Automating publish.** Download `data.json`, upload it to GitHub, Vercel
redeploys. It is manual, and it is also understood, reversible and visible in
git history. An Action could do it. Nothing is currently going wrong that this
would fix.

**Finishing the stock exchange.** `exchange.html` works but is thin:
`contact_pref` is collected and never shown, `expires_at` is displayed but never
set by the client, Browse has no filters, and an enquiry never touches the
database — it opens WhatsApp to Patel Marketing, so the dealer who listed the
stock never learns anyone asked. Either it matters and wants a real enquiry
record, or it does not and should be left as the brokered thing it currently
is. That is a business decision, not a technical one.

**Grid virtualisation.** `render()` builds all 743 cards in one pass. That is
fine at this size. Revisit somewhere past 2,000 products, or when a cheap
Android starts to stutter on the unfiltered view.

## The one thing that is not a feature

The five test numbers are live credentials on the live site, and `README.md`
already says so. `9686754020` is a full admin, the numbers are sequential, and
the PIN is `765432`. They exist so the site can be walked at every level
without paying for an SMS, which is a good reason — for a testing run, not
indefinitely. The SQL to remove them is in the README. When testing is done,
run it.
