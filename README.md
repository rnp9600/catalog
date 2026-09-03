# Patel Marketing — wholesale kitchenware catalogue

One live site. `patelmarketing-catalog.vercel.app` serves it from the repo root;
Vercel redeploys on every push to `main`.

The root **is** the live catalogue. `/v3/…` redirects to it, so links and
bookmarks from testing still work. `/v2/` is kept as a fallback — the older
build with the old plain-text sign-in, in case OTP sign-in ever fails for
someone. v1 is retired and no longer deployed; it is still in git history if it
is ever wanted back (`git log --diff-filter=D -- index.html`).

**`/v4/` is the next version, being tried alongside this one.** It is the same
catalogue, the same photos, the same database and the same sign-in, rebuilt as
a proper mobile shop: every screen is its own address, so the phone's Back
button and the edge-swipe walk the route the reader took instead of leaving the
site. Nothing at the root changes while it is there. See `v4/README.md` for
what it is, what it shares, and how it would be promoted.

## Files

| Path | What it is |
|---|---|
| `index.html` | The catalogue everyone sees |
| `admin.html` | Admin panel — products, contacts, reviews, publishing |
| `shop.html` | A dealer's own customer list and their offers |
| `exchange.html` | Dealer-to-dealer stock exchange |
| `config.js`, `supabase-auth.js` | Supabase URL, publishable key, shared sign-in |
| `pm-ui.js` | The sign-in gate, account button and helpers the four signed-in pages share |
| `sw.js`, `manifest.webmanifest`, `assets/icon-*` | What makes it installable and work offline |
| `tools/thumbs.mjs` | Builds the 300px WebP grid thumbnails into `images/thumb/` |
| `data.json` | What the public catalogue reads. **Not** the database — see Publishing |
| `images/` | Product photos |
| `api/p.js` | Server-renders one product's `<head>` so WhatsApp shows a real link preview |
| `supabase/` | Edge function for OTP delivery, plus schema notes |
| `v2/` | The previous build, kept as a fallback |
| `v4/` | The next version, live at `/v4/` for trial — see `v4/README.md` |

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

The draft lives in this browser's `localStorage`, which means it can go stale:
if `data.json` is updated from somewhere else while a draft is sitting open,
every product that changed upstream shows as an unsaved change here. That is
what "20 unsaved changes" meant after the Paxton brands were merged. Tap the
count in the footer to see exactly what differs — product, field, old value,
new value — and to discard the draft and take the live file instead.

## One account screen

There is one place a person manages their account: **Your account**, on the
catalogue. Their photo or initials, name, shop, city, GST, the customer-facing
price switch, links to whichever panels their role opens, and — at the very
bottom, and nowhere else in the whole site — **Sign out**.

Every other screen (admin panel, order book, dealer screen) shows that person's
photo or first initial in the header, linking to `index.html?profile=1`. None of
them carries a sign-out button of its own. Leaving is not the main thing anyone
came to do.

The product sheet's action row — Edit this product, Enquire on WhatsApp, or
the consumer's "ask the shop" — depends on who is signed in, and the sheet is
routinely on screen before the allowlist lookup comes back. So it is drawn by
one function, `sheetActionsHtml()`, and redrawn by `repriceSheet()` the moment
the session lands. Without that, coming back here from the admin panel showed
the admin **Enquire on WhatsApp** — an order pad they are deliberately not
supposed to have, on their own product — and a dealer opening a shared product
link got no order steppers at all. The size table already worked this way; the
buttons do now too.

`admin.html?edit=<slug>&back=<slug>` is the other cross-page link: the
catalogue's "Edit this product" uses it. The admin panel keeps itself hidden
until the edit sheet is up, so it is one screen rather than a list flashing past,
and backing out returns to the product sheet you came from. Saving keeps you in
the admin panel instead, because the edit is not live until you Publish and that
button is here.

## Showing prices to a customer

