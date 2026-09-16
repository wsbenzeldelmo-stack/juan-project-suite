-- JUAN PROJECT Platform V1.3.3.2 — NPW Patch
-- Manual Workspace DB session + corrected historical Client IDs + maintenance-fee cleanup
-- + GoTyme / MariBank payment reference support.
--
-- IMPORTANT:
-- 1) Run after 013_client_id_identity_lock.sql.
-- 2) After deployment, use Workspace > Online Portal > Reboot Client Logins once.
--    That admin action resets each non-admin portal password to its Client ID and
--    requires a password change on first login.

begin;

-- ---------------------------------------------------------------------------
-- A. Lock the uploaded historical email → Client ID mapping (CL-001..CL-046).
-- ---------------------------------------------------------------------------
create temporary table juan_npw_client_map(
  email text primary key,
  client_code text not null unique
) on commit drop;

insert into juan_npw_client_map(email,client_code) values
  ('imahemultimediaproductions@gmail.com','CL-001'),
  ('yvonnemaedelgado@gmail.com','CL-002'),
  ('trishakayemesana@gmail.com','CL-003'),
  ('dkian032@gmail.com','CL-004'),
  ('dalumpinesmargaret@gmail.com','CL-005'),
  ('ws.benzeldelmo@gmail.com','CL-006'),
  ('ardienjamesgais@gmail.com','CL-007'),
  ('kztksem88@gmail.com','CL-008'),
  ('oliver.villaruel@deped.gov.ph','CL-009'),
  ('dimaanolorraine37@gmail.com','CL-010'),
  ('janellerinn@gmail.com','CL-011'),
  ('ramosdenmar03@gmail.com','CL-012'),
  ('nikkazara29@gmail.com','CL-013'),
  ('mamadoaalexanderissaiah@gmail.com','CL-014'),
  ('earljohnmapa12@gmail.com','CL-015'),
  ('annefelicityrufo1@gmail.com','CL-016'),
  ('sosadanica07@gmail.com','CL-017'),
  ('ashleymaeramos001@gmail.com','CL-018'),
  ('leisoriano25@gmail.com','CL-019'),
  ('bacalaaj@gmail.com','CL-020'),
  ('calmorinjareen@gmail.com','CL-021'),
  ('danrowey2009@gmail.com','CL-022'),
  ('rapaconnicolo7@gmail.com','CL-023'),
  ('apriljoy.tabingo@deped.gov.ph','CL-024'),
  ('villegasnathaniel10@gmail.com','CL-025'),
  ('michaelquinto33@gmail.com','CL-026'),
  ('acunamika67@gmail.com','CL-027'),
  ('caliaoalthea6@gmail.com','CL-028'),
  ('macarimbangesmail18@gmail.com','CL-029'),
  ('santos.amielelijah@gmail.com','CL-030'),
  ('joycemagtibay@gmail.com','CL-031'),
  ('kyledylan1921@gmail.com','CL-032'),
  ('iannebaristol2005@gmail.com','CL-033'),
  ('jetcastre5@gmail.com','CL-034'),
  ('sittieazhimagyusoph@gmail.com','CL-035'),
  ('tjmercado1515@gmail.com','CL-036'),
  ('allieyahbautista@gmail.com','CL-037'),
  ('scharlesleendon@gmail.com','CL-038'),
  ('tagapulot.brianaziv@gmail.com','CL-039'),
  ('babonmichaelneil@gmail.com','CL-040'),
  ('caliguirankathleengrace@gmail.com','CL-041'),
  ('brylevicmudo@gmail.com','CL-042'),
  ('sharanfaten9@gmail.com','CL-043'),
  ('mykellpatigayon949@gmail.com','CL-044'),
  ('barejechad05@gmail.com','CL-045'),
  ('christian.aficionado@gmail.com','CL-046');

-- If an older database has duplicate client rows for a mapped email, keep the row
-- used by the earliest project and merge project references into it. Stale portal
-- links are removed (Auth users are NOT deleted) so the Workspace reboot action can
-- relink the canonical account cleanly.
do $$
declare
  m record;
  canonical_id text;
  duplicate_id text;
