-- Patel Marketing — 05: signing up, and being approved.
-- ---------------------------------------------------------------------------
-- Until now a number either existed in catalog.allowlist or it did not, and
-- the only self-service path was self_signup_end_customer(), which created the
-- row on the spot with nobody asked. Everyone else — every dealer, every
-- member of staff — had to be typed in by an admin. That is the bottleneck
-- this file removes.
--
-- The shape:
--
--   1. Anyone can sign in with an OTP. That proves the phone, nothing more.
--   2. A number with no allowlist row fills a form. The form lands in
--      catalog.signup_requests as PENDING. They can browse, they cannot trade.
--   3. The request raises a notification, routed to the people whose job it
--      is — not to every member of staff. A delivery boy does not need to see
--      a dealer application.
--   4. Someone with the right to decide approves or rejects. Approving writes
--      the allowlist row, and only then does the account work.
--
-- Who may decide is deliberately narrow. An admin may decide anything. A
-- member of staff may decide only what their DEPARTMENT is marked for, so
-- "office manager approves new staff" is a row in a table rather than a
-- special case in code — and the office can change it without a deploy.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Departments
-- ===========================================================================
-- There is one "staff" role and there always will be, because the DATABASE's
-- questions are "can this person edit the catalogue" and "can this person see
-- the order book". What differs between an accountant and a delivery boy is
-- which notifications land on them and what they may approve — and that is
-- what a department is for.
create table if not exists catalog.departments (
  id                   text primary key,
  label                text not null,
  sort                 int  not null default 100,
  -- The whole of "who may approve what". Three booleans instead of three
  -- special cases spread through the functions below.
  approve_dealer       boolean not null default false,
  approve_staff        boolean not null default false,
  approve_customer     boolean not null default false
);

insert into catalog.departments (id, label, sort, approve_dealer, approve_staff, approve_customer)
values
  ('office_manager','Office manager', 10, true,  true,  true ),
  ('sales',         'Sales',          20, true,  false, true ),
  ('accounts',      'Accounts',       30, false, false, false),
  ('purchase',      'Purchase',       40, false, false, false),
  ('delivery',      'Delivery',       50, false, false, false),
  ('collection',    'Collection',     60, false, false, false)
on conflict (id) do update
  set label=excluded.label, sort=excluded.sort,
      approve_dealer=excluded.approve_dealer,
      approve_staff=excluded.approve_staff,
      approve_customer=excluded.approve_customer;

-- ===========================================================================
-- 2. What the allowlist has to carry now
-- ===========================================================================
alter table catalog.allowlist
  add column if not exists dept          text references catalog.departments(id),
  add column if not exists area          text,          -- "Gokul Road", for the tag
  add column if not exists address       text,
  add column if not exists gst_status    text,          -- registered | unregistered
  add column if not exists approved_at   timestamptz,
  add column if not exists approved_by   text;

do $$ begin
  alter table catalog.allowlist
    add constraint allowlist_gst_status_ck
    check (gst_status is null or gst_status in ('registered','unregistered'));
exception when duplicate_object then null; end $$;

-- Only staff have a department, and staff without one can approve nothing.
do $$ begin
  alter table catalog.allowlist
    add constraint allowlist_dept_staff_only
    check (dept is null or role = 'staff');
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 3. The requests themselves
-- ===========================================================================
create table if not exists catalog.signup_requests (
  id             bigint generated always as identity primary key,
  phone          text not null,
  kind           text not null check (kind in ('dealer','staff','end_customer')),

  name           text not null,
  -- Optional, and the only field the form leaves blank. When it is set the
  -- office sees it; when it is not they see "Firm name (Area)".
  nickname       text,
  business_name  text,
  area           text,
  city           text,
  address        text,
  gst            text,
  gst_status     text check (gst_status is null or gst_status in ('registered','unregistered')),
  dept           text references catalog.departments(id),
  -- Set when a dealer is vouching for a customer, so an approved customer
  -- lands attached to the right shop instead of floating.
  owner_phone    text,
  note           text,

  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  source         text not null default 'self'
                   check (source in ('self','dealer','office')),

  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     text,
  decided_note   text
);

