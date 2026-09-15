-- JUAN PROJECT Platform V1.3.3
-- Stability, persistent delivery state, profile images, revised maintenance fees,
-- sender-reference validation and NULL-safe payment approval.

create extension if not exists pgcrypto;

-- Persistent project state used by Workspace, Workspace Mobile, and JUAN PROJECT Online.
alter table if exists public.projects
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists delivery_status text,
  add column if not exists archived_at timestamptz,
  add column if not exists notes text;

update public.projects
set delivery_status = case
  when lower(coalesce(status,'')) in ('completed','delivered') then 'Delivered'
  else coalesce(nullif(delivery_status,''),'Pending')
end
where delivery_status is null or delivery_status='';

-- Client profile image is cloud-backed, never browser-only.
alter table if exists public.clients
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists profile_photo_path text;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='juan_projects_updated_at') then create trigger juan_projects_updated_at before update on public.projects for each row execute function public.set_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='juan_clients_updated_at') then create trigger juan_clients_updated_at before update on public.clients for each row execute function public.set_updated_at(); end if;
end $$;

-- V1.3.3 maintenance fee rule. Adjust the existing total by the fee delta only.
-- Rounded subtotal ending in 99 => P26. All other positive subtotals => P25.
with fees as (
  select id,
    coalesce(system_maintenance_fee,0) as old_fee,
    case
      when coalesce(subtotal_amount,0) <= 0 then 0::numeric
      when mod(abs(round(coalesce(subtotal_amount,0)))::numeric,100)=99 then 26::numeric
      else 25::numeric
    end as new_fee
  from public.projects
)
update public.projects p
set system_maintenance_fee=f.new_fee,
    total_amount=greatest(0,coalesce(p.total_amount,0)-f.old_fee+f.new_fee)
from fees f
where p.id=f.id
  and abs(coalesce(f.old_fee,0)-coalesce(f.new_fee,0))>0.001;

-- Sender/reference registry. New UI exposes: BDO, GCash, BPI, Maya, Metrobank,
-- Landbank, UnionBank, PNB and Others. Legacy codes remain valid for old reviews.
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
    when 'unionbank' then r ~ '^(UBP?)?[A-Za-z0-9]{10,15}$'
    when 'pnb' then r ~ '^[0-9]{14,15}$'
    when 'others' then r ~ '^[0-9]{14,15}$'
    -- legacy review compatibility
    when 'gotyme' then r ~ '^[A-Za-z0-9]{12,15}$'
    when 'maribank-seabank' then r ~ '^[0-9]{12,15}$'
    else false
  end;
end $$;
revoke all on function public.is_valid_juan_payment_reference(text,text) from public,anon,authenticated;
grant execute on function public.is_valid_juan_payment_reference(text,text) to service_role;

-- Ensure review status constraint uses the current language.
alter table if exists public.payment_submissions drop constraint if exists payment_submissions_status_check;
update public.payment_submissions set status='accepted' where status='approved';
alter table if exists public.payment_submissions
  add constraint payment_submissions_status_check check(status in ('pending','accepted','rejected'));

-- NULL-safe approval. Handles legacy payments tables whose id column is NOT NULL
-- but has no default instead of surfacing a database NULL constraint error.
create or replace function public.review_juan_payment_submission(
  p_submission_id uuid,
  p_decision text,
  p_admin_user uuid,
  p_reason text default null
) returns text
language plpgsql security definer set search_path=public as $$
declare
  s public.payment_submissions%rowtype;
  project_total numeric(12,2);
  already_paid numeric(12,2);
  clean_reference text;
  normalized_decision text;
  id_udt text;
  id_nullable text;
  id_default text;
  next_numeric_id bigint;
