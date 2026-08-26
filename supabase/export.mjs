#!/usr/bin/env node
/**
 * Pull the catalogue out of Supabase and write ../data.json
 *
 *   node supabase/export.mjs
 *
 * Reads SUPABASE_URL / SUPABASE_ANON_KEY from the environment if set,
 * otherwise falls back to the values below (the Chandler project,
 * `catalog` schema — see README for why it lives there).
 *
 * Why export instead of fetching live?
 * A static data.json loads in one request straight off the CDN — no round
 * trip to the database, works offline, and costs nothing. Supabase stays the
 * place you *edit* products; this script rebuilds the file the site serves.
 * Run it whenever you change something, then push.
 */
import { writeFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL || 'https://vcrzauuxvgpsbforiszz.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnphdXV4dmdwc2Jmb3Jpc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzY0MDksImV4cCI6MjEwMDk1MjQwOX0.7XfW1e_LjNUj5fflQpISlr08fn4wUWU-IECWsaDCuuA';

// The catalogue lives in the `catalog` schema, not `public` (see README —
// this keeps it separate from anything Chandler builds in the same project).
// PostgREST needs a schema explicitly requested via Accept-Profile, and that
// schema must be listed under Project Settings → API → Exposed schemas first
// (dashboard-only setting; there is no API to flip it).
const SCHEMA = 'catalog';

const rows = [];
const PAGE = 1000;

for (let from = 0; ; from += PAGE) {
  const res = await fetch(`${URL}/rest/v1/catalogue?select=*`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Accept-Profile': SCHEMA,
      Range: `${from}-${from + PAGE - 1}`,
    },
  });
  if (!res.ok) {
    console.error('Request failed:', res.status, await res.text());
    if (res.status === 404 || res.status === 406) {
      console.error(
        `\nThe '${SCHEMA}' schema likely isn't exposed yet.\n` +
        'Fix: Supabase dashboard → Project Settings → API → Exposed schemas → add "catalog" → Save.\n' +
        'That setting has no API, so it has to be done by hand once.'
      );
    }
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
