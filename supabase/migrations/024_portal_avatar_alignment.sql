-- JUAN PROJECT — Portal + Avatar Alignment
begin;

alter table public.portal_accounts
  alter column auth_user_id drop not null;

alter table public.portal_accounts
  add column if not exists access_status text not null default 'not_connected',
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists last_login_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portal_accounts_access_status_check'
      and conrelid = 'public.portal_accounts'::regclass
  ) then
    alter table public.portal_accounts
      add constraint portal_accounts_access_status_check
      check (access_status in ('not_connected','invited','active','disabled'));
  end if;
end $$;

update public.portal_accounts
set access_status = case
  when portal_enabled = false then 'disabled'
  when auth_user_id is not null then 'active'
  when invited_at is not null then 'invited'
  else 'not_connected'
end;

update public.portal_accounts
set activated_at = coalesce(activated_at, created_at)
where auth_user_id is not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='portal_accounts'
      and column_name='password_set'
  ) then
    alter table public.portal_accounts
      add column password_set boolean
      generated always as (auth_user_id is not null) stored;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