A dealer turns on "Showing to a customer" in their account screen and prices
switch to MRP with their own discount applied. **Nothing on the screen says it
is on.** There used to be a pill floating over the bottom of the page reading
"Retail mode · 10% off MRP · Turn off", which told the customer standing at the
counter exactly what the mode existed to hide. What is left is a small dot on
the PM badge, which reads as part of the logo, and a press-and-hold on that same
badge to switch back — both explained where the mode is turned on.

## Test accounts

Five numbers sign in with a **6-digit PIN instead of a texted code**, so the
whole site can be walked at every level without paying for an SMS each time.
They are ordinary accounts otherwise — a real session, the same database rules
— so what they show is what that kind of customer actually sees.

| Number | Role | What it is for |
|---|---|---|
| 9686754020 | admin | full access, second admin |
| 9686754021 | office staff | catalogue and publishing, no access control |
| 9686754022 | dealer (retail, Hubli) | trade rates, own customer list, exchange |
| 9686754023 | end customer | belongs to and follows the test dealer, so sees its stock and offers |
| 9686754024 | end customer | signed up alone — no shop yet, the "find a shop" screen |

PIN: `765432`. Type the number as normal; the screen asks for the PIN instead
of texting a code. Any other number still gets a real SMS.

> **These are live credentials on the live site.** The PIN is short and the
> numbers are sequential, so treat 9686754020 as a real admin login that a
> stranger could guess. They are meant for a testing run, not to be left
> standing. To remove all five when you are done — this deletes the sign-ins,
> not any catalogue data:
>
> ```sql
> delete from auth.users where phone in
>   ('919686754020','919686754021','919686754022','919686754023','919686754024');
> delete from catalog.allowlist where phone in
>   ('919686754020','919686754021','919686754022','919686754023','919686754024');
> ```
>
> Then drop the `TEST_NUMBERS` list in `supabase-auth.js`. Ask and I will do it.

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

## Prices we do not have

563 of 743 products carry both a dealer price and a printed MRP. 50 have a
dealer price but no printed MRP, and 130 have neither.

Where the MRP is not printed, the site says so rather than guessing. It used
to multiply the dealer price by 2.25 and label the result "MRP", which put an
invented figure in front of consumers, struck it through in retail mode, and
took a percentage off it. If a supplier's MRP is missing, add it in the admin
panel — that is the only thing that makes an MRP appear.

Where no rate is loaded at all, the size row says "Ask for rate" (dealers) or
"Ask in the shop" (consumers) rather than an em dash, and the size can still be
added to an order for us to quote.

Sizes reach the sheet two ways: priced `variants` rows, or a plain `sizes` text
list. A product with a `sizes` list and no variants borrows the product's own
rate and MRP — the same fallback the order pad uses, so the table and the order
cannot disagree. Two products (Cast Iron Dosa Tawa and Appam Pan) showed a rate
on the card and "Ask for rate" against every size until this was made one code
path.

MOQ is a wholesale term, so it is shown only to a signed-in trade account that
is not in customer-facing mode. The rounding still applies either way — the
quantity is still forced to a multiple, it is just not labelled where a consumer
would read it.

## Searching, and getting it wrong

Someone types **tawaa** and means tawa. **kadii** and means kadhai. The
catalogue used to show them an empty page.

Two layers, and the cheap one does most of the work.

**A soft key** folds away the spelling variance this trade actually produces.
Indian English writes the same object several ways — tawa and tava, kadhai and
kadai, phulka and fulka — and people double letters when they are unsure
(tawaa, kadhaii, modakk, triplyy). Folding both the typed word and every word
in the catalogue to the same key makes those identical, with no distance
calculation at all.

One rule that is deliberately **not** in there: `ch → c`. It looks like it
belongs next to `sh → s`, but this catalogue sells both a **copper** vessel and
a **chopper**, and folding them means someone typing "coper" gets 33 choppers.

