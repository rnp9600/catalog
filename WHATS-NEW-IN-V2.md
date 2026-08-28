# v2 — final build

## Look

v2 now uses your existing design, not a new one. Same four colour schemes
(Sky, Copper, Emerald, Dark), same Inter and IBM Plex Mono, same cards,
badges, hotel-size explainer, and the same four views. Both switchers sit in
the header where they always were. The new logo is gone — it uses your
original **PM** gradient mark, which follows the colour scheme.

Your theme and view choice are now remembered between visits.

## Ganesh Chaturthi strip

A **Festive** panel appears above the product grid with a live countdown to
14 September, holding all six festival products:

- Aluminium Samosa Mould — Fancy (Gujiya / Karanji)
- Aluminium Modak Mould
- Plastic Modak Mould
- Plastic Samosa / Gujiya Maker — Jumbo, Royal, Triangle

They also move to the top of the main grid and carry a **Festive** badge.
It switches itself off after 24 September — nothing to remember.

Everything about it is in `config.js` under `festive`:

```js
title:  'Ganesh Chaturthi',
note:   'Modak and gujiya moulds — order now for the festival rush',
until:  '2026-09-24',
match:  { words: ['modak','gujiya','karanji','samosa','sansa','ghughra'] },
```

For Diwali change the title, the words, and the dates. Nothing else.

## Animation

The swipe-through photos you liked now also have **tappable dots** under
them, and a nudging arrow on the first product with more than one photo so
customers know to swipe.

Added:

- Cards fade and rise as you scroll to them, in small staggered batches
- Photos fade in as they load instead of snapping in
- Header condenses and gains a shadow once you scroll
- Chips, buttons and cards spring slightly when tapped
- Shimmering placeholder cards while the catalogue loads
- Pulsing dot on the festive strip
- Sheets slide up over a fading backdrop; toasts slide in

All of it is on a dial in `config.js`:

```js
motion: 'full',   // or 'calm' (fades only) or 'off'
```

A phone with reduce-motion turned on is always respected, whatever the
setting says.

## Images

`imageBase` is now `'../images/'` — the GitHub copies you uploaded.
If a picture is ever missing there, it falls back to Supabase Storage
automatically, and to the placeholder tile if both fail. Nothing goes blank.

## The old site

`index-old-fixed.html` in this zip repairs what my new `data.json` broke:

- brand count was hardcoded to 8, now counts them properly (11)
- products with sizes now show them, reading the new `variants` field
- MRP shows struck through next to the rate
- missing photos fall back to the placeholder instead of a broken icon
- search now also reads aliases and variant sizes

To use it: rename it to `index.html` in GitHub, replacing the old one.
Back the current one up first (rename to `index-backup.html`).

**It is built from the copy of `index.html` in our project folder.** If you
have changed the live one since, tell me and I will patch your live version
instead of replacing it.

Also upload `images/_placeholder.jpg` to the repo's `images/` folder — 16
Mazda products with no photo point at it.