-- One live application per number. Rejected and approved ones stay for the
-- record, so a number that was turned down once can apply again.
create unique index if not exists signup_requests_one_pending
  on catalog.signup_requests (phone) where status = 'pending';
create index if not exists signup_requests_pending_first
  on catalog.signup_requests (status, created_at desc);

-- What the office should call this applicant. The rule the counter asked for:
-- a nickname if they gave one, otherwise the firm and the area, so two
-- "Sharma Traders" are told apart at a glance.
create or replace function catalog.display_name(
  p_nickname text, p_business text, p_name text, p_area text)
returns text language sql immutable as $$
  select coalesce(
    nullif(trim(coalesce(p_nickname,'')), ''),
    nullif(trim(coalesce(p_business, p_name, '')), '')
      || case when nullif(trim(coalesce(p_area,'')),'') is not null
              then ' (' || trim(p_area) || ')' else '' end,
    'Unnamed');
$$;

-- ===========================================================================
-- 4. Who may decide
-- ===========================================================================
create or replace function catalog.can_approve(p_kind text)
returns boolean language sql stable security definer
set search_path to 'catalog','public' as $$
  select case
    when catalog.is_admin() then true
    when catalog.my_role() <> 'staff' then false
    else coalesce((
      select case p_kind
               when 'dealer'       then d.approve_dealer
               when 'staff'        then d.approve_staff
               when 'end_customer' then d.approve_customer
               else false end
        from catalog.allowlist a
        join catalog.departments d on d.id = a.dept
       where a.phone = catalog.my_phone()
    ), false)
  end;
$$;

-- Anything at all? Used by the app to decide whether to show the queue.
create or replace function catalog.can_approve_any()
returns boolean language sql stable security definer
set search_path to 'catalog','public' as $$
  select catalog.can_approve('dealer')
      or catalog.can_approve('staff')
      or catalog.can_approve('end_customer');
$$;

-- ===========================================================================
-- 5. Notifications, routed by department
-- ===========================================================================
-- The point of the routing table is that "who hears about a new dealer" is
-- data. Sales should not have to wait for a deploy to stop getting delivery
-- notices, and a new department needs no code at all.
create table if not exists catalog.notify_routes (
  kind text not null,
  role text not null check (role in ('admin','staff')),
  dept text not null default '*',        -- '*' = every staff member
  primary key (kind, role, dept)
);

insert into catalog.notify_routes (kind, role, dept) values
  ('signup_dealer',       'admin','*'),
  ('signup_dealer',       'staff','office_manager'),
  ('signup_dealer',       'staff','sales'),
  ('signup_staff',        'admin','*'),
  ('signup_staff',        'staff','office_manager'),
  ('signup_end_customer', 'admin','*'),
  ('signup_end_customer', 'staff','office_manager'),
  ('signup_end_customer', 'staff','sales'),
  -- An approved customer with no shop behind them is somebody's job.
  ('customer_unattached', 'admin','*'),
  ('customer_unattached', 'staff','sales')
on conflict do nothing;

create table if not exists catalog.notifications (
  id         bigint generated always as identity primary key,
  kind       text not null,
  title      text not null,
  body       text,
  ref_id     bigint,                     -- the signup_request, where there is one
  created_at timestamptz not null default now()
);
create index if not exists notifications_recent on catalog.notifications (created_at desc);

create table if not exists catalog.notification_targets (
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  role            text not null,
  dept            text not null default '*',
  primary key (notification_id, role, dept)
);

create table if not exists catalog.notification_reads (
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  phone           text not null,
  read_at         timestamptz not null default now(),
  primary key (notification_id, phone)
);

-- Raise one, addressed by the routing table.
create or replace function catalog.notify(p_kind text, p_title text, p_body text, p_ref bigint)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare nid bigint;
begin
  insert into catalog.notifications (kind, title, body, ref_id)
  values (p_kind, p_title, p_body, p_ref) returning id into nid;

  insert into catalog.notification_targets (notification_id, role, dept)
  select nid, r.role, r.dept from catalog.notify_routes r where r.kind = p_kind
  on conflict do nothing;

  return nid;
