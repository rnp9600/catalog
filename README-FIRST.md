# Catalogue v2 — what is in this package

Everything here is **new or changed**. Nothing replaces your live site until you
choose to. Your current `index.html` and `data.json` keep working exactly as now.

```
data.json                     <- 641 products (was 454). Replaces the old one.
images/senso/…                <- 300 product photos pulled from the Senso pricelist
images/paxton-alu/…           <- aluminium samosa + modak moulds, cleaned
images/paxton-kw/…            <- plastic modak + sansa moulds, cleaned
assets/logo-patel-marketing.svg
assets/logo-paxton-india.svg
v2/index.html                 <- new catalogue
v2/admin.html                 <- add / edit products from your phone
v2/config.js                  <- the only file you edit day to day
SUPABASE_SETUP.sql            <- DO NOT COMMIT. Paste into Supabase SQL editor.
```

## Put it live in three steps

1. Upload `images/`, `assets/`, `v2/` and the new `data.json` to the repo.
2. Open `https://patelmarketing-catalog.vercel.app/v2/` and check it on your phone.
   Your old site is still at `/` and is untouched.
3. When you are happy, move `v2/index.html` to the root — or leave both.

## Before anything else — two settings

Open `v2/config.js` and set:

- `whatsapp` — your business number. It is a placeholder right now.
- `auth.allowlist` — the customer numbers allowed to see rates.
  Format `'919876543210'`, with country code, digits only.
  Put your own number in `auth.admins` as well so you get the admin link.

Leave `auth.mode` as `'local'` for now. That works today with no server.

## Prices in this build

- Senso: rate = the list D.P. **+10%**, MRP as printed on the list.
- 19 Senso items had no readable MRP; those use **2.25×** and carry a note
  saying so, so you can spot and fix them.
- Sansa moulds: Jumbo 180, Royal 170, Triangle 160 — **per packet of 10**,
  MRP 2.5× rounded to 10. The per-packet wording is on each product.
- Aluminium samosa mould: 90 / 199 as you set.
- Both modak moulds are live with sizes but **no rates** — send them when ready.

## Known gaps, honestly

- **350 image references** point at pictures already in your repo (Mazda, Surya,
  Elephant and so on). They are untouched and will keep working. Only the new
  folders are in this package.
- **16 Mazda products have no image path at all.** They did before too. They show
  a blank tile. Worth fixing in the admin panel.
- **Royal and Triangle sansa photos** have not been sent, so those two products
  reuse the Jumbo picture. Send them and I will swap them in.
- **Phone-OTP sign-in is written but not switched on.** See below.

## Turning on real phone sign-in later

The local allowlist needs no server, but anyone who reads the page source can see
the numbers, and rates are only hidden in the browser. When you want it done
properly:

1. Restore a Supabase project from the dashboard (both are paused).
2. Run `SUPABASE_SETUP.sql` in the SQL editor. Do not put that file in GitHub.
3. Add an SMS provider in Supabase (MSG91 works well for Indian numbers) — this
   costs money per message.
4. In `config.js` set `auth.mode` to `'supabase'` and paste the project URL and
   the **anon** key. Never the service role key.

## Image reorganisation

The new folders are already brand-first (`images/senso/…`), which is the layout
you wanted for Supabase Storage. If you later move images into Storage, keep the
same folder names and only the base URL changes.

---

## Supabase — checked on 28 Aug

- The catalogue project `nvswfhdysiwyswmckyiw` is **still paused**.
- The `catalog-images` bucket is in the **Chandler** project
  (`vcrzauuxvgpsbforiszz`, Mumbai), is **public**, and holds **544 files**
  in brand folders. The reorganisation you had queued is already done.
- Every image path used by the old 454 products resolves in the bucket.
  Nothing is broken.
- `v2/config.js` now points `imageBase` at that bucket. If a file is missing
  the page falls back to `../images/` in the repo automatically.

### Upload these 273 files to the bucket, same folder names

```
images/senso/       260 files   (from the new pricelist)
images/paxton-alu/    7 files   (samosa + modak moulds)
images/paxton-kw/     6 files   (plastic modak + sansa)
```

82 Senso products from the pricelist were matched by product code to studio
photos already in the bucket, so those keep the better picture and the
pricelist shot becomes the second image. That saved 82 uploads.

### One decision for you

The bucket lives inside **Chandler**. Your rule has always been that the
catalogue stays decoupled from Chandler. As it stands, if Chandler is paused,
hits a quota, or gets rebuilt, every catalogue photo goes blank.

Options:
1. Leave it. Simplest, works today, accepts the coupling.
2. Restore the catalogue project and copy the bucket across, then change one
   line in `config.js`. Clean separation, an hour of copying.
3. Keep images in the GitHub repo instead and set `imageBase` back to
   `'../images/'`. No Supabase dependency for images at all.

Also worth deleting: `ns-priyam/Untitled folder/.emptyFolderPlaceholder` is
stray junk in the bucket.

---

## Supabase — what I set up on 28 Aug

**Applied already, nothing for you to run:**

- `catalog.allowlist` — who may see rates. Empty right now.
- `catalog.events` — view / share / enquire logging.
- `catalog.product_stats` — a view: most viewed, most shared, most enquired.

They went into the existing `catalog` schema, not `public`, so they sit
beside your products tables and collide with nothing.

`v2/config.js` now has the project URL and the **publishable** key, and the
client is pointed at the `catalog` schema.

### Two things I found that you should know

**1. Keeping Supabase in step with GitHub — solved, one command.**

`data.json` stays the single source of truth. The database now pulls from it
instead of being maintained separately. After Vercel finishes deploying a
push, open the Supabase SQL editor and run:

```sql
select * from catalog.sync_from_site();
```

It reads `https://patelmarketing-catalog.vercel.app/data.json`, then updates
products, variants, brands and categories to match. It returns the product
count, variant count, and how many were added. Safety catch: if the file
comes back with fewer than 50 products it refuses to run, so a broken deploy
cannot empty your tables.

Nothing to paste, nothing to export, no second list to maintain.

If you would rather not remember even that, enable `pg_cron` once under
Database > Extensions and schedule it nightly — the line is in
`SUPABASE_SETUP.sql`.

**Run it for the first time after your first upload.** Until the new
`data.json` is live on Vercel, the tables still hold the old 454 products.

**2. Sign-in is wired but still on `local` mode.** Phone OTP needs an SMS
provider connected inside Supabase (MSG91 suits Indian numbers) and that costs
per message. Until then `auth.mode` stays `'local'` and the allowlist in
`config.js` is what works. When SMS is live: set `mode: 'supabase'`, then add
your customers to `catalog.allowlist` instead of `config.js`.

Analytics already works either way — the events table logs even in local mode.

### Security notes from the database linter

Two pre-existing warnings, neither from my changes, both worth fixing when
convenient:

- `public.rls_auto_enable()` is a SECURITY DEFINER function that anyone can
  call over the API without signing in. Revoke execute from `anon` unless it
  is deliberate.
- The `pg_trgm` extension sits in the `public` schema; it belongs elsewhere.
