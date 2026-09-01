# Turning this into an app

Nothing here is built yet — this is the map. Three routes, cheapest first. The
honest summary: route 1 gets you 90% of what "an app" means to a shop owner,
this week, for nothing. Route 3 is the only one that gets you into the Play
Store, and it is a real project.

## Where you are now

The site is a single-page web app already. All four screens run in the browser,
talk to Supabase directly, and hold their state locally. Nothing about the
architecture has to change for any of the routes below — that is the useful
part. There is no server to rewrite, because there isn't one: Vercel serves
static files and Supabase is the backend.

What you do *not* have yet, and what each route gives you:

| | Home-screen icon | Works offline | Push notifications | In the Play Store |
|---|---|---|---|---|
| Today | rough | no | no | no |
| 1. PWA | yes | yes | yes (Android) | no |
| 2. Wrapper | yes | yes | yes | yes |
| 3. Native | yes | yes | yes | yes |

## Route 1 — make it installable (a PWA)

**Effort: about a day. Cost: nothing. Do this first regardless of the others.**

A web app manifest plus a service worker turns the site into something a dealer
installs from Chrome's "Add to Home Screen": its own icon, no browser chrome,
its own window in the app switcher. On Android it is genuinely hard to tell
from a native app.

What it needs:

1. **`manifest.webmanifest`** — name, theme colour, `display: standalone`, and
   icons at 192px, 512px and a maskable 512px. The icons are the one thing that
   needs making; the "PM" mark is currently CSS, so it has to become real PNGs.
2. **A service worker** — caches the shell (`index.html`, `config.js`,
   `supabase-auth.js`, the fonts) and `data.json`, so the catalogue opens
   instantly and works with no signal. This is the part to be careful with: a
   badly scoped service worker serves people a stale site and is miserable to
   undo. It should use a versioned cache tied to the build number that already
   exists in the footer, and never cache Supabase calls.
3. **Icons and a splash screen** for iOS, which ignores half the manifest and
   wants `apple-touch-icon` and `apple-mobile-web-app-*` meta tags.

Worth knowing about offline: the catalogue would work offline, and so would a
basket. Sign-in and orders would not — those need the network. The sensible
behaviour is to let someone browse and build an order offline and send it when
they have signal.

**iOS caveat.** Safari supports installing to the home screen but has never
supported web push properly for installed sites until recently, and support is
still patchy. If your dealers are mostly Android — which for this trade they
probably are — this matters much less than it sounds.

## Route 2 — wrap the site in a native shell

**Effort: one to two weeks. Cost: ₹2,500 Play Store one-off, ₹8,000/yr Apple.**

Capacitor (or Median/GoNative if you would rather pay someone) wraps the
existing site in a thin native app: a WebView pointing at your site, plus real
native plugins for push notifications, the camera, and file downloads. You ship
one codebase and it appears in both stores.

This is the right route if what you actually want is *to be in the Play Store*
— because dealers trust an app they installed from there more than a link, and
because "search Patel Marketing in Play Store" is easier to say on the phone
than a URL.

What changes in the code: almost nothing. You add Capacitor, point it at the
built site, and swap a few browser APIs for native ones — the WhatsApp links
and PDF downloads are the two places that behave differently inside a WebView.

The catch: Apple rejects apps that are "just a website" under guideline 4.2.
You get past it by shipping things a website cannot do — push notifications,
offline order-taking, a barcode scanner for stock — which you would want anyway.
Google is far more relaxed.

## Route 3 — a real native app

**Effort: two to four months. Cost: a developer, or a lot of your time.**

React Native or Flutter, sharing the Supabase backend. Only worth it if you hit
something the other two cannot do: heavy offline use across thousands of
products, barcode scanning as a core workflow, or performance problems with
long lists on cheap Android phones.

Nothing you have described needs this yet.

## What I would actually do

1. **Now:** Route 1. It is a day, it costs nothing, and a dealer with the icon
   on their home screen opens the catalogue five times as often as one with a
   bookmark.
2. **When the order book is being used daily:** Route 2, driven by push
   notifications — "your order PM-20260902-001 has been packed" is the feature
   that makes an app worth installing, and it is the thing a website cannot do
   on iOS at all.
3. **Route 3:** only if something specific forces it.

## The one thing to decide early

Push notifications are the reason to have an app at all here, and they change
the database a little: you need a table of device tokens per phone number, and
something that sends when an order's status changes. That is a small piece of
work, but it is much easier to design now — while the order book is new — than
to retrofit. Say the word and I will add the table and the trigger, so that
whenever you go for route 1 or 2 the backend is already waiting.
