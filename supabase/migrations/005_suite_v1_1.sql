-- JUAN PROJECT Suite V1.1
-- Additive/data-preserving migration for sequential client IDs, project-level Drive links,
-- and integrated Online Portal account controls.

alter table if exists public.projects
  add column if not exists drive_url text;

alter table if exists public.clients
  add column if not exists archived_at timestamptz;

alter table if exists public.portal_accounts
  add column if not exists portal_enabled boolean not null default true;

-- V1.1 uses one client-facing Google Drive URL PER PROJECT.
-- Where older data has exactly one distinct visible deliverable Drive URL for a project,
-- preserve it by backfilling the new project-level field.
with legacy_drive as (
  select project_id, min(shared_drive_url) as drive_url
  from public.deliverables
  where shared_drive_url is not null and btrim(shared_drive_url) <> '' and client_visible is not false
  group by project_id
  having count(distinct shared_drive_url) = 1
)
update public.projects p
set drive_url = legacy_drive.drive_url
from legacy_drive
where p.id = legacy_drive.project_id
  and (p.drive_url is null or btrim(p.drive_url) = '');

-- Obvious spreadsheet placeholder rows (for example legacy rows literally named "Name")
-- are not real clients and must not increase the lifetime client counter. Keep them archived
-- for auditability, but remove their display Client ID. A legitimate client without an email
-- (for example a real person's name) is NOT removed from the client sequence.
update public.clients
set archived_at = coalesce(archived_at, now()), client_code = null
where (lower(btrim(coalesce(name,''))) = 'name' or lower(btrim(coalesce(email,''))) = 'name')
  and (email is null or email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- Re-sequence existing CLIENT display IDs so CL-### is a gapless count of real client records,
-- ordered by each client's first recorded project. Repeat projects do not generate IDs;
-- client IDs belong to the clients table, independently from JP-###.
-- Temporary unique values avoid collisions with the existing unique index during resequencing.
with first_project as (
  select
    client_id,
    min(
      case
        when project_code ~ '^JP-[0-9]+$' then substring(project_code from '([0-9]+)$')::integer
        else null
      end
    ) as first_project_no
  from public.projects
  group by client_id
), ranked as (
  select
    c.id,
    row_number() over (
      order by fp.first_project_no nulls last, c.id
    ) as rn
  from public.clients c
  left join first_project fp on fp.client_id = c.id
  where not ((lower(btrim(coalesce(c.name,''))) = 'name' or lower(btrim(coalesce(c.email,''))) = 'name') and (c.email is null or c.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
)
update public.clients c
set client_code = 'V11-TMP-' || lpad(r.rn::text, 6, '0')
from ranked r
where c.id = r.id;

with first_project as (
  select
    client_id,
    min(
      case
        when project_code ~ '^JP-[0-9]+$' then substring(project_code from '([0-9]+)$')::integer
        else null
      end
    ) as first_project_no
  from public.projects
  group by client_id
), ranked as (
  select
    c.id,
    row_number() over (
      order by fp.first_project_no nulls last, c.id
    ) as rn
  from public.clients c
  left join first_project fp on fp.client_id = c.id
  where not ((lower(btrim(coalesce(c.name,''))) = 'name' or lower(btrim(coalesce(c.email,''))) = 'name') and (c.email is null or c.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
)
update public.clients c
set client_code = 'CL-' || lpad(r.rn::text, 3, '0')
from ranked r
where c.id = r.id;

-- Future unique clients receive the next gapless Client ID.
-- Clients should be archived rather than hard-deleted so CL-### remains a lifetime client counter.
create or replace function public.assign_juan_client_code() returns trigger
language plpgsql security definer set search_path=public as $$
declare next_no integer;
begin
  if new.client_code is null or btrim(new.client_code) = '' then
    perform pg_advisory_xact_lock(hashtext('juan-project-client-code'));
    select count(*) + 1
      into next_no
      from public.clients
      where client_code ~ '^CL-[0-9]+$';
    new.client_code := 'CL-' || lpad(next_no::text, 3, '0');
  end if;
  return new;
end $$;

-- Helpful indexes for Online Portal administration.
create index if not exists projects_drive_url_idx on public.projects(id) where drive_url is not null;
create index if not exists clients_archived_at_idx on public.clients(archived_at);

-- Keep existing role/RLS model. Browser clients still cannot read another client's business data.
-- portal_enabled is evaluated by the server-side Online API before protected data is returned.
