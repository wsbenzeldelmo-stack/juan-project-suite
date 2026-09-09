-- JUAN PROJECT shared database foundation
-- ADDITIVE migration. It does not drop or recreate existing business tables.
create extension if not exists pgcrypto;

-- Existing Workspace tables are preserved. Add only portal-facing columns.
alter table if exists public.clients add column if not exists client_code text;
alter table if exists public.projects add column if not exists project_code text;
alter table if exists public.projects add column if not exists client_visible boolean not null default true;
alter table if exists public.deliverables add column if not exists due_date date;
alter table if exists public.deliverables add column if not exists shared_drive_url text;
alter table if exists public.deliverables add column if not exists client_visible boolean not null default true;

-- Backfill display codes without changing primary keys.
with first_project as (select client_id,min(id) as first_project_id from public.projects group by client_id), ranked as (select c.id,row_number() over(order by fp.first_project_id nulls last,c.id) rn from public.clients c left join first_project fp on fp.client_id=c.id where c.client_code is null)
update public.clients c set client_code='CL-'||lpad(r.rn::text,3,'0') from ranked r where c.id=r.id and c.client_code is null;
with ranked as (select id,row_number() over(order by id) rn from public.projects where project_code is null)
update public.projects p set project_code=case when p.id ~ '^JP-[0-9]+$' then p.id else 'JP-'||lpad(r.rn::text,3,'0') end from ranked r where p.id=r.id and p.project_code is null;
create unique index if not exists clients_client_code_key on public.clients(client_code) where client_code is not null;
create unique index if not exists projects_project_code_key on public.projects(project_code) where project_code is not null;

create table if not exists public.user_roles(
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','client')) default 'client',
  created_at timestamptz not null default now()
);

create table if not exists public.portal_accounts(
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null unique references public.clients(id) on delete cascade,
  password_set boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings(
  id smallint primary key default 1 check(id=1),
  method_label text not null default 'GCash',
  account_name text,
  account_number text,
  qr_image_url text,
  instructions text,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.payment_submissions(
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  submitted_amount numeric(12,2) not null check(submitted_amount>0),
  payment_method text,
  reference_number text,
  payment_date date,
  receipt_path text not null,
  extracted_reference text,
  extracted_amount numeric(12,2),
  extracted_date date,
  extracted_method text,
  extraction_confidence numeric(5,2),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text
);
create index if not exists payment_submissions_project_idx on public.payment_submissions(project_id);
create index if not exists payment_submissions_client_idx on public.payment_submissions(client_id);
create index if not exists payment_submissions_status_idx on public.payment_submissions(status);

-- Future shared Shop catalog. Online V1 leaves Shop as Coming Soon, but this schema prevents a second catalog later.
create table if not exists public.catalog_categories(
 id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique, active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.catalog_services(
 id uuid primary key default gen_random_uuid(), category_id uuid references public.catalog_categories(id) on delete set null, name text not null, description text, price numeric(12,2) not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalog_packages(
 id uuid primary key default gen_random_uuid(), name text not null, description text, original_price numeric(12,2) not null default 0, new_price numeric(12,2) not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalog_package_items(
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.catalog_packages(id) on delete cascade, service_id uuid references public.catalog_services(id) on delete set null, item_name text not null, quantity int not null default 1 check(quantity>0), sort_order int not null default 0
);

-- Helper used by browser-side Workspace RLS.
create or replace function public.is_juan_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where auth_user_id=auth.uid() and role='admin');
$$;
revoke all on function public.is_juan_admin() from public;
grant execute on function public.is_juan_admin() to authenticated;

-- RLS: direct business-table browser access is admin-only. JUAN PROJECT Online uses server endpoints that verify the signed-in user and client ownership.
do $$ begin
  if to_regclass('public.clients') is not null then execute 'alter table public.clients enable row level security'; end if;
  if to_regclass('public.projects') is not null then execute 'alter table public.projects enable row level security'; end if;
  if to_regclass('public.deliverables') is not null then execute 'alter table public.deliverables enable row level security'; end if;
  if to_regclass('public.project_items') is not null then execute 'alter table public.project_items enable row level security'; end if;
  if to_regclass('public.payments') is not null then execute 'alter table public.payments enable row level security'; end if;
end $$;
alter table public.user_roles enable row level security;
alter table public.portal_accounts enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_services enable row level security;
alter table public.catalog_packages enable row level security;
alter table public.catalog_package_items enable row level security;

-- Safe idempotent policy creation.
do $$
begin
  if to_regclass('public.clients') is not null and not exists(select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='juan_admin_clients') then execute 'create policy juan_admin_clients on public.clients for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())'; end if;
  if to_regclass('public.projects') is not null and not exists(select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='juan_admin_projects') then execute 'create policy juan_admin_projects on public.projects for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())'; end if;
  if to_regclass('public.deliverables') is not null and not exists(select 1 from pg_policies where schemaname='public' and tablename='deliverables' and policyname='juan_admin_deliverables') then execute 'create policy juan_admin_deliverables on public.deliverables for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())'; end if;
  if to_regclass('public.project_items') is not null and not exists(select 1 from pg_policies where schemaname='public' and tablename='project_items' and policyname='juan_admin_project_items') then execute 'create policy juan_admin_project_items on public.project_items for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())'; end if;
  if to_regclass('public.payments') is not null and not exists(select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='juan_admin_payments') then execute 'create policy juan_admin_payments on public.payments for all to authenticated using (public.is_juan_admin()) with check (public.is_juan_admin())'; end if;
end $$;

create policy "role owner read" on public.user_roles for select to authenticated using(auth_user_id=auth.uid() or public.is_juan_admin());
create policy "admin manages roles" on public.user_roles for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "portal account owner read" on public.portal_accounts for select to authenticated using(auth_user_id=auth.uid() or public.is_juan_admin());
create policy "admin manages portal accounts" on public.portal_accounts for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "payment settings admin" on public.payment_settings for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "submission owner read" on public.payment_submissions for select to authenticated using(public.is_juan_admin() or exists(select 1 from public.portal_accounts a where a.auth_user_id=auth.uid() and a.client_id=payment_submissions.client_id));
create policy "submission admin manage" on public.payment_submissions for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "catalog categories public read" on public.catalog_categories for select to anon,authenticated using(active=true or public.is_juan_admin());
create policy "catalog services public read" on public.catalog_services for select to anon,authenticated using(active=true or public.is_juan_admin());
create policy "catalog packages public read" on public.catalog_packages for select to anon,authenticated using(active=true or public.is_juan_admin());
create policy "catalog package items public read" on public.catalog_package_items for select to anon,authenticated using(true);
create policy "catalog categories admin" on public.catalog_categories for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "catalog services admin" on public.catalog_services for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "catalog packages admin" on public.catalog_packages for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());
create policy "catalog package items admin" on public.catalog_package_items for all to authenticated using(public.is_juan_admin()) with check(public.is_juan_admin());

-- Private receipt bucket. Client uploads only inside auth.uid()/...; server/admin reads with service credentials.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy "receipt owner upload" on storage.objects for insert to authenticated with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "receipt owner read" on storage.objects for select to authenticated using(bucket_id='payment-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_juan_admin()));
create policy "receipt admin manage" on storage.objects for all to authenticated using(bucket_id='payment-receipts' and public.is_juan_admin()) with check(bucket_id='payment-receipts' and public.is_juan_admin());
