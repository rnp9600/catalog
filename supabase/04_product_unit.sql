-- ═══════════════════════════════════════════════════════════════
-- products.unit and products.moq
--
-- ✅ APPLIED to the Chandler project (vcrzauuxvgpsbforiszz) on 2026-09-03,
--    as migration `products_unit_and_moq`. That migration added the two
--    columns AND updated admin_upsert_product, which this file used to leave
--    as a note for someone to do by hand.
--
-- WHY
-- variants already carries unit and moq, so a product priced by size rows has
-- always been able to say it is sold by the dozen or in boxes of six. A product
-- priced as a single line could not: there was no field for it, so the
-- catalogue hard-coded "Piece" for all 130 of them and the order pad stepped
-- them one at a time.
-- ═══════════════════════════════════════════════════════════════

alter table catalog.products
  add column if not exists unit text default 'Piece',
  add column if not exists moq  int;

comment on column catalog.products.unit is
  'How a single-line product is sold: Piece, Dozen, Box, Gross, Kg, Tag. '
  'Products priced by size rows take their unit from the rows instead.';
comment on column catalog.products.moq is
  'Minimum order quantity for a single-line product. The order pad steps in '
  'multiples of it. Null means one.';

-- The admin panel writes through admin_upsert_product(payload jsonb), so the
-- function has to read the two new keys or the columns stay empty forever.
-- The applied migration re-created the whole function with these two lines
-- added to its insert list and its ON CONFLICT update list:
--
--     unit = coalesce(nullif(payload->>'unit',''),'Piece'),
--     moq  = nullif(payload->>'moq','')::int
--
-- Take the current definition from the database rather than copying an old one
-- from here — it is long, and this file would go stale:
--
--   select pg_get_functiondef(p.oid) from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='catalog' and p.proname='admin_upsert_product';


-- ───────────────────────────────────────────────────────────────
-- WORTH KNOWING, found while applying this
--
-- catalog.products has no price, mrp, hsn or alias columns. Rates live only in
-- catalog.variants, so a product with no size rows has NO RATE IN THE DATABASE
-- AT ALL — its rate exists only in data.json, which is what the public site
-- reads, so nothing is broken today. But:
--
--   * admin_upsert_product accepts 'price', 'mrp', 'hsn' and 'alias' in its
--     payload and silently discards all four;
--   * a rebuild from the database alone would lose the rate of every
--     single-line product, and every HSN.
--
-- That is a bigger change than adding two columns and was left alone
-- deliberately. If it is ever worth closing, it is four more columns here and
-- four more lines in the same function.
-- ───────────────────────────────────────────────────────────────
