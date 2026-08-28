# Step by step, on your phone

Read this once before starting. Total time about 45 minutes, most of it
waiting for image uploads.

Nothing you do here touches your live site until Step 5. The old catalogue
keeps running the whole time.

---

## Before you start

You need an app that can open a zip. If you do not have one, install
**ZArchiver** (Android) — it is free. On iPhone the built-in Files app
already opens zips: tap the file and it makes a folder.

Unzip `patel-catalogue-v2.zip`. You should see:

```
data.json
v2/            (3 files)
assets/        (2 files)
images/        (3 folders, 273 pictures)
README-FIRST.md
WHERE-EACH-FILE-GOES.md
SETUP-ON-PHONE.md   ← this file
SUPABASE_SETUP.sql  ← never upload this anywhere
```

---

# STEP 1 — Pictures — DONE

You have uploaded them to both GitHub and Supabase. Nothing to do.

The site reads the GitHub copies and falls back to Supabase if one is ever
missing. One file still to add though: **`images/_placeholder.jpg`** from this
zip, into the repo's `images/` folder. Sixteen Mazda products with no photo
point at it.

<details><summary>Original instructions, kept for next time</summary>

1. Open **supabase.com** in your phone browser and sign in.
2. Open the project named **Chandler**.
3. In the left menu tap **Storage**, then the bucket **catalog-images**.
4. You will see folders: mazda, surya, senso and so on. Tap into **senso**.
5. Tap **Upload files**.
6. Choose the 260 pictures from `images/senso/` on your phone.
   - If picking 260 at once fails, do about 50 at a time. Order does not
     matter. Repeat until all 260 are in.
7. Go back to the bucket root. There is no `paxton-alu` folder yet, so tap
   **Create folder**, name it exactly `paxton-alu`, then upload the 7
   pictures from `images/paxton-alu/`.
8. Same again: create folder `paxton-kw`, upload the 6 pictures from
   `images/paxton-kw/`.

**Check it worked:** the senso folder should now show roughly 357 files
(97 old + 260 new). paxton-alu 7. paxton-kw 6.

> If the Supabase page is awkward on mobile, use your browser menu and turn
> on **Desktop site**. It becomes easier to tap.

</details>

---

# STEP 2 — Seven files into GitHub (about 10 minutes)

Only seven small text files. No pictures — they are already in Supabase.

Open **github.com** in your browser, sign in, open **rnp9600/catalog**.

### 2a. Replace data.json

1. Tap `data.json` in the file list.
2. Tap the **pencil** icon (top right) to edit.
3. Select all the text and delete it.
4. Open `data.json` from the zip in a text app, copy everything, paste in.
5. Scroll down, tap **Commit changes**.

> If your phone struggles with a file this size, do it the other way:
> tap **Add file → Upload files** at the repo root and upload `data.json`.
> GitHub will replace the old one. This is usually easier on a phone.

### 2b. Add the assets folder

1. At the repo root tap **Add file → Upload files**.
2. Upload `assets/logo-patel-marketing.svg` and
   `assets/logo-paxton-india.svg`.
3. Before committing, look at the path box at the top. It must read
   `assets/`. If it does not, tap **Cancel**, then instead use
   **Add file → Create new file**, type `assets/logo-patel-marketing.svg`
   as the name, paste the file contents, and commit. Repeat for the second.
4. Commit.

### 2c. Add the v2 folder

Same method, three files: `v2/index.html`, `v2/admin.html`, `v2/config.js`.
The path box must read `v2/`.

**Check it worked:** your repo should now show an `assets` folder and a
`v2` folder alongside your existing `index.html` and `images`.

---

# STEP 3 — Put your own numbers in (5 minutes)

This is the part that makes enquiries actually reach you. Skipping it means
every WhatsApp button goes to a fake number.

1. In GitHub open `v2` → `config.js`.
2. Tap the **pencil** to edit.
3. Find this line near the top:

```js
whatsapp: '919999999999',
```

Change it to your real business number. Country code, digits only, no plus
and no spaces. Example: `'919825012345'`.

4. Find this block a little lower:

