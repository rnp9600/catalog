#!/usr/bin/env node
/**
 * Mirror images/ into the Supabase Storage bucket.
 *
 *   node tools/sync-images.mjs --dry-run     # say what would change
 *   node tools/sync-images.mjs               # upload what is missing or changed
 *   node tools/sync-images.mjs --prune       # ...and delete what is no longer here
 *
 * Needs two environment variables:
 *   SUPABASE_URL          https://<project>.supabase.co   (public, in config.js)
 *   SUPABASE_SERVICE_KEY  the service role key            (a SECRET — see below)
 *
 * Why this exists
 * ---------------
 * The bucket was filled once, by hand, from a zip. That was fine as a one-off
 * and it has been drifting ever since: at the time of writing it holds 897 of
 * the 900 photos the catalogue references, six of them are missing outright,
 * 27 are still filed under the old paxton-ci / paxton-alu / paxton-kw folder
 * names, and NONE of the 904 generated thumbnails are there at all. Nobody did
 * anything wrong — a step that depends on somebody remembering is a step that
 * stops happening, which is exactly why tools/thumbs.mjs got an Action too.
 *
 * So this is the Action's job, not a person's. Photos are added through
 * GitHub's upload page; the thumbnails Action converts them; this one puts
 * both in the bucket.
 *
 * About the service key
 * ---------------------
 * Writing to Storage needs the SERVICE ROLE key, which bypasses row-level
 * security entirely. It must never enter this repository — not in config.js,
 * not in a workflow file, not in a commit. It lives in one place: GitHub →
 * Settings → Secrets and variables → Actions → SUPABASE_SERVICE_KEY. The
 * workflow reads it from there and it is masked in the logs.
 *
 * The publishable key in config.js is a different thing and is meant to be
 * public: it is restricted by row-level security. Do not use it here — it
 * cannot write to the bucket, and it should not be able to.
 *
 * What the bucket is FOR
 * ----------------------
 * Not for serving the site. The site reads images/ from Vercel's CDN, which
 * is faster, free, cached for a year and versioned in git. The bucket is the
 * off-site copy and the thing the admin panel uploads into, so it should be
 * complete and current — which, today, it is not.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT   = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRCDIR = path.join(ROOT, 'images');
const BUCKET = 'catalog-images';

const DRY   = process.argv.includes('--dry-run');
const PRUNE = process.argv.includes('--prune');

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY      = process.env.SUPABASE_SERVICE_KEY || '';
if (!URL_BASE || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.');
  console.error('SUPABASE_URL is public; SUPABASE_SERVICE_KEY is a GitHub Actions secret.');
  process.exit(1);
}
const HEAD = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const TYPES = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };

/* ---------- what is on disk ---------------------------------------- */
async function localFiles(dir = SRCDIR, prefix = '') {
  const out = new Map();                       // "paxton/px_dosa_tawa.jpg" -> {abs, size}
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      for (const [k, v] of await localFiles(abs, rel)) out.set(k, v);
    } else if (TYPES[path.extname(entry.name).toLowerCase()]) {
      out.set(rel, { abs, size: (await stat(abs)).size });
    }
  }
  return out;
}

/* ---------- what is in the bucket ----------------------------------- */
/* The list endpoint returns one level at a time; a folder comes back with a
   null id. So walk it, rather than assuming a flat bucket. */
async function remoteFiles(prefix = '') {
  const out = new Map();
  let offset = 0;
  for (;;) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...HEAD, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error(`list ${prefix || '/'} → ${r.status} ${await r.text()}`);
    const rows = await r.json();
    if (!rows.length) break;
    for (const row of rows) {
      const rel = prefix ? prefix + '/' + row.name : row.name;
      if (row.id === null) {
        for (const [k, v] of await remoteFiles(rel)) out.set(k, v);
      } else {
        out.set(rel, { size: (row.metadata && row.metadata.size) || 0 });
      }
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return out;
}

/* ---------- upload / delete ------------------------------------------ */
async function upload(rel, abs) {
  const body = await readFile(abs);
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURI(rel)}`, {
    method: 'POST',
    headers: { ...HEAD,
      'Content-Type': TYPES[path.extname(rel).toLowerCase()] || 'application/octet-stream',
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000, immutable' },
    body,
  });
  if (!r.ok) throw new Error(`upload ${rel} → ${r.status} ${await r.text()}`);
}

async function removeAll(names) {
  // 100 at a time; one oversized request is how a prune half-finishes.
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...HEAD, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch }),
    });
    if (!r.ok) throw new Error(`delete → ${r.status} ${await r.text()}`);
  }
}

/* ---------- the sync -------------------------------------------------- */
const local  = await localFiles();
const remote = await remoteFiles();

// The same guard sync_from_site() has. A checkout that went wrong should not
// be allowed to empty the bucket.
if (local.size < 100) {
  console.error(`Refusing to sync: only ${local.size} local files found, that looks wrong.`);
  process.exit(1);
}

const toUpload = [];
for (const [rel, f] of local) {
  const r = remote.get(rel);
  if (!r) toUpload.push([rel, f, 'new']);
  else if (r.size !== f.size) toUpload.push([rel, f, 'changed']);
}
const toDelete = [...remote.keys()].filter(rel => !local.has(rel));

console.log(`on disk   ${local.size}`);
console.log(`in bucket ${remote.size}`);
console.log(`to upload ${toUpload.length}  (${toUpload.filter(x => x[2]==='new').length} new, ` +
            `${toUpload.filter(x => x[2]==='changed').length} changed)`);
console.log(`stale     ${toDelete.length}${PRUNE ? '' : '  (left alone — pass --prune to remove)'}`);

if (DRY) {
  for (const [rel,, why] of toUpload.slice(0, 40)) console.log(`  + ${rel}  (${why})`);
  if (toUpload.length > 40) console.log(`  … and ${toUpload.length - 40} more`);
  for (const rel of toDelete.slice(0, 40)) console.log(`  - ${rel}`);
  if (toDelete.length > 40) console.log(`  … and ${toDelete.length - 40} more`);
  console.log('\nDry run — nothing was changed.');
  process.exit(0);
}

let done = 0, failed = 0;
// Eight at a time: enough to be quick over 900 files, gentle enough not to
// get throttled.
const queue = toUpload.slice();
await Promise.all(Array.from({ length: 8 }, async () => {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const [rel, f] = job;
    try { await upload(rel, f.abs); done++; }
    catch (e) { failed++; console.error('  ! ' + e.message); }
    if (done % 100 === 0 && done) console.log(`  … ${done} uploaded`);
  }
}));
console.log(`uploaded  ${done}${failed ? `  (${failed} failed)` : ''}`);

if (PRUNE && toDelete.length) {
  await removeAll(toDelete);
  console.log(`deleted   ${toDelete.length}`);
}
if (failed) process.exit(1);