begin
  for m in select * from juan_npw_client_map order by client_code loop
    select c.id::text into canonical_id
    from public.clients c
    left join lateral (
      select min(p.id::text) as first_project_id
      from public.projects p
      where p.client_id::text=c.id::text
    ) fp on true
    where lower(btrim(coalesce(c.email,'')))=m.email
    order by fp.first_project_id nulls last,
             case when c.client_code=m.client_code then 0 else 1 end,
             c.id::text
    limit 1;

    if canonical_id is null then
      continue;
    end if;

    for duplicate_id in
      select c.id::text
      from public.clients c
      where lower(btrim(coalesce(c.email,'')))=m.email
        and c.id::text<>canonical_id
    loop
      update public.projects
      set client_id=canonical_id
      where client_id::text=duplicate_id;

      delete from public.portal_accounts
      where client_id::text=duplicate_id;

      update public.clients
      set archived_at=coalesce(archived_at,now()),
          email=null,
          client_code=null
      where id::text=duplicate_id;
    end loop;
  end loop;
end $$;

-- Two-phase reassignment avoids unique-index collisions when a previous build gave
-- the right Client IDs to the wrong rows.
update public.clients c
set client_code='NPW-TMP-'||substr(md5(c.id::text),1,12)
from juan_npw_client_map m
where lower(btrim(coalesce(c.email,'')))=m.email;

update public.clients c
set client_code=m.client_code
from juan_npw_client_map m
where lower(btrim(coalesce(c.email,'')))=m.email;

-- Keep future unique clients at CL-047+ and never reuse an older number.
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

-- ---------------------------------------------------------------------------
-- B. Fix the ₱25 / ₱26 retroactive-balance problem.
-- V1.3.3 added a maintenance fee to every positive historical subtotal.
-- Remove it only where the project had already paid the full pre-fee amount and
-- the only amount left outstanding is that injected maintenance fee.
-- Projects that genuinely still had an unpaid base balance keep the fee.
-- ---------------------------------------------------------------------------
with payment_totals as (
  select project_id::text as project_id,
         coalesce(sum(amount_paid),0)::numeric as paid
  from public.payments
  group by project_id
),
candidates as (
  select p.id,
         coalesce(p.system_maintenance_fee,0)::numeric as fee,
         coalesce(p.total_amount,0)::numeric as total,
         coalesce(pt.paid,0)::numeric as paid
  from public.projects p
  left join payment_totals pt on pt.project_id=p.id::text
  where coalesce(p.system_maintenance_fee,0) in (25,26)
)
update public.projects p
set total_amount=greatest(0,c.total-c.fee),
    system_maintenance_fee=0,
    updated_at=now()
from candidates c
where p.id=c.id
  and c.total>0
  and c.paid+0.005>=greatest(0,c.total-c.fee)
  and c.paid+0.005<c.total
  and (c.total-c.paid)<=c.fee+0.005;

-- ---------------------------------------------------------------------------
-- C. Payment sender validation: add the new UI codes while retaining legacy codes.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_juan_payment_reference(p_source text,p_reference text)
returns boolean
language plpgsql immutable as $$
declare
  s text := lower(trim(coalesce(p_source,'')));
  r text := regexp_replace(coalesce(p_reference,''),'[[:space:]]','','g');
begin
  if r='' then return false; end if;
  return case s
    when 'bdo' then (r ~ '^MA_PC-[A-Za-z0-9]{8}-[0-9]{6,8}$' or r ~ '^FT-[A-Za-z0-9]{8}-[0-9]{6,8}$')
    when 'bdo-mobile' then r ~ '^MA_PC-[A-Za-z0-9]{8}-[0-9]{6,8}$'
    when 'bdo-web' then r ~ '^FT-[A-Za-z0-9]{8}-[0-9]{6,8}$'
    when 'gcash' then r ~ '^[0-9]{13}$'
    when 'bpi' then r ~ '^[A-Za-z0-9]{13}$'
    when 'maya' then r ~ '^[A-Za-z0-9]{12}$'
    when 'metrobank' then r ~ '^[0-9]{12}$'
    when 'landbank' then r ~ '^[0-9]{14,15}$'
    when 'unionbank' then r ~ '^(UBP?)[A-Za-z0-9]{10,15}$' or r ~ '^[A-Za-z0-9]{10,15}$'
    when 'gotyme' then r ~ '^[A-Za-z0-9]{12,15}$'
    when 'maribank' then r ~ '^[0-9]{12,15}$'
    when 'maribank-seabank' then r ~ '^[0-9]{12,15}$'
    when 'pnb' then r ~ '^[0-9]{14,15}$'
    when 'others' then r ~ '^[0-9]{14,15}$'
    else false
  end;
end $$;

revoke all on function public.is_valid_juan_payment_reference(text,text) from public,anon,authenticated;
grant execute on function public.is_valid_juan_payment_reference(text,text) to service_role;

commit;
