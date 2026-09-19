-- Fix Workspace order creation paths that insert text primary keys without explicit IDs.
alter table public.clients alter column id set default gen_random_uuid()::text;
alter table public.projects alter column id set default gen_random_uuid()::text;
alter table public.deliverables alter column id set default gen_random_uuid()::text;
notify pgrst, 'reload schema';
