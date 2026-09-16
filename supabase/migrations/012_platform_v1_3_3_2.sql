-- JUAN PROJECT Platform V1.3.3.2
-- Manual Workspace database connection + authoritative Client ID mapping for JUAN PROJECT Online.
-- Source: JUAN_PROJECT_Client_ID_Mapping_UPDATED(1).xlsx supplied for this release.

begin;

-- Keep known lifetime client IDs stable. Move current CL-* values to temporary unique
-- placeholders first so the existing unique index cannot collide during reassignment.
update public.clients
set client_code='V1332-TMP-' || regexp_replace(id::text,'[^A-Za-z0-9]','','g')
where client_code ~ '^CL-[0-9]+$';

with mapping(email,client_code) as (
  values
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
    ('christian.aficionado@gmail.com','CL-046')
)
update public.clients c
set client_code=m.client_code
from mapping m
where lower(btrim(coalesce(c.email,'')))=m.email;

-- Any real client not present in the supplied historical mapping continues after CL-046.
with first_project as (
  select client_id,
         min(case when project_code ~ '^JP-[0-9]+$' then substring(project_code from '([0-9]+)$')::integer else null end) as first_project_no
  from public.projects
  group by client_id
), unmapped as (
  select c.id,row_number() over(order by fp.first_project_no nulls last,c.id) rn
  from public.clients c
  left join first_project fp on fp.client_id=c.id
  where (c.client_code is null or c.client_code !~ '^CL-[0-9]+$')
    and c.archived_at is null
    and not (lower(btrim(coalesce(c.name,'')))='name' and coalesce(c.email,'') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
)
update public.clients c
set client_code='CL-'||lpad((46+u.rn)::text,3,'0')
from unmapped u
where c.id=u.id;

-- Future clients take MAX+1, not COUNT+1, so an intentionally missing historic code
-- can never cause a duplicate Client ID.
create or replace function public.assign_juan_client_code() returns trigger
language plpgsql security definer set search_path=public as $$
declare next_no integer;
begin
  if new.client_code is null or btrim(new.client_code)='' then
    perform pg_advisory_xact_lock(hashtext('juan-project-client-code'));
    select coalesce(max((substring(client_code from '([0-9]+)$'))::integer),0)+1
      into next_no from public.clients where client_code ~ '^CL-[0-9]+$';
    new.client_code := 'CL-' || lpad(next_no::text,3,'0');
  end if;
  return new;
end $$;

-- Keep Auth metadata aligned with the current Client ID. Passwords are intentionally
-- NOT overwritten here: activated clients keep their chosen password. Workspace →
-- Online Portal → Sync Client Accounts resets only accounts still using a temporary password.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data,'{}'::jsonb) || jsonb_build_object(
  'client_code',c.client_code,
  'client_id',c.id,
  'juan_project_client',true,
  'must_change_password',case when coalesce(pa.password_set,false) then false else true end
)
from public.portal_accounts pa
join public.clients c on c.id=pa.client_id
where u.id=pa.auth_user_id;

commit;
