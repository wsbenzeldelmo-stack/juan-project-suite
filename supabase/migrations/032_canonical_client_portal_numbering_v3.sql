-- Canonical JUAN PROJECT client identity lock.
-- Source: JUAN_PROJECT_PAYMENT_TRACKER_UPDATED(3).csv
-- Historical IDs are fixed at CL-001..CL-045; new clients continue at CL-046+.

create or replace function public.enforce_preload_client_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare canonical_code text;
begin
  if new.email is not null and trim(new.email)<>'' then
    select s.client_code into canonical_code
    from public.preload_client_source s
    where s.client_email=lower(trim(new.email))
    limit 1;
    if canonical_code is not null then new.client_code:=canonical_code; end if;
  end if;
  return new;
end
$$;

drop trigger if exists zz_enforce_preload_client_code on public.clients;
create trigger zz_enforce_preload_client_code
before insert or update of email,client_code on public.clients
for each row execute function public.enforce_preload_client_code();

create or replace function public.assign_juan_client_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare next_no integer;
begin
  if new.client_code is null or btrim(new.client_code)='' then
    perform pg_advisory_xact_lock(hashtext('juan-project-client-code'));
    select greatest(
      45,
      coalesce(max((substring(client_code from '([0-9]+)$'))::integer),0)
    ) + 1
    into next_no
    from public.clients
    where client_code ~ '^CL-[0-9]+$';
    new.client_code:='CL-'||lpad(next_no::text,3,'0');
  end if;
  if new.email is not null then new.email:=lower(btrim(new.email)); end if;
  return new;
end
$$;

update public.preload_source_metadata
set filename='JUAN_PROJECT_PAYMENT_TRACKER_UPDATED(3).csv',
    sha256='02c3b0cddef59d007a6ad6503be074775ef111b51165ee4768c1901ef56865ab',
    source_version='payment-tracker-2026-09-20-v3',
    usage_mode='seed_only',
    updated_at=now()
where source_key='historical-preload';
