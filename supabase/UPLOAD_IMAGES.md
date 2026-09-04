# Photos and the Supabase bucket

> **This is now automatic.** `.github/workflows/sync-images.yml` mirrors
> `images/` into the `catalog-images` bucket on every push that touches a
> photo. The manual instructions below are kept for the first run and for
> when something needs doing by hand.

## The one thing to set up

The Action needs the **service role** key, which bypasses row-level security
and therefore must never be in this repository:

1. Supabase dashboard → **Project Settings → API Keys** → copy `service_role`.
2. GitHub → **Settings → Secrets and variables → Actions → New repository
   secret**.
3. Name it `SUPABASE_SERVICE_KEY`, paste, save.

That is the whole setup. GitHub masks the value in logs, and the Action skips
itself with a warning rather than failing if the secret is absent.

The publishable key in `config.js` is a different key, is meant to be public,
and cannot write to the bucket.

## Running it by hand

From the **Actions** tab → *Sync photos to Supabase* → **Run workflow**. There
is a tick-box for `prune`, which also deletes bucket files that are no longer
in `images/`. It is off by default and not run automatically on a push,
because a photo deleted by mistake would otherwise take the bucket copy with
it.

Locally, if you have the key:

```
SUPABASE_URL=https://vcrzauuxvgpsbforiszz.supabase.co \
SUPABASE_SERVICE_KEY=... \
node tools/sync-images.mjs --dry-run     # say what would change
node tools/sync-images.mjs               # upload what is missing or changed
node tools/sync-images.mjs --prune       # ...and remove what is no longer here
```

It compares by name and size, so a second run does nothing. It refuses to run
at all if fewer than 100 local files are found, so a checkout that went wrong
cannot empty the bucket.

## What the first run will do

The bucket was filled once from a zip and has drifted since. As of the change
that added this Action it held 897 of the 900 photos the catalogue references:

| | |
|---|---|
| Missing outright | 6 — the `yellow-samosa-*` photos, plus `_placeholder` |
| Under old names | 27 — still `paxton-ci/`, `paxton-alu/`, `paxton-kw/`, now one `paxton/` folder |
| Thumbnails | **0 of 904** — none had ever been uploaded |

So the first run uploads **938 files** and, with `--prune`, deletes the 27
stale ones. About 30 MB. After that it is a handful of files per push.

Note that the folder rename could not be done with a database update: Supabase
Storage keys the stored object by its path, so changing `storage.objects.name`
would leave the row pointing at nothing. The Action does it properly — uploads
under the new name, then deletes the old.

## What the bucket is for

**Not** for serving the site. The catalogue reads `images/` from Vercel's CDN:
faster, free, cached for a year, versioned in git, and it has the 300px WebP
thumbnails that make the grid cheap on a phone. The bucket is the off-site
copy and what the admin panel uploads into, so it wants to be complete and
current — which is what this Action is for.

Photos are organised by brand, one folder per brand, mirroring `images/`
exactly, with `thumb/` mirroring it again underneath.