```js
    allowlist: [
      // '919876543210',
    ],
    admins: [
      // '919999999999',
    ],
```

Put your own number in **admins**, and your customers in **allowlist**.
Remove the `//` at the start of a line to switch it on. Like this:

```js
    allowlist: [
      '919825011111',
      '919825022222',
    ],
    admins: [
      '919825012345',
    ],
```

5. Tap **Commit changes**.

Anyone whose number is not on the list can still browse every product and
picture — they just see "Sign in for rates" instead of prices, and a button
to message you for access.

---

# STEP 4 — Wait for Vercel, then look at it

1. Wait 1 to 2 minutes after your last commit.
2. Open **patelmarketing-catalog.vercel.app/v2/** on your phone.

Your old site is still at **patelmarketing-catalog.vercel.app/** and is
completely untouched.

**Check these five things:**

- Pictures load, including the new modak and samosa moulds.
- Search "modak" finds three products. Search "MS 331" finds the mop.
- Tap a product: sizes and rates show in a table.
- Tap **Enquire on WhatsApp**: it opens WhatsApp addressed to your number.
- Tap the **⚙** button: you should see an **Admin** row, because your
  number is in `admins`.

If pictures are missing, Step 1 did not finish. Go back and check the
folder counts.

---

# STEP 5 — Tell Supabase to catch up (1 minute)

**Already done on 28 Aug — the database now holds all 641 products.**
Nothing to do this time. Keep this step for the future.

After any future change to `data.json`, wait for Vercel to finish, then:

1. Go to supabase.com → Chandler project → **SQL Editor**.
2. Tap **New query**.
3. Type or paste exactly:

```sql
select * from catalog.sync_from_site();
```

4. Tap **Run**.

It returns three numbers: total products, total variants, and how many were
newly added. That is the whole job — one line, no exporting, no second list.

It matches products by product code first, so renaming a product does not
create a duplicate. If the file comes back with fewer than 50 products it
refuses to run, so a broken deploy cannot empty your tables.

---

# STEP 6 — Only when you are happy

Right now the new catalogue lives at `/v2/` and the old one at `/`.
Leave it that way for a few days. Share the `/v2/` link with two or three
customers you trust and see what they say.

When you want to switch over for good, in GitHub open `v2/index.html`,
tap the pencil, and use **⋯ → Rename**, changing the name from
`v2/index.html` to `index.html`. That replaces the old site.

Before doing that, make a copy of the old one: open `index.html`, pencil,
rename it to `index-old-2026-08.html`. Then you can always go back.

---

# Later, when you have time (not urgent)

**Pictures into GitHub as well.** You wanted a copy in both places. Doing
260 uploads twice on a phone is miserable, so leave it until you are near a
computer. Drag the three folders from `images/` into the repo's `images/`
folder on github.com and commit. Nothing changes on the site — it is purely
a backup, and `config.js` already falls back to it automatically if a
Supabase picture ever goes missing.

**Rates still missing.** Both modak moulds are live with their sizes but no
rates. Send them to me and I will fill them in.

**Royal and Triangle photos.** Those two sansa products currently show the
Jumbo picture and say so in a note. Send photos and I will swap them.

**Real phone sign-in.** Today the allowlist is inside `config.js`, which
means anyone who reads the page source can see the numbers. It is fine for
customers, not for competitors. When you want it done properly you need an
SMS provider inside Supabase (MSG91 suits Indian numbers, costs per
message). Tell me when and I will switch it over.

---

# If something goes wrong

**The site shows "Could not load the catalogue".**
`data.json` did not upload properly, or the commit is still deploying.
Wait two minutes and reload.

**All pictures blank.**
Check `v2/config.js` — the `imageBase` line should end with
`/catalog-images/`. And check Step 1 actually finished.

**Rates do not show even though my number is in the list.**
The number must be digits only with country code and no plus:
`'919825012345'` not `'+91 98250 12345'`.

**I broke config.js.**
In GitHub open the file, tap **History**, pick the previous version, and
restore it. Nothing is ever lost.

**Everything looks wrong and I want out.**
Your old site at `/` was never touched. Just share that link again.
