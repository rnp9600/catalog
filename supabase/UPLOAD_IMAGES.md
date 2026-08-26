# Uploading photos to Supabase Storage

The bucket is already created — `catalog-images`, public read, empty. Photos
are organized **by brand**, one folder per brand, matching the local
`images/` folder exactly:

```
images/
├── mazda/        243 files
├── senso/         97 files
├── india-gold/    36 files
├── ns-priyam/     34 files
├── elephant/      19 files
├── paxton-ci/     14 files
├── vyan/           6 files
└── lepel/          3 files
```

This is a **one-time bulk upload**, not a "figure out what's missing" job:
nothing is in the bucket yet, so there's nothing to compare against. Upload
each brand folder once, and it's done.

---

## Upload (10 minutes, on your phone)

1. Download and unzip **`catalog-images-for-supabase.zip`** — it already has
   the 8 brand folders above, 442 files total.
2. Open `supabase.com/dashboard` → your **Chandler** project → **Storage**
   → the **catalog-images** bucket.
3. Tap **Create folder**, name it `mazda`. Open it, tap **Upload files**,
   select all files from the local `mazda/` folder, upload.
4. Repeat for `senso`, `india-gold`, `ns-priyam`, `elephant`, `paxton-ci`,
   `vyan`, `lepel` — same steps each time. Mazda's the big one (243 files);
   the rest are quick.

No per-file matching at any point — each folder is uploaded once, complete.

---

## Turning it on in the catalogue

`index.html` already has the switch built in, right near the top of the
`<script>` block:

```js
const IMAGE_SOURCE = 'local'; // 'local' | 'supabase'
```

Once all 8 folders are uploaded, change that one line to:

```js
const IMAGE_SOURCE = 'supabase';
```

and push. Every image on the site now loads from Supabase Storage instead of
the GitHub repo — same brand/filename paths, nothing else changes. Flip it
back to `'local'` any time if you want to fall back.

You can test before committing to the switch: open
```
https://vcrzauuxvgpsbforiszz.supabase.co/storage/v1/object/public/catalog-images/mazda/mz001.jpg
```
in a browser. If the Mazda oil dispenser photo loads, the bucket is working
and the switch is safe to flip.

The database already expects this structure — `catalog.products.images`
was updated to store `mazda/mz001` style paths, not bare filenames, so the
Supabase side and the static site agree on where every photo lives.

---

## Adding new photos from here on

Once this is live, adding a photo for a new product is: **Storage → catalog-
images → open the right brand folder → Upload files → pick the photo from
your phone.** No GitHub, no zip, no commit. Name the file to match the
product's image entry (e.g. a new Mazda product coded `MZ-198` would use
`mazda/mz198.jpg`) and it appears on the site immediately — no redeploy
needed, since the front end fetches the image straight from the bucket's
public URL.

A new brand later is just a new folder — **Create folder** with that brand's
slug (lowercase, hyphens for spaces, e.g. a brand called "Royal Chef" → 
`royal-chef`), same upload steps.

---

## Why I couldn't do the upload myself

Worth being straight about this: the tools I have for Supabase only run SQL
against the database — they can create the bucket, its permissions, and the
brand-folder paths in the product data (done), but they can't push binary
file bytes into Storage, and my own sandbox has no outbound internet access
to call Supabase's upload API directly even if I tried. Getting bytes from
your phone into their storage has to go through you, once. Everything
downstream of that — the data, the page, the switch above — is already
wired up and waiting.

