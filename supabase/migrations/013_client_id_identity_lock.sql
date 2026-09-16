-- JUAN PROJECT Platform V1.3.3.2 — Client ID Identity Lock Patch
-- One normalized email = one lifetime Client ID.
-- Historical IDs CL-001..CL-046 remain authoritative; future unique clients continue at CL-047+.

begin;

create index if not exists clients_normalized_email_lookup_idx
on public.clients (lower(btrim(email)))
where email is not null and btrim(email) <> '';

create or replace function public.assign_juan_client_code() returns trigger
language plpgsql security definer set search_path=public as $$
declare next_no integer;
begin
  if new.client_code is null or btrim(new.client_code)='' then
    perform pg_advisory_xact_lock(hashtext('juan-project-client-code'));
    select greatest(
      46,
      coalesce(max((substring(client_code from '([0-9]+)$'))::integer),0)
    ) + 1
    into next_no
    from public.clients
    where client_code ~ '^CL-[0-9]+$';
    new.client_code := 'CL-' || lpad(next_no::text,3,'0');
  end if;
  return new;
end $$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='assign_juan_client_code_trigger') then
    create trigger assign_juan_client_code_trigger before insert on public.clients
    for each row execute function public.assign_juan_client_code();
  end if;
end $$;

create or replace function public.enforce_juan_client_email_identity() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  normalized_email text;
  existing_id text;
  existing_code text;
begin
  normalized_email := lower(btrim(coalesce(new.email,'')));
  if normalized_email='' then return new; end if;

  new.email := normalized_email;
  perform pg_advisory_xact_lock(hashtext('juan-project-client-email:' || normalized_email));

  select c.id,c.client_code into existing_id,existing_code
  from public.clients c
  where lower(btrim(coalesce(c.email,'')))=normalized_email
    and c.id is distinct from new.id
  order by
    case when c.client_code ~ '^CL-[0-9]+$' then substring(c.client_code from '([0-9]+)$')::integer else 2147483647 end,
    c.id
  limit 1;

  if existing_id is not null then
    raise exception using
      errcode='23505',
      message=format('Email %s already belongs to Client ID %s.', normalized_email, coalesce(existing_code,'existing client')),
      detail='JUAN PROJECT uses one lifetime Client ID per normalized email.',
      hint='Reuse the existing client record instead of creating or renaming another client to this email.';
  end if;
  return new;
end $$;

drop trigger if exists enforce_juan_client_email_identity_trigger on public.clients;
create trigger enforce_juan_client_email_identity_trigger
before insert or update of email on public.clients
for each row execute function public.enforce_juan_client_email_identity();

commit;
