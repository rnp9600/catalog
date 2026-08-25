# Patel Marketing — Wholesale Kitchenware Catalogue

Static site. No build step, no framework, no login. Drop the folder on any host and it works.

**406 products · 727 sizes · 8 brands**

---

## What to upload, and where

Everything in this folder goes to the root of **github.com/rnp9600/catalog**, replacing what's there now:

```
index.html          ← replaces yours
data.json           ← replaces yours (406 products, was 262)
images/             ← replaces the whole folder (442 files, was 255)
supabase/           ← new, optional (see below)
README.md           ← this file
```

Easiest route on a phone: open the repo → **Add file → Upload files** → drag the
unzipped folder in → commit. GitHub replaces same-named files automatically.

Delete the old `site/` wrapper folder if the repo still has one — `index.html`
must sit at the repo root for GitHub Pages / Vercel to find it.

> `images/` grew because every Mazda product now has its own photo — 442 files,
> 13 MB. That uploads fine in one go, even on a phone.

---

## What changed in this pass

**Mazda is now complete and correct.**

| | Before | Now |
|---|---|---|
| Mazda products | 53 | **197** |
| Mazda with a rate card | 0 | **197** |
| Mazda sizes priced | 0 | **517** |
| Mazda names | invented | **exactly as printed in the price list** |

- All **182 numbered products** from *MAZDA PRICE LIST w.e.f. 01.04.2026*, plus
  all **15 accessories / spares** from the last page.
- Every size, finish and pack option carries its **rate incl. GST, MRP and MOQ** —
  517 rows in total, transcribed from the price list.
- Names are left exactly as Manak Steel wrote them: `SALT & PEPPER - SWISS SIXER
  (GOLD / ROSEGOLD CAP)`, `GHEEPTO TRIPTO SEETHRU`, `TAJ PICKLE SET (CERA/ BLACK/
  CLAY)`. Nothing renamed, nothing tidied up.
- **181 product photos** lifted straight out of the price list PDF at 288 dpi,
  trimmed and squared — so every product shows the right item.
- The **studio photos you uploaded** are attached as extra images on the seven
  pourers they belong to (Crystal, Crystal with Handle, Dream, Beauty, Penguin,
  Easy, Real). Products with more than one photo show a *"n photos"* badge.
- Of the old Mazda images, **44 were identified and re-attached to the correct
  product**. The remaining 9 were salt-and-pepper shakers I could not tell apart
  with confidence — they are left out rather than guessed at. That is what went
  wrong last time.

**No other brand was touched.** Senso, India Gold, Elephant, Paxton CI, Vyan,
Lepel and NS · Priyam are byte-for-byte what you had.

---

## What changed in the page

- **Tap any card** → a detail panel slides in with the full size/rate/MRP/MOQ
  table, photo gallery, GST rate, and other products of the same type.
- **Sub-category chips** — pick *Salt & Pepper* and a second row appears for
  *Shakers* vs *Shaker Stands*. Searching "pickle set" returns all 11.
- **Search** covers name, brand, category, type, code, description and every
  size label. So `750` finds every product made in 750 ml, and `MZ-003` finds
  one exact product. Abbreviations resolve too — `WH`→white, `SS`→stainless.
- **Copy details** button puts a clean product + rate list on the clipboard,
  ready to paste into WhatsApp.
- Theme and view choice are now remembered between visits.
- Price shows as a range on the card (`₹220–330`) because most products have
  four sizes.
- The pricing note you removed stays removed.

---

## Supabase — already live

The database side is done, not optional setup: all 406 products and 517
variants are loaded into your **Chandler** Supabase project, in a separate
`catalog` schema so nothing touches whatever Chandler itself builds in
`public`. Verified against the source data — every brand's product count
matches exactly, zero orphaned variants, zero null prices, zero MRP-below-
price errors.

The site itself doesn't need this yet — `data.json` still serves the page,
and that stays true even if the database is asleep (free-tier projects pause
after 7 days idle). Supabase is where you **edit** going forward; `data.json`
is what the site actually reads.

**One dashboard step still needed** for the database to be reachable from
outside SQL: Project Settings → API → **Exposed schemas** → add `catalog` →
Save. That toggle has no API, so it has to be a manual click. Until it's
done, `supabase/export.mjs` will fail with a message telling you exactly
this.

**Product photos**: a `catalog-images` bucket is created and public, ready
for the 442 photos. See **`supabase/UPLOAD_IMAGES.md`** — one drag-and-drop
upload, then flip one line in `index.html` to serve images from there instead
of the repo.

**Editing a price or adding sizes later**: change it in the Supabase Table
Editor, then run:
```bash
export SUPABASE_URL="https://vcrzauuxvgpsbforiszz.supabase.co"
export SUPABASE_ANON_KEY="<anon key, in supabase/export.mjs>"
node supabase/export.mjs
git add data.json && git commit -m "refresh catalogue" && git push
```
That rewrites `data.json` from whatever's in the database.

---

## Adding the rest of your 10,000 SKUs

The Mazda block is the template. Per supplier price list:

1. Extract the product images — the script that did it for Mazda works on any
   price list where products sit in numbered rows:
   `pdfplumber` for the image boxes, `pypdfium2` to render at 4× scale.
2. One record per **product**, not per size. Sizes go in `variants`.
3. Keep the supplier's own product names, character for character.

A record looks like this:

```json
{
  "img": "mz003",
  "imgs": ["mz003", "mz003_1"],
  "name": "CRYSTAL OIL POURER",
  "brand": "Mazda",
  "cat": "Oil Pourers",
  "sub": "Oil Pourer",
  "desc": "See-through crystal oil pourer with steel collar and nozzle",
  "code": "MZ-003",
  "gst": 5,
  "note": null,
  "price": 220,
  "variants": [
    { "size": "350 ml",  "rate": 210, "price": 220, "mrp": 440, "moq": null },
    { "size": "500 ml",  "rate": 235, "price": 247, "mrp": 494, "moq": null },
    { "size": "750 ml",  "rate": 285, "price": 299, "mrp": 598, "moq": null },
    { "size": "1000 ml", "rate": 315, "price": 330, "mrp": 660, "moq": null }
  ],
  "stock": "active", "hotel": null, "feat": true, "sizes": []
}
```

`price` on the product is the cheapest variant — the card uses it for sorting
and for the "from" figure. `rate` is the pre-GST supplier rate; it is stored but
not displayed anywhere.

**Where this design stops working:** past roughly 3,000 products `data.json`
crosses a megabyte and the first paint gets slow on a weak connection. That is
the point to switch the front end to fetch from Supabase per category rather
than loading everything up front — not before.

---

## Two things to check when it is live

1. **`SALT & PEPPER - OSCAR`** and **`SALT & PEPPER - TRIDENT`** — the price list
   prints a different GST rate per finish (Steel 5%, Swiss/Cera 18%). Each shows
   a note on its card. Confirm the rates are the ones you want customers to see.
2. **`DEGCHI HANDI (HAMMER)` No. 9** — the price list shows rate 330 but price
   incl. GST 246, which is lower than the rate. Every other row on that page adds
   5%; 330 + 5% would be 347. It is entered exactly as printed, so it looks odd
   on screen. Worth a call to Manak Steel.

Nine unmatched salt-and-pepper photos from the old set are in the zip under
`_unused_images/` in case you can identify them — drop any you recognise into
`images/` and add the filename to that product's `imgs` array.