**An edit distance** covers what is left, which is real typos. Damerau, so a
transposition costs one, and candidates are *ranked* rather than nearest-wins: a
change to the first letter is a much worse guess than one in the middle. That
is the difference between "bottel" finding bottles and finding hotels.

Both run **only when a search would otherwise come back empty**, so ordinary
typing never pays for them. Measured: 0.29 ms for a search that works, 3 ms for
one that needs respelling, 8.5 ms once to build the index — and the index is not
built at all until somebody searches.

It never corrects silently. A rescued search says **"Showing results for tawa —
search instead for 'tawaa'"**, and that second link forces the literal search
through, empty result and all. Where a search *did* find something but a
respelling would find a great deal more — "apam" matches one product by luck,
"appam" matches 34 — it offers **"Did you mean appam? Show all 35"** and leaves
the choice alone.

The misspelling is still logged. A word people keep typing is a word worth
adding to a product's "also called".

## Suggestions while typing

From two characters, under the search box: the respelling if what is being typed
is not a word the catalogue knows, then whole categories, types and brands worth
jumping straight to, then the products themselves with their photos. Arrow keys
and Enter work; tapping a product opens it, tapping a group filters to it —
a filter is exact where a search is a guess.

## Promo strips

`config.js` takes a list of `promos` — a title, an optional date window, a
colour tone, and a rule for which products belong. Add a clearance or a new
range there; nothing in the page has to change. Two more strips appear on their
own when there is enough to show: what customers have rated highest, and what
the reader opened recently.

## Orders

`orders.html` is Patel Marketing's order book, for admin and office. Orders a
dealer sends themselves from the catalogue land in the same list as ones the
office writes for a customer, and each moves along: confirm, packed, sent,
completed. Writing one picks the customer, adds lines with size, rate and
quantity, and sends it to their WhatsApp as a purchase order.

Admin and office deliberately have no order pad on the catalogue — an order
placed by the admin would go to Patel Marketing's own number. They see "Edit
this product" instead.

## Buttons

There is one set, defined once in `index.html` and mirrored in the four
signed-in pages. Four kinds, and the rule for picking one:

| | When |
|---|---|
| `primary` | The one thing this screen is for. One per screen |
| `secondary` | A real alternative to it — same weight, less shouting |
| `quiet` | Supporting actions. **Still a button**: bordered, on a surface |
| `danger` | Destructive. Outlined red, not a solid red block |

Every one is at least 44px tall, because this is used one-handed on a phone in
a shop, and all four take their colours from the theme so nothing is hard-coded.

This exists because there was no system and it showed. **Sign out, Orders and
Your customers were `.sgnbtn.ghost` — transparent, no border — so the three
things a signed-in dealer most needs to tap rendered as grey text.** "Open admin
panel" was the same shape painted green with an inline style, so the account
screen had a green button, a blue button and three pieces of text all meaning
"tap me". In the four panel pages `.btn.g` (g for green) was the *primary*
action, which is why Done and Save were green there while the primary action on
the catalogue was blue.

`.g`, `.o` and `.r` still work — `.g` is now an alias for `primary`, so there is
one primary colour instead of two — and no existing markup had to change.

## Units, and products without size rows

A product priced by size rows has always been able to say it is sold by the
dozen or in boxes of six: `variants` carries `unit` and `moq`. A product priced
as a single line could not — there was no field for it, so the catalogue
hard-coded "Piece" for all 130 of them and the order pad stepped them one at a
time. Someone looking for the unit ended up typing "Piece" into **Pack / spec
line**, which is not what that field is for.

The admin panel now has **Unit** and **MOQ** next to Rate and MRP, shown only
when a product has no size rows — with rows, all four come from the rows, so
there is one answer rather than two that can disagree. The catalogue reads
`p.unit` and `p.moq` with Piece and one as the fallbacks.

The size rows themselves were unusable on a phone: six columns in a modal left
the unit dropdown about forty pixels wide, which is why it read as missing.
Below 560px a row is now two lines, and the column headings give way to the
placeholders the inputs already carried.

