# V4 — the catalogue as a shop

V3 is a catalogue with an order pad bolted on: one 4,800-line HTML file
where every screen is an overlay drawn on top of one long product grid.
It works, and it is still what `/` serves. But it had a failure that no
amount of patching fixes, and that failure is why this folder exists.

## The bug that started it

A customer opened a product link we had shared on WhatsApp. He did not
notice the small × in the corner — he wanted to see the rest of the shop
— so he pressed Back.

**The browser closed.**

He opened the link again, and this time we told him about the ×. He
browsed on, from one product into another, and pressed Back again. The
browser closed again.

Nothing was broken in the sense of throwing an error. A shared link
loaded a page with exactly **one** history entry, and opening a product
sheet did not add one. So the phone's Back button and the edge-swipe
gesture had nothing to go back to and did the only thing left: they left
the site.

V3 has since been given a router that pushes a history entry for each of
its overlays, and that fixes the reported case. But it is a router
retrofitted onto twelve overlays that were each written assuming they
were the only thing on screen, and every new overlay is a chance to
forget. The durable fix is for a screen to *be* a screen.

## What V4 is

An e-commerce app where every destination is a route. Home, a category,
a search, a product, the cart, the checkout, an order, a repeat, the
account — each is `#/something`, each is a real history entry, and Back
therefore walks the route the reader actually took without a single line
of code simulating it.

Mobile first, because essentially every customer is on a phone: a bottom
tab bar within thumb reach, sheets that rise from the bottom, safe-area
insets honoured, and a 44px floor on anything you press.

## What it shares with V3

Nothing important is duplicated. V4 reads:

| | |
|---|---|
| `../data.json` | the 743 products — one catalogue, not a copy to keep in step |
| `../images/**` | photos and the generated 300px WebP thumbnails |
| `../config.js` | firm details, WhatsApp number, promo strips |
| `../supabase-auth.js` | phone OTP, the allowlist row, the build number |
| Supabase | the same tables, policies and RPCs — no schema change at all |
| `localStorage` | the saved list, recently viewed and the order in progress use **V3's keys**, so a dealer can move between `/` and `/v4/` mid-order and lose nothing |

Shared product links stay on `/p/:slug`, which Vercel rewrites to the API
route that renders the WhatsApp preview card. V4 accepts that link, and
also `?p=slug`, so every link already sent to a customer keeps working.

## The files

```
index.html            the shell: header, view, tab bar, print styles
app.css               the whole design system, in reading order
core.js               data, price, search, cart, session, router
ui.js                 icons, product card, stepper, sheet, toast, bars
screens-browse.js     home, shop, category, search, product, saved
screens-order.js      cart, checkout, placed, orders, order, repeat
screens-account.js    sign in, account, settings, help
sw.js                 the service worker
manifest.webmanifest  installable app metadata
```

Eight files instead of one. No bundler and no `package.json`: the whole
point of this repo is that a person who is not a developer can open a
file, read it, change a sentence and upload it through the GitHub web
page. A build step would end that.

## The modules

| Module | Where | Notes |
|---|---|---|
| Home | `#/` | search, notices, promo hero, categories, **buy again**, featured, recently viewed |
| Catalogue | `#/shop`, `#/shop/:cat` | categories → sub-groups → grid, with sort |
| Search | `#/search?q=` | typo-tolerant, live suggestions, recent searches, popular groups |
| Product | `#/product/:slug` | swipe gallery, role-aware price, size rows with steppers, specs, ratings, share, related |
| Cart | `#/cart` | edit quantities, remove, totals, minimum-order steps, dropped-line count |
| Checkout | `#/checkout` | name/shop/phone/note, validated, `place_order` RPC |
| Confirmation | `#/placed/:ref` | reference, WhatsApp send, PDF — and deliberately no Back arrow |
| Orders | `#/orders`, `#/orders/:id` | history with status, full line detail |
| Repeat | `#/repeat/:id` | every line back with a stepper and a remove, at today's rates |
| Saved | `#/saved` | per-account, on the phone, works offline |
| Account | `#/account` | profile, role, links into admin / order book / shop / exchange |
| Sign in | `#/signin` | phone OTP, the PIN path for test numbers, end-customer sign-up |
| Settings | `#/settings` | light/dark/auto, four text sizes, motion, install, force refresh |
| Help | `#/help` | the six questions people actually ask |
| PWA | `sw.js` | installable, offline catalogue, build-numbered cache |
| Logging | `core.js` | search / open / order events into `catalog.events` |