begin
  normalized_decision := case lower(coalesce(p_decision,''))
    when 'approved' then 'accepted'
    when 'accepted' then 'accepted'
    when 'rejected' then 'rejected'
    else ''
  end;
  if normalized_decision='' then raise exception 'Invalid review decision'; end if;

  select * into s from public.payment_submissions where id=p_submission_id for update;
  if not found then raise exception 'Payment submission not found'; end if;
  if s.status<>'pending' then raise exception 'Payment submission has already been reviewed'; end if;

  if normalized_decision='rejected' then
    if coalesce(trim(p_reason),'')='' then raise exception 'Select a rejection reason'; end if;
    update public.payment_submissions set
      status='rejected', reviewed_at=now(), reviewed_by=p_admin_user,
      rejection_reason=left(trim(p_reason),500)
    where id=p_submission_id;
    return 'rejected';
  end if;

  clean_reference := regexp_replace(coalesce(s.reference_number,''),'[[:space:]]','','g');
  if coalesce(trim(s.sender_institution),'')='' then raise exception 'Sending bank / e-wallet is missing'; end if;
  if clean_reference='' then raise exception 'Reference number is missing'; end if;
  if not public.is_valid_juan_payment_reference(s.sender_institution,clean_reference) then raise exception 'Reference number does not match the selected sender format'; end if;
  if coalesce(trim(s.receipt_path),'')='' then raise exception 'Payment receipt is missing'; end if;
  if coalesce(s.submitted_amount,0)<=0 then raise exception 'Payment amount is invalid'; end if;
  if s.payment_date is null then raise exception 'Payment date is missing'; end if;

  if exists(
    select 1 from public.payment_submissions x
    where x.id<>s.id and x.status in ('pending','accepted')
      and lower(regexp_replace(coalesce(x.reference_number,''),'[[:space:]]','','g'))=lower(clean_reference)
  ) then raise exception 'Reference number is already used by another payment submission'; end if;
  if exists(select 1 from public.payments p where lower(coalesce(p.reference_no,''))=lower(clean_reference)) then
    raise exception 'Reference number is already recorded as a payment';
  end if;

  select coalesce(total_amount,0) into project_total from public.projects where id=s.project_id;
  if not found then raise exception 'Project for this payment no longer exists'; end if;
  select coalesce(sum(amount_paid),0) into already_paid from public.payments where project_id=s.project_id;
  if s.submitted_amount > greatest(project_total-already_paid,0)+0.01 then
    raise exception 'Submitted amount is greater than the current project balance';
  end if;

  select udt_name,is_nullable,column_default into id_udt,id_nullable,id_default
  from information_schema.columns
  where table_schema='public' and table_name='payments' and column_name='id';

  if id_udt is null or id_nullable='YES' or id_default is not null then
    insert into public.payments(project_id,amount_paid,payment_date,payment_method,reference_no)
    values(s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference);
  elsif id_udt='uuid' then
    execute 'insert into public.payments(id,project_id,amount_paid,payment_date,payment_method,reference_no) values($1,$2,$3,$4,$5,$6)'
      using gen_random_uuid(),s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference;
  elsif id_udt in ('text','varchar','bpchar') then
    execute 'insert into public.payments(id,project_id,amount_paid,payment_date,payment_method,reference_no) values($1,$2,$3,$4,$5,$6)'
      using 'pay_'||replace(gen_random_uuid()::text,'-',''),s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference;
  elsif id_udt in ('int2','int4','int8') then
    lock table public.payments in share row exclusive mode;
    execute 'select coalesce(max(id),0)+1 from public.payments' into next_numeric_id;
    execute 'insert into public.payments(id,project_id,amount_paid,payment_date,payment_method,reference_no) values($1,$2,$3,$4,$5,$6)'
      using next_numeric_id,s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference;
  else
    raise exception 'Payment could not be recorded because the payments.id column has no automatic value. Please update the payments table schema.';
  end if;

  update public.payment_submissions set
    status='accepted',reviewed_at=now(),reviewed_by=p_admin_user,
    reference_number=clean_reference,rejection_reason=null,rejection_code=null,admin_note=null
  where id=p_submission_id;
  return 'accepted';
end $$;
revoke all on function public.review_juan_payment_submission(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_juan_payment_submission(uuid,text,uuid,text) to service_role;

-- Private profile-image storage. Each signed-in client can write only to their own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('juan-profile-images','juan-profile-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "juan profile owner read" on storage.objects;
drop policy if exists "juan profile owner insert" on storage.objects;
drop policy if exists "juan profile owner update" on storage.objects;
drop policy if exists "juan profile owner delete" on storage.objects;
create policy "juan profile owner read" on storage.objects for select to authenticated
using(bucket_id='juan-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "juan profile owner insert" on storage.objects for insert to authenticated
with check(bucket_id='juan-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "juan profile owner update" on storage.objects for update to authenticated
using(bucket_id='juan-profile-images' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='juan-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "juan profile owner delete" on storage.objects for delete to authenticated
using(bucket_id='juan-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
