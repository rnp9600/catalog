#!/usr/bin/env node
/**
 * Pull the catalogue out of Supabase and write ../data.json
 *
 *   node supabase/export.mjs
 *
 * Set these two first (Supabase → Project Settings → API):
 *   export SUPABASE_URL="https://xxxxx.supabase.co"
 *   export SUPABASE_ANON_KEY="eyJ..."
 *
 * Why export instead of fetching live?
 * A static data.json loads in one request straight off the CDN — no round
 * trip to the database, works offline, and costs nothing. Supabase stays the
 * place you *edit* products; this script rebuilds the file the site serves.
 * Run it whenever you change something, then push.
 */
import { writeFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY first.');
  process.exit(1);
}

const rows = [];
const PAGE = 1000;

for (let from = 0; ; from += PAGE) {
  const res = await fetch(`${URL}/rest/v1/catalogue?select=*`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Range: `${from}-${from + PAGE - 1}`,
    },
  });
  if (!res.ok) {
    console.error('Request failed:', res.status, await res.text());
    process.exit(1);
  }
  const batch = await res.json();
  rows.push(...batch);
  if (batch.length < PAGE) break;
}

// numeric columns come back as strings from PostgREST — put them back to numbers
const n = (v) => (v === null || v === undefined ? null : Number(v));
for (const p of rows) {
  p.price = n(p.price);
  p.variants = (p.variants || []).map((v) => ({
    size: v.size, rate: n(v.rate), price: n(v.price), mrp: n(v.mrp), moq: n(v.moq),
  }));
  p.imgs = p.imgs || [];
  p.sizes = p.sizes || [];
}

writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(rows));

const variants = rows.reduce((s, p) => s + p.variants.length, 0);
console.log(`Wrote data.json — ${rows.length} products, ${variants} variants.`);
