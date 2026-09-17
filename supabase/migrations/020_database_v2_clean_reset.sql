-- JUAN PROJECT DATABASE V2 — CLEAN RESET
-- DESTRUCTIVE for PUBLIC JUAN PROJECT business tables.
-- Preserves existing Workspace admin role mappings when public.user_roles exists.
-- Does NOT delete Supabase Auth users.

begin;

create extension if not exists pgcrypto;

create temporary table if not exists _jp_admin_backup(
  auth_user_id uuid primary key,
  role text not null
) on commit drop;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    insert into _jp_admin_backup(auth_user_id, role)
    select auth_user_id, role
    from public.user_roles
    where auth_user_id is not null and role = 'admin'
    on conflict (auth_user_id) do nothing;
  end if;
end $$;

drop view if exists public.project_financials cascade;
drop table if exists public.juan_sync_events cascade;
drop table if exists public.workspace_shared_state cascade;
drop table if exists public.workspace_settings cascade;
drop table if exists public.invoices cascade;
drop table if exists public.payment_submissions cascade;
drop table if exists public.payments cascade;
drop table if exists public.deliverables cascade;
drop table if exists public.project_items cascade;
drop table if exists public.projects cascade;
drop table if exists public.portal_accounts cascade;
drop table if exists public.catalog_package_items cascade;
drop table if exists public.catalog_packages cascade;
drop table if exists public.catalog_services cascade;
drop table if exists public.catalog_categories cascade;
drop table if exists public.clients cascade;
drop table if exists public.user_roles cascade;

drop function if exists public.is_juan_admin() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.assign_client_code() cascade;
drop function if exists public.assign_project_code() cascade;