end; $$;

-- What THIS person should see, newest first, with whether they have read it.
create or replace view catalog.my_notifications as
  select n.id, n.kind, n.title, n.body, n.ref_id, n.created_at,
         (rd.phone is not null) as is_read
    from catalog.notifications n
    join catalog.notification_targets t on t.notification_id = n.id
    left join catalog.notification_reads rd
           on rd.notification_id = n.id and rd.phone = catalog.my_phone()
   where (t.role = 'admin' and catalog.is_admin())
      or (t.role = 'staff'
          and catalog.my_role() = 'staff'
          and (t.dept = '*' or t.dept = (
                select a.dept from catalog.allowlist a where a.phone = catalog.my_phone())))
   order by n.created_at desc;

create or replace function catalog.mark_notifications_read(p_ids bigint[])
returns void language sql security definer
set search_path to 'catalog','public' as $$
  insert into catalog.notification_reads (notification_id, phone)
  select unnest(p_ids), catalog.my_phone()
  where coalesce(catalog.my_phone(),'') <> ''
  on conflict do nothing;
$$;

-- ===========================================================================
-- 6. Submitting
-- ===========================================================================
-- One entry point, so the phone can never be spoofed: it comes from the JWT,
-- not from the payload. A number that is already on the allowlist is told so
-- rather than queued behind an approval it does not need.
create or replace function catalog.submit_signup(payload jsonb)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare
  ph   text := catalog.my_phone();
  k    text := coalesce(payload->>'kind','end_customer');
  nm   text := nullif(trim(coalesce(payload->>'name','')), '');
  rid  bigint;
begin
  if coalesce(ph,'') = '' then raise exception 'not signed in'; end if;
  if nm is null then raise exception 'a name is needed'; end if;
  if k not in ('dealer','staff','end_customer') then raise exception 'unknown kind'; end if;

  if exists (select 1 from catalog.allowlist where phone = ph) then
    raise exception 'that number is already set up — just sign in';
  end if;

  -- A staff application must name a department, or nobody can route it.
  if k = 'staff' and nullif(payload->>'dept','') is null then
    raise exception 'which department?';
  end if;

  insert into catalog.signup_requests
    (phone, kind, name, nickname, business_name, area, city, address,
     gst, gst_status, dept, owner_phone, note, source)
  values
    (ph, k, nm,
     nullif(trim(coalesce(payload->>'nickname','')),''),
     nullif(trim(coalesce(payload->>'business_name','')),''),
     nullif(trim(coalesce(payload->>'area','')),''),
     nullif(trim(coalesce(payload->>'city','')),''),
     nullif(trim(coalesce(payload->>'address','')),''),
     nullif(trim(coalesce(payload->>'gst','')),''),
     nullif(payload->>'gst_status',''),
     nullif(payload->>'dept',''),
     nullif(regexp_replace(coalesce(payload->>'owner_phone',''), '\D', '', 'g'),''),
     nullif(trim(coalesce(payload->>'note','')),''),
     'self')
  -- Re-submitting replaces the pending application rather than failing on the
  -- unique index. Someone correcting a typo should not be stuck.
  on conflict (phone) where status = 'pending' do update
    set kind=excluded.kind, name=excluded.name, nickname=excluded.nickname,
        business_name=excluded.business_name, area=excluded.area, city=excluded.city,
        address=excluded.address, gst=excluded.gst, gst_status=excluded.gst_status,
        dept=excluded.dept, owner_phone=excluded.owner_phone, note=excluded.note,
        created_at=now()
  returning id into rid;

  perform catalog.notify(
    'signup_' || k,
    case k when 'dealer' then 'New dealer application'
           when 'staff'  then 'New staff request'
           else 'New customer sign-up' end,
    catalog.display_name(
      nullif(trim(coalesce(payload->>'nickname','')),''),
      nullif(trim(coalesce(payload->>'business_name','')),''),
      nm,
      nullif(trim(coalesce(payload->>'area','')),''))
      || ' · +91' || right(ph, 10),
    rid);

  return rid;
