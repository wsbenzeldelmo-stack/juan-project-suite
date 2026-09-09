-- JUAN PROJECT Platform V1.3
begin;
create table if not exists public.order_drafts (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Draft',
  client_name text,
  project_name text,
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_order_drafts_admin_updated on public.order_drafts(admin_user_id,updated_at desc);
alter table public.order_drafts enable row level security;
drop policy if exists "admin order drafts" on public.order_drafts;
create policy "admin order drafts" on public.order_drafts for all to authenticated using (exists(select 1 from public.user_roles ur where ur.auth_user_id=auth.uid() and ur.role='admin') and admin_user_id=auth.uid()) with check (exists(select 1 from public.user_roles ur where ur.auth_user_id=auth.uid() and ur.role='admin') and admin_user_id=auth.uid());
create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id text,
  project_id text,
  action text not null check(action in ('EDIT','DELETE')),
  before_value jsonb,
  after_value jsonb,
  changed_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.payment_audit_logs enable row level security;
drop policy if exists "admin payment audit logs" on public.payment_audit_logs;
create policy "admin payment audit logs" on public.payment_audit_logs for all to authenticated using (exists(select 1 from public.user_roles ur where ur.auth_user_id=auth.uid() and ur.role='admin')) with check (exists(select 1 from public.user_roles ur where ur.auth_user_id=auth.uid() and ur.role='admin'));
-- Historical fee cutover: maintenance only for JP-040/041; new fee model from JP-052.
update public.projects set system_maintenance_fee=21 where project_code in ('JP-040','JP-041') and coalesce(system_maintenance_fee,0)=0;
update public.projects set system_maintenance_fee=21 where project_code='JP-052' and coalesce(system_maintenance_fee,0)=0;
commit;
