-- JUAN PROJECT V1.3.3.2 integrity patch
-- Package -> individual deliverables persistence + optional client contact fields.

alter table if exists public.deliverables add column if not exists source_type text;
alter table if exists public.deliverables add column if not exists order_item_id text;
alter table if exists public.deliverables add column if not exists order_item_occurrence integer not null default 1;
alter table if exists public.deliverables add column if not exists parent_id text;
alter table if exists public.deliverables add column if not exists parent_key text;
alter table if exists public.deliverables add column if not exists package_name text;
alter table if exists public.deliverables add column if not exists child_index integer;

-- Contact/location fields are enrichment only. Legacy rows with no values remain valid.
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='phone') then
    alter table public.clients alter column phone drop not null;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='address') then
    alter table public.clients alter column address drop not null;
  end if;
end $$;

create index if not exists deliverables_order_item_idx on public.deliverables(project_id,order_item_id);
create index if not exists deliverables_parent_idx on public.deliverables(project_id,parent_id);