`supabase/04_product_unit.sql` has been applied, and `admin_upsert_product` now
writes both fields, so the database and `data.json` agree.

One thing that surfaced while applying it: `catalog.products` has no `price`,
`mrp`, `hsn` or `alias` columns at all — rates live only in `catalog.variants`.
So a product with **no size rows has no rate in the database**, only in
`data.json`. Nothing is broken, because `data.json` is what the site serves, but
a rebuild from the database alone would lose the rate of every single-line
product and every HSN. See the note at the foot of `04_product_unit.sql`.

## Ordering the same things again

A dealer buys roughly the same forty items every month, so the catalogue keeps
what they did last time.

**Your orders**, on the account screen, lists every order that account has sent,
newest first, with where each one has got to. It reads the same
`order_summary` and `order_items` the office reads in `orders.html` and a dealer
reads in `shop.html` — same rows, same policies, nothing new in the database.

**Order again** opens that order as a list you can edit before any of it
reaches the pad: change any quantity, drop anything you do not want this time,
see what it comes to at today's rates, then add it.

It used to tip the whole order straight into the basket. That is wrong for how
this is actually used — a dealer repeats last month's order and then wants two
of this, none of that, six instead of twelve, and doing that afterwards means
hunting each line down again in a full basket, which is the exact job repeating
was supposed to save.

Quantities step by the supplier's minimum, the same rule the pad follows, so a
repeat cannot produce a quantity the pad would then silently round. The order
pad itself has the same steppers now; before, it could only remove a line.

Two more things worth knowing:

- **It repeats at today's rates, not the rates on the old order.** That is not
  a special case; the basket has only ever stored `{slug, size, qty}` and looks
  up the name, rate and unit at render time, so a repeat is priced the same way
  a fresh order is.
- **A line only comes back if the order pad could still price it.** It is
  checked with the same `resolveItem()` the pad uses, so a repeat can never
  leave a line in the basket that the pad would quietly drop. Products that
  have gone, and sizes that have gone, are counted and reported rather than
  disappearing.

Repeating an order twice adds to the existing lines instead of listing the same
size twice. An empty order pad offers **Repeat a past order**, because an empty
pad is exactly when someone wants last month's — nothing is shown until that
button is tapped, and from there it is the same list and the same review.

Admin and office do not get this, for the same reason they have no order pad:
they order for other people, from the order book.

## Saved, and sorting

The heart at the **top-left of the photo** saves a product. **Saved** next to the
product count filters to that list, and only appears once there is something in
it.

Getting that one control placed took three goes, and the reasoning is worth
keeping. It began at the photo's top-**right** — which is exactly where the
FEATURED badge sat, so the two drew on top of each other and read as "FEATU♥",
and it put a save button in the middle of the card's biggest tap target: aiming
for the product and catching the corner saved it instead of opening it. Moving
it beside the button fixed the accidents but left it stranded in the card's
footer. What was actually wrong was the **badges**, not the heart: they were
absolutely positioned over the photo, covering the one thing the card exists to
show, and the top-right one ran off the edge of a narrow card. They are a chip
row under the photo now, the photo carries exactly one overlay, and both top
corners are free again.

## The card

One shape, in every view:

- **The photo is the product.** Nothing on it but the save control.
- **Badges** (Featured, Out of stock, Hotel size, N photos) are a chip row under
  the photo, in the display font, so nothing overlaps and nothing clips.
- **Name and description clamp to two lines each.** Before this a two-line name
  and a three-line name gave two different card heights side by side.
- **The action row is pinned to the foot** (`margin-top:auto`), so every card in
  a row is the same height and every button lines up.

## The back button

A customer opened a shared product link from WhatsApp, wanted to see the rest of
the catalogue, and pressed Back. **The browser closed.**

Every screen here is an overlay over one page, and opening one used
`history.replaceState` — so no history entry was ever created. Arriving on
`/p/<slug>` in a fresh tab, that product *was* the first entry: Back had nowhere
to go but out of the site, and a phone's edge-swipe is the same gesture. There
was no way to reach the catalogue without spotting the small × in the corner.

