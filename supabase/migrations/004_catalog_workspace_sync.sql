-- JUAN PROJECT catalog synchronization bridge
-- ADDITIVE migration. Run after 001, 002, and 003.
-- Adds stable seller-side catalog codes so JUAN PROJECT Workspace and
-- JUAN PROJECT Online can share one catalog without duplicating products.

alter table if exists public.catalog_services
  add column if not exists product_code text;

alter table if exists public.catalog_packages
  add column if not exists product_code text;

alter table if exists public.catalog_packages
  add column if not exists category_id uuid references public.catalog_categories(id) on delete set null;

-- Backfill stable codes for catalog rows that existed before Workspace sync was enabled.
with base as (
  select coalesce(max((substring(product_code from '([0-9]+)$'))::integer), 0) as max_no
  from public.catalog_services
  where product_code ~ '^SRV-[0-9]+$'
), ranked as (
  select id, row_number() over(order by created_at nulls last, id) as rn
  from public.catalog_services
  where product_code is null or btrim(product_code) = ''
)
update public.catalog_services s
set product_code = 'SRV-' || lpad((b.max_no + r.rn)::text, 3, '0')
from ranked r cross join base b
where s.id = r.id and (s.product_code is null or btrim(s.product_code) = '');

with base as (
  select coalesce(max((substring(product_code from '([0-9]+)$'))::integer), 0) as max_no
  from public.catalog_packages
  where product_code ~ '^PKG-[0-9]+$'
), ranked as (
  select id, row_number() over(order by created_at nulls last, id) as rn
  from public.catalog_packages
  where product_code is null or btrim(product_code) = ''
)
update public.catalog_packages p
set product_code = 'PKG-' || lpad((b.max_no + r.rn)::text, 3, '0')
from ranked r cross join base b
where p.id = r.id and (p.product_code is null or btrim(p.product_code) = '');

create unique index if not exists catalog_services_product_code_key
  on public.catalog_services(product_code);

create unique index if not exists catalog_packages_product_code_key
  on public.catalog_packages(product_code);

-- For older package rows, infer the category from the first linked service when possible.
with inferred as (
  select distinct on (pi.package_id)
    pi.package_id,
    s.category_id
  from public.catalog_package_items pi
  join public.catalog_services s on s.id = pi.service_id
  where s.category_id is not null
  order by pi.package_id, pi.sort_order, pi.id
)
update public.catalog_packages p
set category_id = i.category_id
from inferred i
where p.id = i.package_id and p.category_id is null;

-- Explicit grants are still constrained by the RLS policies installed in 001.
grant select, insert, update, delete on public.catalog_categories to authenticated;
grant select, insert, update, delete on public.catalog_services to authenticated;
grant select, insert, update, delete on public.catalog_packages to authenticated;
grant select, insert, update, delete on public.catalog_package_items to authenticated;
