-- JUAN PROJECT — Project Item ID Hotfix
-- Fixes: null value in column "id" of relation "project_items" violates not-null constraint
-- The database generates a stable ID when Workspace inserts a new project item.

begin;

create extension if not exists pgcrypto;

do $$
declare
  id_udt text;
begin
  select c.udt_name
    into id_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'project_items'
    and c.column_name = 'id';

  if id_udt is null then
    raise exception 'public.project_items.id does not exist';
  elsif id_udt = 'uuid' then
    execute 'alter table public.project_items alter column id set default gen_random_uuid()';
  elsif id_udt in ('text','varchar','bpchar') then
    execute 'alter table public.project_items alter column id set default gen_random_uuid()::text';
  else
    raise exception 'Unsupported project_items.id type: %', id_udt;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
