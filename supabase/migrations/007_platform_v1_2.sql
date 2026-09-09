-- JUAN PROJECT Platform V1.2
-- Mobile client-portal UX + Workspace UX standardization.
-- Additive only. No existing business records are recreated or deleted.

alter table if exists public.projects
  add column if not exists drive_unlock_at timestamptz,
  add column if not exists drive_expires_at timestamptz;

-- A project may have one Drive folder. Optional availability timestamps allow
-- JUAN PROJECT Online to show Locked -> Available -> Expired states.
create index if not exists projects_drive_unlock_at_idx
  on public.projects(drive_unlock_at)
  where drive_unlock_at is not null;

create index if not exists projects_drive_expires_at_idx
  on public.projects(drive_expires_at)
  where drive_expires_at is not null;

-- Guard against an expiry that is not later than the unlock time.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_drive_window_valid'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_drive_window_valid
      check (
        drive_expires_at is null
        or drive_unlock_at is null
        or drive_expires_at > drive_unlock_at
      );
  end if;
end $$;