Two things fix it, in `VIEWS` near the top of the sheet code:

1. **Opening a screen pushes a history entry and Back pops it.** The ×, the
   backdrop and Escape all go through `dismissView()`, which calls
   `history.back()` — so closing by tap, by key and by swipe are the same
   operation and the URL never disagrees with the screen.
2. **Landing directly on a product seeds the catalogue underneath it first.**
   Back then lands on the catalogue, and only a second Back leaves the site.

Reopening the *same* screen replaces rather than stacks, so Back never walks
through six copies of one product — but moving from one product to another
pushes, because that is a journey and Back should retrace it.

**Adding a screen? Give it an entry in `VIEWS` and it inherits all of this.**

## Adding to the order from inside a product

The floating basket is `z-index:150` and an open sheet is `200`, so adding to
your order from inside a product put the confirmation *behind* the thing you
were looking at. The sheet has its own bar stuck to the bottom of it instead —
count, total, and a way through to the order.

## The bottom of the screen

Three things live down there — the basket, the "a new version is ready" strip
and the toast — and each used to be positioned on its own. With the basket
showing, the update strip drew straight underneath it: the message half hidden
and its **Reload** button behind the basket entirely.

One variable settles it. `--dock` is the height the basket takes when it is
showing and `--swdock` the height of the update strip; everything below stacks
above whatever is under it. Add a fourth thing down here and give it the same
treatment.

## The basket

One basket, floating bottom-right, where a thumb rests. It shows for anyone who
can order — empty or not, quieter when empty — because the header used to carry
a **second** cart purely so an empty order was still reachable, and two baskets
on one screen is one too many.

It lives in `localStorage`, keyed by phone like recently-viewed — no table, no
policy, and it still works with no signal. The trade-off is that it is per
device: saving on the shop laptop does not save on the phone. If that starts to
matter it becomes a table, and nothing else has to change.

The sort control next to it offers rate low to high, rate high to low, name, and
best rated. **Suggested** is the default and is the old behaviour — the
hand-curated category and brand order, which leads with what the business leads
with. Under either rate sort, the 127 products with no rate at all sort last
both ways: something we cannot price is not the cheapest thing we sell.

## The noticeboard

The Noticeboard tab in the admin panel puts a message at the top of the
catalogue — today's featured product, or anything dealers should see when they
open it. Pick who sees it (dealers, consumers, everyone, or just the office), a
colour, optionally a product to pin it to, and a date to take it down.

This is a row in the database, not a setting in `config.js`, so it appears the
moment it is saved and comes down the moment it is switched off — no editing a
file, no republishing. The audience test lives in the row-level policy, so a
dealer notice is not sitting in a consumer's response for them to find. Promo
strips in `config.js` are still the right place for a season-long campaign; the
noticeboard is for today.

## Turning this into an app

See `APP.md`. Short version: the site can be made installable to a home screen
in about a day and for nothing, and that is worth doing before anything else.

## An app on the home screen, and no signal

The catalogue is installable. `manifest.webmanifest` and `sw.js` give it an
icon, its own window, and — the part that matters in a shop with one bar of
signal — it opens and works offline. Browsing, searching, the product sheets
and the order pad all work with no network; signing in and sending an order do
not, and fail clearly rather than hanging.

**`sw.js` is the most dangerous file in this repository.** The build number and
the `?v=` convention exist because phones served stale files and a fix looked
like it had done nothing; a service worker is that failure with a longer memory,
and the people it strands are dealers, not developers. Read the comment at the
top of the file before changing it. The four rules it keeps:

- **the cache name is the build number**, passed in as `sw.js?v=<build>` so
  there is still exactly one build number in the project — the one in
  `supabase-auth.js` you already bump — and activation deletes every other cache;
