# Getting the real schema into this repo

`01_schema.sql` describes four tables. The live database has around a dozen,
five views, a dozen or so functions, and the row-level security that is what
actually keeps one dealer out of another dealer's customer list.

None of that is in this repository. Everything the site does depends on it, and
the only copy is inside the Supabase project. That is the gap this file exists
to close.

## Why it matters more than it looks

The policies *are* the access control. `README.md` is careful to say that the
admin panel hiding a tab is presentation and the database is the real rule —
which is right, and means the rules are only written down in one place, and
that place is not here.

Concretely, if the Supabase project were deleted tomorrow:

- the catalogue would still be in `data.json`, in git;
- the product photos would still be in `images/`, in git;
- **every table, policy and function would be gone**, and rebuilding them would
  be someone reading five HTML files and inferring what the database must have
  looked like from the calls made against it.

Ten minutes now, or a bad week later.

## Dumping it

There is no API for this — `pg_dump` needs the database password, which is not
in this repo and should not be. So it is done from the dashboard, by hand,
once, and then again whenever the schema changes.

**Supabase → SQL Editor**, paste and run:

```sql
-- Every table, column, constraint, index, view, function, trigger and policy
-- in the catalog schema, as one runnable script.
select
  string_agg(def, E'\n\n' order by kind, name) as schema_sql
from (
  -- tables
  select 1 as kind, c.relname as name,
         'create table if not exists catalog.' || c.relname || ' (' || E'\n  ' ||
         string_agg(
           a.attname || ' ' || format_type(a.atttypid, a.atttypmod) ||
           coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '') ||
           case when a.attnotnull then ' not null' else '' end,
           E',\n  ' order by a.attnum) || E'\n);' as def
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'catalog'
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
   where c.relkind = 'r'
   group by c.relname

  union all
  -- constraints and indexes
  select 2, conname, 'alter table catalog.' || conrelid::regclass::text ||
         ' add constraint ' || conname || ' ' || pg_get_constraintdef(oid) || ';'
    from pg_constraint
   where connamespace = 'catalog'::regnamespace
  union all
  select 3, indexname, indexdef || ';' from pg_indexes where schemaname = 'catalog'

  union all
  -- views
  select 4, viewname, 'create or replace view catalog.' || viewname ||
         ' as ' || definition
    from pg_views where schemaname = 'catalog'

  union all
  -- functions (the admin_* / shop_* RPCs the pages call)
  select 5, proname, pg_get_functiondef(p.oid) || ';'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'catalog'

  union all
  -- row-level security: the part that is the actual access control
  select 6, policyname,
         'alter table catalog.' || tablename || ' enable row level security;' ||
         E'\n' || 'create policy "' || policyname || '" on catalog.' || tablename ||
         ' for ' || cmd ||
         coalesce(' to ' || array_to_string(roles, ', '), '') ||
         coalesce(' using (' || qual || ')', '') ||
         coalesce(' with check (' || with_check || ')', '') || ';'
    from pg_policies where schemaname = 'catalog'

  union all
  -- triggers
  select 7, tgname, pg_get_triggerdef(t.oid) || ';'
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'catalog'
   where not t.tgisinternal
) x;
```

Copy the single cell it returns into **`supabase/02_live_schema.sql`** and
commit it. Add a line at the top saying which date it was taken on — a dump
with no date is a dump nobody trusts.

## Files to run, in order

| File | What it does | Run it? |
|---|---|---|
| `01_schema.sql` | The original four tables. History only — **not** the live schema | no |
| `02_seed.sql` | Sample rows for a fresh project | only on a fresh project |
| `03_events.sql` | The search/event log | ✅ applied 2026-09-03 |
| `04_product_unit.sql` | `products.unit` / `products.moq`, and the RPC that writes them | ✅ applied 2026-09-03 |
| `05_signup_approvals.sql` | Signing up, departments, who may approve what, notification routing | ✅ applied 2026-09-03 |
| `06_catalogue_live.sql` | The columns the catalogue view was missing, so the app can read it instead of `data.json` | ✅ applied 2026-09-03 |

Both were applied as Supabase migrations (`events_log_reshape_and_searches_view`
and `products_unit_and_moq`), so `supabase migration list` is the authority on
what has run. The files are the explanation; the migrations are the record.

## What an agent session can reach

`AGENT-ACCESS.md` — what a Claude session can and cannot do against this
project, why, and what would have to change. Read it before concluding that
something is impossible from a session; one route needs nothing reconfigured.

## Keeping it honest

A schema dump is only worth what its freshness is worth. Re-run it whenever a
table, policy or function changes — which in practice means whenever you paste
SQL into the dashboard. The commit that changes the database should be the
commit that updates the file.

## What is deliberately not in the dump

- **`auth.users`** and anything else Supabase owns. Not ours, not our business
  to recreate.
- **Data.** This is the shape, not the contents. `data.json` and `02_seed.sql`
  cover the catalogue; the customer list is not something to have a copy of in
  a public repository.
- **Secrets.** The Fast2SMS key and the Send SMS hook secret live as edge
  function secrets and must never enter this repo. The query above cannot
  reach them, and nothing you paste back should contain them — check before
  committing.
