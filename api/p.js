// ---------------------------------------------------------------------------
// /api/p.js  —  ONE dynamic product page for the whole catalogue.
//
// Why this file exists:
//   WhatsApp (and Facebook, Telegram, iMessage, X, Slack) fetch a shared link
//   with a crawler that does NOT run JavaScript. It only reads the raw <head>.
//   So the catalogue's client-side detail sheet can never produce a per-product
//   link preview on its own. This function server-renders the <head> for
//   whichever product was asked for, which is what makes the rich card appear.
//
//   It handles every product in data.json. There is no per-product file.
//
// Routing:  vercel.json rewrites  /p/<slug>  ->  /api/p?id=<slug>
// Accepts:  ?id=<slug>            e.g. surya-vadachatti
//           ?id=<code>            e.g. SUR-001
//           ?i=<array index>      fallback
// ---------------------------------------------------------------------------

const WA_NUMBER = '917892967505';        // Patel Marketing WhatsApp Business
const SITE = 'https://patelmarketing-catalog.vercel.app';

// Must stay byte-identical to slugOf() in index.html, or shared links break.
function slugOf(p) {
  const k = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return k(p.brand) + '-' + k(p.name);
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Warm-lambda cache so we don't refetch data.json on every single request.
let CACHE = null, CACHE_AT = 0;
const CACHE_MS = 5 * 60 * 1000;

async function loadData(req) {
  if (CACHE && Date.now() - CACHE_AT < CACHE_MS) return CACHE;

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';

  let data = null;
  try {
    const r = await fetch(`${proto}://${host}/data.json`);
    if (r.ok) data = await r.json();
  } catch (e) { /* fall through to filesystem */ }

  if (!data) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data.json'), 'utf8'));
    } catch (e) { /* give up below */ }
  }

  if (data) { CACHE = data; CACHE_AT = Date.now(); }
  return data;
}

function priceBlock(p) {
  const v = p.variants || [];
  if (v.length) {
    const rows = v.map(x => `<tr>
      <td>${esc(x.size)}</td>
      <td class="r">${x.price != null ? '₹' + x.price : '—'}</td>
      <td class="r dim">${x.mrp != null ? '₹' + x.mrp : ''}</td>
      <td class="r dim">${x.moq ? x.moq + ' pc' : '—'}</td></tr>`).join('');
    return `<table class="vt">
      <thead><tr><th>Size / option</th><th class="r">Rate</th><th class="r">MRP</th><th class="r">MOQ</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="fine">Rate is per piece including GST${p.gst ? ' at ' + p.gst + '%' : ''}. MRP is the printed maximum retail price. MOQ is the minimum order quantity where the supplier sets one.</p>`;
  }
  if (p.sizes && p.sizes.length) {
    return `<ul class="plain">${p.sizes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
  }
  if (p.price != null) return `<p class="big">₹${p.price} <span class="dim">incl. GST</span></p>`;
  return `<p class="dim">Enquire for pricing</p>`;
}

// The short line WhatsApp shows under the title in the preview card.
function ogDescription(p) {
  const bits = [p.brand, p.cat].filter(Boolean);
  const v = p.variants || [];
  if (v.length) {
    const prices = v.map(x => x.price).filter(x => x != null);
    if (prices.length) {
      const lo = Math.min(...prices), hi = Math.max(...prices);
      bits.push(lo === hi ? `₹${lo}` : `₹${lo}–₹${hi}`);
    }
    bits.push(`${v.length} size${v.length > 1 ? 's' : ''}`);
  } else if (p.price != null) {
    bits.push(`₹${p.price}`);
  }
  const head = bits.join(' · ');
  const tail = p.desc ? ' — ' + p.desc : '';
  return (head + tail).slice(0, 200);
}

function waLink(p) {
  const nl = '\n';
  let t = `Hi! 👋 I'm interested in this product:${nl}${nl}`;
  t += `📦 *${p.brand}* — ${p.name}${nl}`;
  if (p.code) t += `🔖 Code: ${p.code}${nl}`;
  if (p.cat) t += `📂 ${p.cat}${nl}`;
  const v = p.variants || [];
  if (v.length) {
    t += `${nl}📏 *Sizes:*${nl}`;
    t += v.map(x => `  • ${x.size}${x.price != null ? ` — ₹${x.price}` : ''}`).join(nl) + nl;
  } else if (p.sizes && p.sizes.length) {
    t += `${nl}📏 *Sizes:* ${p.sizes.join(', ')}${nl}`;
  }
  t += `${nl}🔗 ${SITE}/p/${slugOf(p)}${nl}`;
  t += `${nl}✨ Please share availability and delivery details.`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(t)}`;
}

function page(p) {
  const slug = slugOf(p);
  const img = p.img ? `${SITE}/images/${p.img}.jpg` : `${SITE}/og-banner.jpg`;
  const title = `${p.name} — ${p.brand} | Patel Marketing`;
  const desc = ogDescription(p);
  const url = `${SITE}/p/${slug}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">

<meta property="og:type" content="product">
<meta property="og:site_name" content="Patel Marketing">
<meta property="og:title" content="${esc(p.name)} — ${esc(p.brand)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.name)} — ${esc(p.brand)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#F2F8FD;--sf:#FFF;--sf2:#E8F3FC;--pr:#2F6FA8;--prh:#245880;--prt:#B7DCF7;
 --ac:#12A594;--tx:#0D2137;--tm:#5B7690;--bd:#D6E6F2;
 --fd:'Inter',-apple-system,sans-serif;--fm:'IBM Plex Mono',monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--fd);background:var(--bg);color:var(--tx);padding-bottom:40px}
