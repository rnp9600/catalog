-- Patel Marketing — 06: the catalogue, readable straight from the database.
-- ---------------------------------------------------------------------------
-- Publishing was: edit in admin.html, download data.json, upload it to GitHub,
-- wait for Vercel. Understood and reversible, but it means a rate change is
-- not on the site until somebody remembers to publish it.
--
-- catalog.catalogue already existed as a view shaped like a data.json row. It
-- could not actually reproduce one, because products had nowhere to keep four
-- things the app reads:
--
--   alias  the "also called" names — 22 products, and the search leans on them
--   hsn    260 products
--   mrp    the printed MRP for a product with no size rows
--   sr     a hand-set sort order on 48 products
--
-- and one more found by comparing the view against the file field by field:
--
--   price  four products carry a rate with NO size rows at all — two Paxton
--          cast-iron pans whose sizes are a plain text list, and two Elephant
--          items sold as one thing. The view derived price from
--          min(variants.price), so those four came back null and the app
--          would have said "rate on request" about a rate we know.
--
-- sync_from_site() now carries all five, so the file and the tables stay in
-- step in both directions. unit and moq are deliberately NOT carried: they
-- live on the product in the database and data.json does not export them, so
-- mapping them would blank all 743 on the next sync.
--
-- Applied 2026-09-03. Verified by asking both sources the same 23 questions
-- through the app — counts, prices, search hits, sort order — and getting
-- identical answers.
-- ---------------------------------------------------------------------------

alter table catalog.products
  add column if not exists alias text,
  add column if not exists hsn   text,
  add column if not exists mrp   numeric,
  add column if not exists sr    integer,
  add column if not exists price numeric;

-- CREATE OR REPLACE cannot insert a column in the middle of a view, so it is
-- dropped and rebuilt. Nothing depends on it but the app, which reads by name.
drop view if exists catalog.catalogue;
create view catalog.catalogue as
 select p.images[1] as img, p.images as imgs, p.name,
    b.name as brand, c.name as cat, p.sub,
    p.descr as "desc", p.spec, p.code, p.gst, p.note,
    p.alias, p.hsn, p.mrp, p.sr, p.unit, p.moq,
    coalesce((select min(v.price) from catalog.variants v where v.product_id = p.id),
             p.price) as price,
    coalesce((select json_agg(json_build_object(
        'size', v.size, 'rate', v.rate, 'price', v.price, 'mrp', v.mrp,
        'moq', v.moq, 'unit', v.unit) order by v.sort, v.id)
       from catalog.variants v where v.product_id = p.id), '[]'::json) as variants,
    p.stock, p.hotel, p.featured as feat, p.legacy_sizes as sizes, p.slug, p.hidden
   from catalog.products p
     left join catalog.brands b on b.id = p.brand_id
     left join catalog.categories c on c.id = p.category_id
  order by p.id;

-- The catalogue is public. Products, variants, brands and categories already
-- carry a "public read" policy, so this grants nothing that was not readable.
grant select on catalog.catalogue to anon, authenticated;

-- sync_from_site() gains alias, hsn, price, mrp and sr in both the insert and
-- the on-conflict update. The full body is in the migration
-- "products_own_price_for_products_without_size_rows"; the shape is:
--
--   insert into catalog.products (..., alias, hsn, price, mrp, sr, updated_at)
--   select ..., nullif(p->>'alias',''), nullif(p->>'hsn',''),
--          nullif(p->>'price','')::numeric, nullif(p->>'mrp','')::numeric,
--          nullif(p->>'sr','')::int, now()
--   ...
--   on conflict (slug) do update set
--     ..., alias=excluded.alias, hsn=excluded.hsn, price=excluded.price,
--     mrp=excluded.mrp, sr=excluded.sr, updated_at=now();

-- The three Paxton sub-brand image folders became one, matching the single
-- Paxton brand. Slugs are untouched: they are in links already sent to
-- customers.
update catalog.products
   set images = array(select regexp_replace(x, '^paxton-(ci|alu|kw)/', 'paxton/') from unnest(images) x)
 where exists (select 1 from unnest(images) x where x like 'paxton-%');
