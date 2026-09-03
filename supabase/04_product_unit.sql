-- ═══════════════════════════════════════════════════════════════
-- products.unit and products.moq
--
-- Run once in Supabase → SQL Editor.
--
-- WHY
-- variants already carries unit and moq, so a product priced by size rows has
-- always been able to say it is sold by the dozen or in boxes of six. A product
-- priced as a single line could not: there was no field for it, so the
-- catalogue hard-coded "Piece" for all 130 of them and the order pad stepped
-- them one at a time.
--
-- The admin panel now has Unit and MOQ next to Rate and MRP for exactly those
-- products. This is where the database catches up.
--
-- UNTIL YOU RUN THIS, nothing breaks and the site is correct: the public
-- catalogue reads data.json, not this database, and data.json carries both
-- fields the moment you publish. What you lose by waiting is the database copy
-- — so the Publish tab's "compare with the database" will keep reporting these
-- two fields as different, and a sync_from_site() would drop them.
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

-- The admin panel writes through admin_upsert_product(payload jsonb), so that
-- function has to read the two new keys before the database will store them.
-- It is not redefined here because it is yours and this file cannot see it —
-- open it in Supabase → Database → Functions and add the two columns to its
-- insert/update lists, alongside price and mrp:
--
--     unit = coalesce(payload->>'unit', 'Piece'),
--     moq  = nullif(payload->>'moq','')::int,
--
-- Then re-export data.json (node supabase/export.mjs) so the file and the
-- database agree, and the Publish tab stops reporting a difference.