header{background:var(--sf);border-bottom:1px solid var(--bd)}
.hin{max-width:760px;margin:0 auto;padding:11px 18px;display:flex;align-items:center;gap:11px}
.mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--pr),var(--ac));
 display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:.9rem;flex-shrink:0}
.bn{font-size:1rem;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.bs{font-size:.64rem;color:var(--tm);font-weight:500}
main{max-width:760px;margin:0 auto;padding:0 18px}
.back{display:inline-block;margin:16px 0 4px;font-size:.76rem;font-weight:600;color:var(--pr);text-decoration:none}
.hero{background:#fff;border:1px solid var(--bd);border-radius:14px;margin-top:10px;
 height:300px;display:flex;align-items:center;justify-content:center;padding:18px}
.hero img{max-width:100%;max-height:100%;object-fit:contain}
.meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}
.tag{font-size:.68rem;font-weight:600;padding:4px 9px;border-radius:999px;background:var(--sf2);color:var(--tm)}
.tag.pri{background:var(--pr);color:#fff}
h1{font-size:1.4rem;font-weight:800;letter-spacing:-.02em;line-height:1.2;margin-top:10px}
.sdesc{color:var(--tm);font-size:.86rem;line-height:1.55;margin-top:7px}
.sp{margin-top:10px;background:var(--sf2);border-radius:9px;padding:8px 11px;
 font-family:var(--fm);font-size:.72rem;font-weight:600;line-height:1.55}
.big{font-family:var(--fm);font-size:1.2rem;font-weight:600;margin-top:14px}
.dim{color:var(--tm);font-weight:400;font-size:.74rem}
.vt{width:100%;border-collapse:collapse;margin-top:16px;font-size:.8rem}
.vt th{text-align:left;font-size:.64rem;text-transform:uppercase;letter-spacing:.06em;
 color:var(--tm);font-weight:700;padding:0 8px 6px;border-bottom:1px solid var(--bd)}
.vt td{padding:8px;border-bottom:1px solid var(--bd);font-family:var(--fm);font-weight:600}
.vt .r{text-align:right}
.vt td.dim{font-weight:400}
.plain{margin-top:14px;padding-left:18px;font-size:.84rem;line-height:1.7}
.fine{font-size:.7rem;color:var(--tm);margin-top:8px;line-height:1.5}
.note{margin-top:12px;background:#FFF8E6;border:1px solid #F0DFB0;border-radius:9px;
 padding:10px 12px;font-size:.78rem;line-height:1.5}
.acts{display:flex;flex-direction:column;gap:8px;margin-top:22px}
.acts a,.acts button{display:block;width:100%;text-align:center;border:0;border-radius:10px;
 padding:13px 16px;font-family:var(--fd);font-size:.88rem;font-weight:700;cursor:pointer;text-decoration:none}
.wa{background:#25D366;color:#fff}
.alt{background:var(--sf);color:var(--tx);border:1px solid var(--bd)!important}
footer{max-width:760px;margin:28px auto 0;padding:0 18px;color:var(--tm);font-size:.72rem;text-align:center}
@media(max-width:560px){.hero{height:230px}h1{font-size:1.2rem}}
</style></head><body>
<header><div class="hin"><div class="mark">PM</div>
 <div><div class="bn">Patel Marketing</div><div class="bs">Wholesale Kitchenware</div></div></div></header>
<main>
 <a class="back" href="/">← Browse full catalogue</a>
 <div class="hero">${p.img
   ? `<img src="/images/${esc(p.img)}.jpg" alt="${esc(p.name)}">`
   : `<span class="dim">No photo yet</span>`}</div>
 <div class="meta">
  <span class="tag pri">${esc(p.brand)}</span>
  ${p.cat ? `<span class="tag">${esc(p.cat)}</span>` : ''}
  ${p.sub ? `<span class="tag">${esc(p.sub)}</span>` : ''}
  ${p.alias ? `<span class="tag">also called ${esc(p.alias)}</span>` : ''}
  ${p.code ? `<span class="tag">${esc(p.code)}</span>` : ''}
  ${p.gst ? `<span class="tag">GST ${esc(p.gst)}%</span>` : ''}
 </div>
 <h1>${esc(p.name)}</h1>
 ${p.desc ? `<p class="sdesc">${esc(p.desc)}</p>` : ''}
 ${p.spec ? `<div class="sp">${esc(p.spec)}</div>` : ''}
 ${p.note ? `<div class="note">ℹ️ ${esc(p.note)}</div>` : ''}
 ${priceBlock(p)}
 <div class="acts">
  <a class="wa" href="${esc(waLink(p))}" target="_blank" rel="noopener">💬 Enquire on WhatsApp</a>
  <a class="alt" href="/?p=${esc(slug)}">View in full catalogue</a>
 </div>
</main>
<footer>Patel Marketing — wholesale kitchenware</footer>
</body></html>`;
}

function notFound() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Product not found | Patel Marketing</title>
<meta property="og:title" content="Patel Marketing — Wholesale Kitchenware Catalogue">
<meta property="og:description" content="Browse products by brand, search by type, enquire on WhatsApp.">
<meta property="og:image" content="${SITE}/og-banner.jpg">
<style>body{font-family:-apple-system,Inter,sans-serif;background:#F2F8FD;color:#0D2137;
display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
a{color:#2F6FA8;font-weight:700}</style></head>
<body><div><h1 style="font-size:1.2rem;margin-bottom:8px">Product not found</h1>
<p style="color:#5B7690;font-size:.85rem;margin-bottom:14px">That link may be out of date.</p>
<a href="/">Browse the full catalogue →</a></div></body></html>`;
}

export default async function handler(req, res) {
  const id = (req.query.id || '').toString().trim();
  const i = req.query.i;

  const data = await loadData(req);
  if (!Array.isArray(data)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(notFound());
  }

  let p = null;
  if (id) {
    const low = id.toLowerCase();
    p = data.find(x => slugOf(x) === low)
      || data.find(x => (x.code || '').toLowerCase() === low)
      || null;
  }
  if (!p && i != null && data[+i]) p = data[+i];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!p) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send(notFound());
  }
  // Cached at the edge; crawlers and repeat shares hit the CDN, not the lambda.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(page(p));
}
