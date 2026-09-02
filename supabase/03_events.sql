-- ═══════════════════════════════════════════════════════════════
-- catalog.events — what people looked for
--
-- Run once in Supabase → SQL Editor. Until it is run, the catalogue simply
-- does not log (every insert fails and is swallowed) and the admin panel says
-- so rather than showing an empty list that looks like nobody uses the site.
--
-- WHY THIS EXISTS
-- The most useful thing this business could know is what a dealer searched
-- for and got nothing back. That is a product they wanted and we either do not
-- stock, or do stock under a name nobody types. Every one of those searches
-- was being thrown away.
--
-- WHAT IT DELIBERATELY IS NOT
-- Anyone may INSERT. Only admin and staff may SELECT. A browsing log the page
-- can read back out is a different and worse thing than a browsing log — one
-- dealer must never be able to pull what another dealer has been pricing up.
-- The policies below are the whole of that guarantee, so read them before
-- changing them.
--
-- It is also not analytics-for-its-own-sake: four kinds of row, no device
-- fingerprint, no IP, no third party, nothing leaving this database.
-- ═══════════════════════════════════════════════════════════════

create table if not exists catalog.events (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  -- Null for anyone browsing signed out, which consumers do. Not a foreign
  -- key: a row should survive the account being removed, and it carries no
  -- more than the number that is already the sign-in.
  phone   text,
  kind    text not null check (kind in ('search','open','order','zero')),
  q       text,          -- the search as typed
  slug    text,          -- the product opened
  n       int,           -- how many results that search returned
  meta    jsonb
);

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

-- Read: admin and office only. Note this is a SELECT policy and there is
-- deliberately no UPDATE or DELETE policy at all — the log is append-only to
-- everyone, including the admin panel.
drop policy if exists "admin and staff may read events" on catalog.events;
create policy "admin and staff may read events"
  on catalog.events for select
  to authenticated
  using (exists (
    select 1 from catalog.allowlist a
     where a.phone = (auth.jwt() ->> 'phone')
       and (a.is_admin or a.role in ('admin','staff'))
  ));

grant insert on catalog.events to anon, authenticated;
grant select on catalog.events to authenticated;
grant usage, select on sequence catalog.events_id_seq to anon, authenticated;

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

-- The view runs as its caller, so the SELECT policy above still applies to it.
alter view catalog.searches_with_nothing set (security_invoker = on);
grant select on catalog.searches_with_nothing to authenticated;

-- Housekeeping. Nothing here is worth keeping for years; a rolling year is
-- plenty to see a season repeat. Run it whenever, or wire it to pg_cron.
--   delete from catalog.events where at < now() - interval '1 year';
