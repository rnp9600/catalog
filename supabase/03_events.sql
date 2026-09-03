-- ═══════════════════════════════════════════════════════════════
-- catalog.events — what people looked for
--
-- ✅ APPLIED to the Chandler project (vcrzauuxvgpsbforiszz) on 2026-09-03,
--    as migration `events_log_reshape_and_searches_view`. Kept here as the
--    record of what the schema is, and to rebuild it on a fresh project.
--
-- WHY THIS EXISTS
-- The most useful thing this business could know is what a dealer searched
-- for and got nothing back. That is a product they wanted and we either do not
-- stock, or do stock under a name nobody types. Every one of those searches
-- was being thrown away.
--
-- WHAT IT DELIBERATELY IS NOT
-- Anyone may INSERT. Only admin and office may SELECT, and there is no UPDATE
-- or DELETE policy at all — the log is append-only to everyone. A browsing log
-- the page can read back out is a different and worse thing than a browsing
-- log: one dealer must never be able to pull what another has been pricing up.
-- The policies below are the whole of that guarantee, so read them before
-- changing them.
--
-- TWO THINGS THIS FILE GOT WRONG BEFORE IT WAS RUN, both worth knowing:
--
--  1. It identified the caller as `auth.jwt() ->> 'phone'`. Every other policy
--     in this schema strips the leading '+' first, because that is how numbers
--     are stored in allowlist. The policy would have compiled, run, and matched
--     nobody — the panel would have shown "could not read" to the admin too.
--     Use the helpers: catalog.can_edit_catalogue() is this schema's own name
--     for "admin or staff".
--
--  2. It assumed the table did not exist. It did — empty and never written to,
--     from an earlier attempt at the same idea, with a NOT NULL `product`
--     column and kinds ('view','share','enquire') no code has ever written.
--     `create table if not exists` would have silently done nothing and left
--     every insert failing on that NOT NULL.
-- ═══════════════════════════════════════════════════════════════

-- On a fresh project, create it:
create table if not exists catalog.events (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  -- Null for anyone browsing signed out, which consumers do. Not a foreign
  -- key: a row should survive the account being removed, and it carries no
  -- more than the number that is already the sign-in.
  phone   text,
  kind    text not null,
  q       text,          -- the search as typed
  slug    text,          -- the product opened
  n       int,           -- how many results that search returned
  meta    jsonb
);

-- On the existing project this was the reshape (kept so the file describes the
-- real history rather than a tidy fiction):
--   drop view if exists catalog.product_stats;
--   alter table catalog.events
--     add column if not exists q text, add column if not exists slug text,
--     add column if not exists n int, add column if not exists meta jsonb;
--   alter table catalog.events drop column if exists product;

alter table catalog.events drop constraint if exists events_kind_check;
alter table catalog.events add constraint events_kind_check
  check (kind in ('search','open','order','zero'));

create index if not exists idx_events_at    on catalog.events (at desc);
create index if not exists idx_events_kind  on catalog.events (kind, at desc);
-- The query the admin panel actually runs: zero-result searches, newest first.
create index if not exists idx_events_zero  on catalog.events (at desc) where kind = 'zero';

alter table catalog.events enable row level security;

-- Write: anyone, signed in or not. There is nothing to gain by forging a row
-- and something real to lose by only measuring signed-in dealers.
drop policy if exists "anyone may log an event" on catalog.events;
create policy "anyone may log an event"
  on catalog.events for insert
  to anon, authenticated
  with check (true);

-- Read: admin and office only. can_edit_catalogue() = is_admin() or role
-- 'staff', which is exactly who the What's missing tab is open to.
drop policy if exists "admins may read events" on catalog.events;
drop policy if exists "admin and staff may read events" on catalog.events;
create policy "admin and staff may read events"
  on catalog.events for select
  to authenticated
  using (catalog.can_edit_catalogue());

grant insert on catalog.events to anon, authenticated;
grant select on catalog.events to authenticated;
-- No sequence grant: id is GENERATED ALWAYS AS IDENTITY.
--
-- anon has INSERT and not SELECT, which is the point — so the client must not
-- ask for the row back. supabase-js sends `return=minimal` when .insert() has
-- no .select(), which is how index.html calls it. Adding .select() there would
-- turn every logged event into a 42501.

-- What the admin panel reads: the searches that found nothing, most-asked
-- first. This is the table's reason for existing, so it gets a view of its own.
create or replace view catalog.searches_with_nothing as
  select lower(btrim(q)) as query,
         count(*)        as times,
         max(at)         as last_asked
    from catalog.events
   where kind = 'zero' and q is not null and btrim(q) <> ''
   group by 1
   order by times desc, last_asked desc;

-- Per-product interest. Replaces an earlier view of the same name that counted
-- kinds nothing ever wrote; 'open' is the only per-product event recorded.
create or replace view catalog.product_stats as
  select slug     as product,
         count(*) as opens,
         max(at)  as last_seen
    from catalog.events
   where kind = 'open' and slug is not null
   group by slug;

-- security_invoker so the views run as their caller and the SELECT policy above
-- still applies through them. Without it a view owned by postgres would hand
-- the whole log to anyone who could select from it.
alter view catalog.searches_with_nothing set (security_invoker = on);
alter view catalog.product_stats         set (security_invoker = on);
grant select on catalog.searches_with_nothing to authenticated;
grant select on catalog.product_stats         to authenticated;

-- Housekeeping. Nothing here is worth keeping for years; a rolling year is
-- plenty to see a season repeat. Run it whenever, or wire it to pg_cron.
--   delete from catalog.events where at < now() - interval '1 year';