## Rules the code keeps

**A screen is a route; a sheet is a decision.** If it has state worth
going Back to, it is a route. The size picker and the sort menu are
sheets because dismissing them should not consume a Back press.

**One button.** `.btn` with four intents and three sizes. Nothing else
in the app styles a `<button>` a person presses to do something. V3
learned this the hard way: renaming one selector left its entire
checkout — Place this order, Send on WhatsApp, Save the PDF — completely
unstyled, which is what a customer reported as "so basic design".

**A missing rate is `—`, never `₹0` and never `₹NaN`.** 127 products
have no rate on file. Each one is a question a dealer wants to ask, so
they go on an order with the rate left open and the message says so.

**MRP is a printed price.** If the supplier did not give one, we do not
show one. V3 used to estimate MRP at 2.25× the dealer rate and strike it
through, which put an invented number in a customer's hands.

**The role decides the price, and the role comes from the database.**
Never from a number typed into the page. A dealer sees trade rates and a
stepper; an end customer sees their shop's offer or the printed MRP;
Patel Marketing's own staff see neither, because an order they placed
would be addressed to themselves.

**Never cache anything to Supabase.** Sessions, orders, reviews and the
noticeboard go straight to the network. That is an explicit early return
in `sw.js`, not an omission.

## Trying it

```
python3 -m http.server 8000     # from the repo root
# then open http://localhost:8000/v4/
```

Test numbers are on the five accounts documented in the root README, PIN
`765432`. `9686754020` is a full admin, `…22` a dealer, `…23` an end
customer. Walk it as each: the same product should show an Edit-free
read-only view, a stepper, and a shop price respectively.

Worth checking by hand on a phone, because these are the things that
were wrong before:

1. Open `/v4/?p=paxton-ci-cast-iron-dosa-tawa` cold. Press Back. You
   should land on the catalogue, not out of the browser.
2. Product → product → cart → Back → Back → Back. Each step should
   retrace, and the last should be home.
3. Add something from inside a product. The cart bar should appear
   *above* the tab bar, not behind the card.
4. Turn the network off. The catalogue and your saved list should still
   open.

## The service worker kill switch

`sw.js` is the one genuinely dangerous file here: a bad worker pins a
stale copy of the shop onto every dealer's phone and no amount of
reloading shifts it. If that ever happens, replace the whole file with
this and push:

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
});
```

Every installed copy tears itself out on the next visit, with nobody
having to clear a browser.

## Where this is going

V4 lives at `/v4/` while it is being tried, exactly as `/v2/` did before
it. Nothing at `/` changes, so a bad day here costs nothing.

When it has been used for real — a few orders placed, a few dealers
asked — promoting it is a folder move plus a redirect: `/v4/*` becomes
`/`, today's root becomes `/v3/`, and `vercel.json` gains the redirect
pair that `/v2` and `/v3` already have. The relative paths (`../data.json`,
`../images`) are the only thing that changes, and they change in one
place each.

Not built yet, and deliberately:

- **Push notifications for order status.** The reason to have an app at
  all, but it needs a device-token table and a status-change trigger,
  and it is best done once the order book is in daily use.
- **Reviews written from V4.** They are shown; writing one still happens
  in V3.
- **Grid virtualisation.** `render` builds every card at once. Fine at
  743; revisit past about 2,000.