end; $$;

-- ===========================================================================
-- 7. Deciding
-- ===========================================================================
create or replace function catalog.decide_signup(p_id bigint, p_ok boolean, p_note text default null)
returns text language plpgsql security definer
set search_path to 'catalog','public' as $$
declare r catalog.signup_requests; me text := catalog.my_phone();
begin
  select * into r from catalog.signup_requests where id = p_id;
  if r.id is null then raise exception 'no such request'; end if;
  if r.status <> 'pending' then raise exception 'that one is already %', r.status; end if;

  -- The narrow bit. A staff application in particular is admin-or-office-
  -- manager only; nothing else in the office can let someone in.
  if not catalog.can_approve(r.kind) then
    raise exception 'you are not set up to decide % applications', r.kind;
  end if;

  if not p_ok then
    update catalog.signup_requests
       set status='rejected', decided_at=now(), decided_by=me, decided_note=p_note
     where id = p_id;
    return 'rejected';
  end if;

  insert into catalog.allowlist
    (phone, name, nickname, shop, role, is_admin, city, area, address,
     gst, gst_status, dept, owner_phone, approved_at, approved_by)
  values
    (r.phone, r.name, r.nickname, r.business_name,
     case r.kind when 'dealer' then 'dealer' when 'staff' then 'staff' else 'end_customer' end,
     false, r.city, r.area, r.address, r.gst, r.gst_status,
     case when r.kind='staff' then r.dept else null end,
     r.owner_phone, now(), me)
  on conflict (phone) do update
    set name=excluded.name, nickname=excluded.nickname, shop=excluded.shop,
        role=excluded.role, city=excluded.city, area=excluded.area,
        address=excluded.address, gst=excluded.gst, gst_status=excluded.gst_status,
        dept=excluded.dept, owner_phone=excluded.owner_phone,
        approved_at=excluded.approved_at, approved_by=excluded.approved_by;

  update catalog.signup_requests
     set status='approved', decided_at=now(), decided_by=me, decided_note=p_note
   where id = p_id;

  -- A customer nobody owns is somebody's job to place, so say so once rather
  -- than letting them sit unattached and unnoticed.
  if r.kind = 'end_customer' and coalesce(r.owner_phone,'') = '' then
    perform catalog.notify('customer_unattached', 'Customer has no shop yet',
      catalog.display_name(r.nickname, r.business_name, r.name, r.area)
        || ' · +91' || right(r.phone, 10) || ' — set them against a dealer.', r.id);
  end if;

  return 'approved';
end; $$;

-- Where an applicant stands. Deliberately returns a row for a number with no
-- application at all, so the app has one question to ask instead of three.
create or replace function catalog.my_signup_status()
returns table (status text, kind text, id bigint, created_at timestamptz, decided_note text)
language sql stable security definer
set search_path to 'catalog','public' as $$
  select coalesce(
           (select 'member'::text from catalog.allowlist where phone = catalog.my_phone()),
           (select s.status from catalog.signup_requests s
             where s.phone = catalog.my_phone()
             order by s.created_at desc limit 1),
           'none'),
         (select s.kind from catalog.signup_requests s
           where s.phone = catalog.my_phone() order by s.created_at desc limit 1),
         (select s.id from catalog.signup_requests s
           where s.phone = catalog.my_phone() order by s.created_at desc limit 1),
         (select s.created_at from catalog.signup_requests s
           where s.phone = catalog.my_phone() order by s.created_at desc limit 1),
         (select s.decided_note from catalog.signup_requests s
           where s.phone = catalog.my_phone() order by s.created_at desc limit 1);
$$;