create table public.user_roles(
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

insert into public.user_roles(auth_user_id, role)
select auth_user_id, role from _jp_admin_backup
on conflict (auth_user_id) do update set role = excluded.role;

create or replace function public.is_juan_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

create sequence public.client_code_seq start 1;

create table public.clients(
  id text primary key default gen_random_uuid()::text,
  client_code text not null unique,
  name text not null,
  email text not null,
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_email_not_blank check (btrim(email) <> '')
);

create unique index clients_email_unique_active
on public.clients(lower(btrim(email)))
where archived_at is null;

create or replace function public.assign_client_code()
returns trigger language plpgsql as $$
begin
  if new.client_code is null or btrim(new.client_code) = '' then
    new.client_code := 'CL-' || lpad(nextval('public.client_code_seq')::text, 3, '0');
  end if;
  return new;
end $$;

create trigger clients_assign_code
before insert on public.clients
for each row execute function public.assign_client_code();

create table public.portal_accounts(
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique references public.clients(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  portal_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.project_code_seq start 1;

create table public.projects(
  id text primary key default gen_random_uuid()::text,
  project_code text not null unique,
  client_id text not null references public.clients(id) on delete restrict,
  title text not null,
  status text not null default 'Pending',
  delivery_status text not null default 'Pending',
  priority boolean not null default false,
  project_type text not null default '',
  pricing_version text not null default 'v2' check (pricing_version in ('legacy','v2')),
  start_date date,
  deadline_date date,
  discount_amount numeric(12,2) not null default 0,
  rush_fee numeric(12,2) not null default 0,
  rush_days_early integer not null default 0,
  system_maintenance_fee numeric(12,2) not null default 0,
  workload_surcharge numeric(12,2) not null default 0,
  workload_snapshot integer not null default 0,
  subtotal_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text not null default '',
  drive_url text,
  drive_unlock_at timestamptz,
  drive_expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_client_id_idx on public.projects(client_id);

create or replace function public.assign_project_code()
returns trigger language plpgsql as $$
begin
  if new.project_code is null or btrim(new.project_code) = '' then
    new.project_code := 'JP-' || lpad(nextval('public.project_code_seq')::text, 3, '0');
  end if;
  return new;
end $$;

create trigger projects_assign_code
before insert on public.projects
for each row execute function public.assign_project_code();

create table public.catalog_categories(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_services(
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  category_id uuid references public.catalog_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_packages(
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  category_id uuid references public.catalog_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  original_price numeric(12,2) not null default 0,
  new_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_package_items(
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.catalog_packages(id) on delete cascade,
  service_id uuid references public.catalog_services(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index catalog_package_items_package_idx
on public.catalog_package_items(package_id);

create table public.project_items(
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects(id) on delete cascade,
  parent_item_id text references public.project_items(id) on delete cascade,
  catalog_service_id uuid references public.catalog_services(id) on delete set null,
  catalog_package_id uuid references public.catalog_packages(id) on delete set null,
  product_code text,
  name text not null,
  item_type text not null default 'SOLO'
    check (item_type in ('SOLO','PACKAGE','PACKAGE_COMPONENT','CUSTOM')),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  billable boolean not null default true,
  counts_as_deliverable boolean not null default true,
  status text not null default 'Pending',
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  completed_at timestamptz,
  shared_drive_url text,
  client_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_items_package_parent check (
    (item_type <> 'PACKAGE_COMPONENT') or parent_item_id is not null
  )
);

create index project_items_project_idx on public.project_items(project_id);
create index project_items_parent_idx on public.project_items(parent_item_id);
create index project_items_deliverable_idx on public.project_items(project_id, counts_as_deliverable);

create table public.payment_submissions(
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  submitted_amount numeric(12,2) not null check (submitted_amount > 0),
  payment_method text not null,
  reference_number text not null,
  proof_url text,
  status text not null default 'Pending'
    check (status in ('Pending','Approved','Rejected')),
  review_notes text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_submissions_reference_unique
on public.payment_submissions(lower(regexp_replace(reference_number,'[[:space:]]','','g')));

create table public.payments(
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  submission_id uuid unique references public.payment_submissions(id) on delete set null,
  amount_paid numeric(12,2) not null check (amount_paid > 0),
  payment_date date not null default current_date,
  payment_method text not null,
  reference_no text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index payments_project_idx on public.payments(project_id);

create unique index payments_reference_unique
on public.payments(lower(regexp_replace(reference_no,'[[:space:]]','','g')))
where reference_no is not null and btrim(reference_no) <> '';

create table public.invoices(
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null default 'UNPAID'
    check (status in ('PAID','PARTIALLY PAID','UNPAID','OVERDUE')),
  issue_date date not null default current_date,
  due_date date,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_settings(
  id integer primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.workspace_shared_state(
  id integer primary key default 1 check (id = 1),
  tasks jsonb not null default '[]'::jsonb,
  templates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.workspace_settings(id) values (1) on conflict do nothing;
insert into public.workspace_shared_state(id) values (1) on conflict do nothing;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'clients','portal_accounts','projects','catalog_categories',
    'catalog_services','catalog_packages','project_items',
    'payment_submissions','invoices','workspace_settings','workspace_shared_state'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end $$;

create or replace view public.project_financials
with (security_invoker = true)
as
with item_totals as (
  select
    p.id as project_id,
    coalesce(sum(case when pi.billable then pi.quantity * pi.unit_price else 0 end),0)::numeric(12,2) as subtotal,
    count(*) filter (where pi.counts_as_deliverable) as deliverable_count,
    bool_or(pi.item_type = 'PACKAGE') as has_package
  from public.projects p
  left join public.project_items pi on pi.project_id = p.id
  group by p.id
),
payment_totals as (
  select project_id, coalesce(sum(amount_paid),0)::numeric(12,2) as paid_amount
  from public.payments group by project_id
),
calc as (
  select
    p.*,
    i.subtotal,
    i.deliverable_count,
    coalesce(i.has_package,false) as has_package,
    case when coalesce(i.has_package,false) then 14 else 10 end as v2_standard_days,
    case
      when p.start_date is null or p.deadline_date is null then 0
      else greatest(
        (case when coalesce(i.has_package,false) then 14 else 10 end)
        - greatest((p.deadline_date - p.start_date),0),
        0
      )
    end as v2_days_early,
    case
      when i.deliverable_count <= 3 then 500
      when i.deliverable_count <= 8 then 800
      else 1200
    end::numeric(12,2) as v2_rush_rate,
    coalesce(pay.paid_amount,0)::numeric(12,2) as paid_amount
  from public.projects p
  join item_totals i on i.project_id = p.id
  left join payment_totals pay on pay.project_id = p.id
)
select
  project_id, project_code, client_id, title, pricing_version,
  subtotal, deliverable_count, has_package,
  case when pricing_version='v2' then v2_standard_days else null end as standard_days,
  case when pricing_version='v2' then v2_days_early else rush_days_early end as days_early,
  case when pricing_version='v2' then v2_rush_rate else null end as rush_rate,
  case
    when pricing_version='v2'
      then (case when v2_days_early > 0 then ceil(v2_days_early / 4.0) else 0 end) * v2_rush_rate
    else rush_fee
  end::numeric(12,2) as rush_fee,
  case
    when pricing_version='v2' then case when has_package then 31 else 30 end
    else system_maintenance_fee
  end::numeric(12,2) as maintenance_fee,
  discount_amount, workload_surcharge,
  (
    subtotal
    + case when pricing_version='v2'
        then (case when v2_days_early > 0 then ceil(v2_days_early / 4.0) else 0 end) * v2_rush_rate
        else rush_fee end
    + case when pricing_version='v2' then case when has_package then 31 else 30 end
        else system_maintenance_fee end
    + workload_surcharge - discount_amount
  )::numeric(12,2) as project_total,
  paid_amount,
  greatest(
    subtotal
    + case when pricing_version='v2'
        then (case when v2_days_early > 0 then ceil(v2_days_early / 4.0) else 0 end) * v2_rush_rate
        else rush_fee end
    + case when pricing_version='v2' then case when has_package then 31 else 30 end
        else system_maintenance_fee end
    + workload_surcharge - discount_amount - paid_amount,
    0
  )::numeric(12,2) as balance_due
from calc;

alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.portal_accounts enable row level security;
alter table public.projects enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_services enable row level security;
alter table public.catalog_packages enable row level security;
alter table public.catalog_package_items enable row level security;
alter table public.project_items enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.workspace_shared_state enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'user_roles','clients','portal_accounts','projects','catalog_categories',
    'catalog_services','catalog_packages','catalog_package_items','project_items',
    'payment_submissions','payments','invoices','workspace_settings','workspace_shared_state'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

create policy portal_accounts_self_read on public.portal_accounts
for select to authenticated using (auth_user_id = auth.uid());

create policy clients_portal_self_read on public.clients
for select to authenticated using (
  exists(
    select 1 from public.portal_accounts pa
    where pa.client_id = clients.id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy projects_portal_read on public.projects
for select to authenticated using (
  exists(
    select 1 from public.portal_accounts pa
    where pa.client_id = projects.client_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy project_items_portal_read on public.project_items
for select to authenticated using (
  client_visible and exists(
    select 1
    from public.projects p
    join public.portal_accounts pa on pa.client_id = p.client_id
    where p.id = project_items.project_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy payments_portal_read on public.payments
for select to authenticated using (
  exists(
    select 1
    from public.projects p
    join public.portal_accounts pa on pa.client_id = p.client_id
    where p.id = payments.project_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy payment_submissions_portal_read on public.payment_submissions
for select to authenticated using (
  exists(
    select 1 from public.portal_accounts pa
    where pa.client_id = payment_submissions.client_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy payment_submissions_portal_insert on public.payment_submissions
for insert to authenticated with check (
  status = 'Pending'
  and exists(
    select 1 from public.portal_accounts pa
    where pa.client_id = payment_submissions.client_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
  and exists(
    select 1 from public.projects p
    where p.id = payment_submissions.project_id
      and p.client_id = payment_submissions.client_id
  )
);

create policy invoices_portal_read on public.invoices
for select to authenticated using (
  exists(
    select 1
    from public.projects p
    join public.portal_accounts pa on pa.client_id = p.client_id
    where p.id = invoices.project_id
      and pa.auth_user_id = auth.uid()
      and pa.portal_enabled
  )
);

create policy catalog_categories_public_read on public.catalog_categories
for select to anon, authenticated using (active);

create policy catalog_services_public_read on public.catalog_services
for select to anon, authenticated using (active);

create policy catalog_packages_public_read on public.catalog_packages
for select to anon, authenticated using (active);

create policy catalog_package_items_public_read on public.catalog_package_items
for select to anon, authenticated using (
  exists(
    select 1 from public.catalog_packages p
    where p.id = catalog_package_items.package_id and p.active
  )
);

do $$
begin
  begin alter publication supabase_realtime add table public.clients; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payment_submissions; exception when duplicate_object then null; end;
end $$;

commit;

notify pgrst, 'reload schema';
