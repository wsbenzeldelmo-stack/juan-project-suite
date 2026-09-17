-- JUAN PROJECT V1.3.3.2 — Database Authority Reset
-- Supabase remains the single persistent source of truth.
-- Pricing V2 applies only to JP-054 and newer.
begin;

alter table if exists public.projects add column if not exists pricing_version text not null default 'legacy';

update public.projects
set pricing_version = case
  when coalesce(project_code,id) ~ '^JP-[0-9]+$'
   and substring(coalesce(project_code,id) from '([0-9]+)$')::integer >= 54 then 'v2'
  else 'legacy'
end
where pricing_version is null or pricing_version not in ('legacy','v2');

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists project_items_project_id_idx on public.project_items(project_id);
create index if not exists deliverables_project_id_idx on public.deliverables(project_id);
create index if not exists payments_project_id_idx on public.payments(project_id);

-- Keep canonical timestamps available for conflict-free reads.
do $$ begin
  if to_regclass('public.clients') is not null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='updated_at') then
    alter table public.clients add column updated_at timestamptz not null default now();
  end if;
  if to_regclass('public.projects') is not null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='updated_at') then
    alter table public.projects add column updated_at timestamptz not null default now();
  end if;
end $$;

commit;