-- The queue, already filtered to what the caller may act on, and carrying the
-- display name so the app does not re-implement that rule.
create or replace view catalog.approval_queue as
  select s.id, s.phone, s.kind, s.status, s.created_at,
         catalog.display_name(s.nickname, s.business_name, s.name, s.area) as display,
         s.name, s.nickname, s.business_name, s.area, s.city, s.address,
         s.gst, s.gst_status, s.dept, s.owner_phone, s.note,
         s.decided_at, s.decided_by, s.decided_note
    from catalog.signup_requests s
   where catalog.can_approve(s.kind)
   order by (s.status='pending') desc, s.created_at desc;

-- ===========================================================================
-- 8. Row-level security
-- ===========================================================================
alter table catalog.signup_requests     enable row level security;
alter table catalog.departments         enable row level security;
alter table catalog.notify_routes       enable row level security;
alter table catalog.notifications       enable row level security;
alter table catalog.notification_targets enable row level security;
alter table catalog.notification_reads  enable row level security;

-- Requests: you may read your own; a decider may read the kinds they decide.
-- Nobody writes directly — submit_signup() and decide_signup() are the only
-- doors, and both are SECURITY DEFINER, so the phone cannot be spoofed and a
-- decision cannot be forged.
drop policy if exists sr_read_own on catalog.signup_requests;
create policy sr_read_own on catalog.signup_requests for select
  to authenticated using (phone = catalog.my_phone());

drop policy if exists sr_read_decider on catalog.signup_requests;
create policy sr_read_decider on catalog.signup_requests for select
  to authenticated using (catalog.can_approve(kind));

-- Departments and routes are readable by anyone signed in (the forms need the
-- list) and writable by an admin only.
drop policy if exists dept_read on catalog.departments;
create policy dept_read on catalog.departments for select to authenticated using (true);
drop policy if exists dept_write on catalog.departments;
create policy dept_write on catalog.departments for all
  to authenticated using (catalog.is_admin()) with check (catalog.is_admin());

drop policy if exists nr_read on catalog.notify_routes;
create policy nr_read on catalog.notify_routes for select to authenticated using (true);
drop policy if exists nr_write on catalog.notify_routes;
create policy nr_write on catalog.notify_routes for all
  to authenticated using (catalog.is_admin()) with check (catalog.is_admin());

-- Notifications are read through my_notifications, which does the routing. The
-- base tables stay closed so a dealer cannot enumerate what the office is
-- being told.
drop policy if exists ntf_read on catalog.notifications;
create policy ntf_read on catalog.notifications for select to authenticated
  using (exists (
    select 1 from catalog.notification_targets t
     where t.notification_id = notifications.id
       and ((t.role='admin' and catalog.is_admin())
         or (t.role='staff' and catalog.my_role()='staff'
             and (t.dept='*' or t.dept=(select a.dept from catalog.allowlist a
                                         where a.phone=catalog.my_phone()))))));

drop policy if exists ntg_read on catalog.notification_targets;
create policy ntg_read on catalog.notification_targets for select to authenticated
  using (catalog.is_admin() or catalog.my_role()='staff');

drop policy if exists nrd_own on catalog.notification_reads;
create policy nrd_own on catalog.notification_reads for all to authenticated
  using (phone = catalog.my_phone()) with check (phone = catalog.my_phone());

-- ===========================================================================
-- 9. Grants
-- ===========================================================================
grant usage on schema catalog to anon, authenticated;
grant select on catalog.departments, catalog.notify_routes to authenticated;
grant select on catalog.signup_requests to authenticated;
grant select on catalog.approval_queue, catalog.my_notifications to authenticated;
grant select, insert on catalog.notification_reads to authenticated;

revoke all on function catalog.notify(text,text,text,bigint) from public, anon, authenticated;
grant execute on function catalog.submit_signup(jsonb)                to authenticated;
grant execute on function catalog.decide_signup(bigint,boolean,text)  to authenticated;
grant execute on function catalog.my_signup_status()                  to authenticated;
grant execute on function catalog.can_approve(text)                   to authenticated;
grant execute on function catalog.can_approve_any()                   to authenticated;
grant execute on function catalog.mark_notifications_read(bigint[])   to authenticated;
grant execute on function catalog.display_name(text,text,text,text)   to authenticated;
