#!/usr/bin/env node
/**
 * Build the grid thumbnails.
 *
 *   node tools/thumbs.mjs            # only what is missing or out of date
 *   node tools/thumbs.mjs --all      # rebuild everything
 *
 * Needs sharp:  npm i sharp
 *
 * Why this exists
 * ---------------
 * The photos are already sensible — around 25 KB each, mostly 900×900 — so
 * this is not rescuing a site full of five-megabyte JPEGs. It is fixing the
 * one thing that is plainly wasteful: a 900px photo is sent to fill a card
 * about 160px wide, twenty at a time, to a phone on a shop's mobile data.
 * A 300px WebP is roughly a third of the bytes, so a screenful goes from
 * about 500 KB to about 160 KB. Worth doing; not worth over-engineering.
 *
 * Output mirrors images/ exactly, under images/thumb/, so a thumbnail's path
 * is the original's path with one prefix. index.html emits a <picture> with
 * the WebP first and the original JPEG as the fallback <img>, which means a
 * missing thumbnail degrades to precisely the old behaviour — the two can
 * never drift into something broken.
 *
 * You do not normally have to run this. .github/workflows/thumbs.yml runs it
 * whenever images/ changes on a push and commits the result, because photos
 * are added through GitHub's upload page rather than a local checkout, and a
 * script that has to be run by hand is a script that stops being run.
 */
import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT   = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRCDIR = path.join(ROOT, 'images');
const OUTDIR = path.join(SRCDIR, 'thumb');
const WIDTH  = 300;      // ~2x the widest a card image is drawn at
const QUALITY = 72;
const ALL = process.argv.includes('--all');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('This needs sharp:  npm i sharp');
  process.exit(1);
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (full === OUTDIR) continue;          // never read our own output
      yield* walk(full);
    } else if (/\.(jpe?g|png)$/i.test(e.name)) {
      yield full;
    }
  }
}

let made = 0, skipped = 0, failed = 0, srcBytes = 0, outBytes = 0;

for await (const src of walk(SRCDIR)) {
  const rel  = path.relative(SRCDIR, src);
  const dest = path.join(OUTDIR, rel).replace(/\.(jpe?g|png)$/i, '.webp');
  await mkdir(path.dirname(dest), { recursive: true });

  const s = await stat(src);
  srcBytes += s.size;

  if (!ALL && existsSync(dest)) {
    const d = await stat(dest);
    // Rebuild when the photo has been replaced since the thumbnail was made.
    if (d.mtimeMs >= s.mtimeMs) { skipped++; outBytes += d.size; continue; }
  }

  try {
    await sharp(src)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);
    outBytes += (await stat(dest)).size;
    made++;
  } catch (e) {
    console.error('could not convert', rel, '—', e.message);
    failed++;
  }
}

const mb = n => (n / 1e6).toFixed(1) + ' MB';
console.log(`${made} built, ${skipped} already current${failed ? `, ${failed} failed` : ''}`);
console.log(`originals ${mb(srcBytes)} → thumbnails ${mb(outBytes)} ` +
            `(${Math.round((1 - outBytes / srcBytes) * 100)}% smaller)`);
if (failed) process.exit(1);
