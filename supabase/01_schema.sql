-- ═══════════════════════════════════════════════════════════════
-- PATEL MARKETING CATALOGUE — SCHEMA
-- Run this once in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists brands (
  id    bigserial primary key,
  name  text unique not null,
  sort  int default 0
);

create table if not exists categories (
  id    bigserial primary key,
  name  text unique not null,
  sort  int default 0
);

create table if not exists products (
  id          bigserial primary key,
  code        text unique,                -- MZ-003
  name        text not null,              -- exactly as printed in the supplier price list
  brand_id    bigint references brands(id),
  category_id bigint references categories(id),
  sub         text,                       -- product type, e.g. "Oil Pourer"
  descr       text,
  spec        text,
  note        text,                       -- e.g. "GST differs by finish"
  gst         int,
  stock       text default 'active',      -- active | out
  featured    boolean default false,
  hotel       jsonb,                      -- hotel-pan spec block, if any
  images      text[] default '{}',        -- first entry is the primary photo
  legacy_sizes text[] default '{}',       -- free-text sizes for products without a rate card
  updated_at  timestamptz default now()
);

create table if not exists variants (
  id         bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  size       text not null,               -- "750 ml", "3 pcs set", "NO. 2", "Black"
  rate       numeric(10,2),               -- supplier rate before GST
  price      numeric(10,2),               -- rate including GST  ← shown in the catalogue
  mrp        numeric(10,2),
  moq        int,
  sort       int default 0,
  unique(product_id, size)
);

create index if not exists idx_products_brand    on products(brand_id);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_variants_product  on variants(product_id);
create index if not exists idx_products_name_trgm on products using gin (name gin_trgm_ops);
create extension if not exists pg_trgm;

-- Public read-only access (this is a public catalogue, no login)
alter table brands     enable row level security;
alter table categories enable row level security;
alter table products   enable row level security;
alter table variants   enable row level security;

drop policy if exists "public read brands"     on brands;
drop policy if exists "public read categories" on categories;
drop policy if exists "public read products"   on products;
drop policy if exists "public read variants"   on variants;
create policy "public read brands"     on brands     for select using (true);
create policy "public read categories" on categories for select using (true);
create policy "public read products"   on products   for select using (true);
create policy "public read variants"   on variants   for select using (true);

-- One view that returns a product with its variants already nested,
-- shaped exactly like data.json so the front end needs no changes.
create or replace view catalogue as
select
  p.images[1]                as img,
  p.images                   as imgs,
  p.name,
  b.name                     as brand,
  c.name                     as cat,
  p.sub,
  p.descr                    as "desc",
  p.spec,
  p.code,
  p.gst,
  p.note,
  (select min(v.price) from variants v where v.product_id = p.id) as price,
  coalesce((
    select json_agg(json_build_object('size',v.size,'rate',v.rate,'price',v.price,'mrp',v.mrp,'moq',v.moq)
                    order by v.sort, v.id)
    from variants v where v.product_id = p.id), '[]'::json)        as variants,
  p.stock,
  p.hotel,
  p.featured                 as feat,
  p.legacy_sizes             as sizes
from products p
left join brands b     on b.id = p.brand_id
left join categories c on c.id = p.category_id
order by p.id;
