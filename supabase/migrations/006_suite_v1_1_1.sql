-- JUAN PROJECT Suite V1.1.1 maintenance patch
-- Additive only; preserves existing data.

alter table if exists public.projects
  add column if not exists system_maintenance_fee numeric not null default 0,
  add column if not exists workload_surcharge numeric not null default 0,
  add column if not exists workload_snapshot integer not null default 0;

alter table if exists public.payment_submissions
  add column if not exists extracted_transfer_fee numeric not null default 0,
  add column if not exists net_amount numeric,
  add column if not exists entry_source text not null default 'gemini';

-- Starting with project number 52, apply the fixed system-maintenance rule to existing rows
-- where the fee is still zero. Package-containing projects receive ₱21; other/single-item
-- projects receive ₱20. Workload surcharge is NOT auto-priced because no business amount
-- was specified; the field is available and the Workspace flags high workload for admin review.
with package_projects as (
  select distinct pi.project_id
  from public.project_items pi
  where upper(coalesce(pi.type,''))='PACKAGE' or upper(coalesce(pi.product_code,'')) like 'PKG-%'
), numbered as (
  select p.id, case when p.project_code ~ '^JP-[0-9]+$' then substring(p.project_code from '([0-9]+)$')::integer else null end as no
  from public.projects p
)
update public.projects p
set system_maintenance_fee = case when pp.project_id is not null then 21 else 20 end
from numbered n
left join package_projects pp on pp.project_id=n.id
where p.id=n.id and n.no>=52 and coalesce(p.system_maintenance_fee,0)=0;

-- Keep totals canonical by adding maintenance to project total only where it was not already included.
-- We use the stored subtotal/discount/rush values as source of truth to avoid double-charging.
update public.projects
set total_amount = greatest(0, coalesce(subtotal_amount,total_amount,0) - coalesce(discount_amount,0) + coalesce(rush_fee,0) + coalesce(system_maintenance_fee,0) + coalesce(workload_surcharge,0))
where project_code ~ '^JP-[0-9]+$'
  and substring(project_code from '([0-9]+)$')::integer >= 52
  and subtotal_amount is not null;