- **`data.json` is network-first**, cache only as the no-signal fallback, so the
  published catalogue can never be pinned to an old copy;
- **nothing cross-origin and nothing that is not a `GET` is touched**, so
  Supabase — sign-in, orders, reviews, the noticeboard — always goes to the
  network;
- **there is no `skipWaiting()`**. A new version installs and waits, and a strip
  at the bottom of the page offers it. The reader picks the moment.

If a worker ever does go wrong, it is undone by a normal push, not by asking
every dealer to clear their browser. The replacement `sw.js` that unregisters
itself is in `ROADMAP.md`.

Grid cards, the sheet's thumbnail strip and the related-product rows use 300px
WebP thumbnails from `images/thumb/`, built by `tools/thumbs.mjs` — 30.3 MB of
photos becomes 2.7 MB, and a first paint drops from about 650 KB of images to
88 KB. The hero image and the lightbox still use the real photo. A thumbnail
that has not been built yet is harmless: the `<img>` carries an `onerror` that
swaps in the original JPEG. You do not normally run the script — a GitHub
Action rebuilds thumbnails whenever `images/` changes on a push, because photos
are uploaded through GitHub rather than from a checkout.

## What people searched for, and what is missing

Two things the admin panel could not tell you before, both under
**What's missing**.

**The gaps, as a queue.** The products list has had "No rate" and "No photo"
quick filters for a while; this adds the fields a wholesaler actually gets asked
for and treats them as work rather than a statistic. Counted from the draft in
front of you, so they fall as you fill them in:

| Missing | Products | Why it matters |
|---|---|---|
| No rate at all | 127 | Cannot be quoted or ordered. This is the one that costs money |
| No MRP | 178 | Nothing to show a consumer, nothing to discount |
| No HSN | 483 | Cannot go on a GST invoice without finishing it by hand |
| No product code | 128 | How the supplier and the office refer to it on the phone |
| Only one photo | 583 | A second angle is a card someone taps rather than scrolls past |
| No description | 24 | One line saying what it is — the search reads it too |

Tap any row to open that product's editor.

**What people searched for and did not find.** Every empty search is either
something to stock or something named in a way nobody types, and until now every
one of them was thrown away.

This is live — `supabase/03_events.sql` has been applied. The panel still says
so plainly if the table is ever missing, rather than showing an empty list that
reads as "nobody uses the site".

The log is deliberately small. Four kinds of row — a search, an empty search, a
product opened, an order placed — no device id, no IP, nothing leaving the
database. Events queue in the page and go up in one batch, on a timer and when
the phone backgrounds it, so browsing costs a request or two rather than one per
tap; every insert is fire-and-forget with the failure swallowed, so logging can
never be what breaks the catalogue.

**Anyone may write to it; only admin and office may read it.** That asymmetry is
the point — a browsing log the page can read back out is a different and worse
thing than a browsing log, and one dealer must never be able to pull what another
has been pricing up. The policies in `03_events.sql` are the whole of that
guarantee, so read them before changing them.

## What to build next

See `ROADMAP.md` — what was missing and why it mattered, what was built in
response, and the things that were deliberately left alone (push notifications,
fuzzy search, automated publishing, the stock exchange) with the reasoning for
each.

The item to raise first is **paging the catalogue and holding any one list to
1,000 products**, with a full-catalogue download for anyone who wants the lot.
It is not urgent — browsing costs nothing on Supabase, because `data.json` is a
static file on the CDN, not a database read — but at 10,000 SKUs the download
size and the one-pass render both start to hurt. `ROADMAP.md` has the four
pieces and the thresholds that say when to stop deferring it.

The largest thing in flight is **V4**, at `/v4/`. It answers a complaint this
root version could only patch: a customer who opened a shared product link and
pressed Back had the browser close on him, twice, because a shared link loads
with one history entry and an overlay never added another. The root has since
been given a router that fixes the reported case; V4 removes the shape of the
problem by making every screen a real address. `v4/README.md` has the detail.

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
