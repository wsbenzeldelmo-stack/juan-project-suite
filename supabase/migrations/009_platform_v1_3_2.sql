-- JUAN PROJECT Platform V1.3.2
-- Shared workspace settings + deterministic client payment verification.

create table if not exists public.workspace_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'JUAN PROJECT',
  owner_name text,
  owner_address text,
  owner_phone text,
  owner_email text,
  profile_photo text,
  theme_mode text not null default 'light' check (theme_mode in ('light','dark')),
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings(id) values (1) on conflict (id) do nothing;
alter table public.workspace_settings enable row level security;
drop policy if exists juan_admin_workspace_settings on public.workspace_settings;
create policy juan_admin_workspace_settings on public.workspace_settings
  for all to authenticated
  using (public.is_juan_admin())
  with check (public.is_juan_admin());
grant select,insert,update on public.workspace_settings to authenticated;

alter table if exists public.payment_submissions
  add column if not exists sender_institution text,
  add column if not exists rejection_code text,
  add column if not exists admin_note text,
  add column if not exists verification_snapshot jsonb;

create index if not exists payment_submissions_reference_idx
  on public.payment_submissions (lower(reference_number))
  where reference_number is not null and reference_number <> '';

create or replace function public.is_valid_juan_payment_reference(p_source text,p_reference text)
returns boolean
language plpgsql immutable as $$
declare
  s text := lower(trim(coalesce(p_source,'')));
  r text := regexp_replace(coalesce(p_reference,''),'[[:space:]]','','g');
begin
  if r = '' then return false; end if;
  return case s
    when 'gcash' then r ~ '^[0-9]{13}$'
    when 'bpi' then r ~ '^[A-Za-z0-9]{13}$'
    when 'bdo-mobile' then r ~ '^MA_PC-[A-Za-z0-9]{8}-[0-9]{6,8}$'
    when 'bdo-web' then r ~ '^FT-[A-Za-z0-9]{8}-[0-9]{6,8}$'
    when 'maya' then r ~ '^[A-Za-z0-9]{12}$'
    when 'metrobank' then r ~ '^[0-9]{12}$'
    when 'landbank' then r ~ '^[0-9]{14,15}$'
    when 'unionbank' then r ~ '^(UBP?)?[A-Za-z0-9]{10,15}$'
    when 'gotyme' then r ~ '^[A-Za-z0-9]{12,15}$'
    when 'maribank-seabank' then r ~ '^[0-9]{12,15}$'
    else false
  end;
end $$;
revoke all on function public.is_valid_juan_payment_reference(text,text) from public,anon,authenticated;
grant execute on function public.is_valid_juan_payment_reference(text,text) to service_role;

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
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  select * into s from public.payment_submissions where id=p_submission_id for update;
  if not found then raise exception 'Payment submission not found'; end if;
  if s.status <> 'pending' then raise exception 'Payment submission already reviewed'; end if;

  if p_decision='rejected' then
    update public.payment_submissions set
      status='rejected', reviewed_at=now(), reviewed_by=p_admin_user,
      rejection_reason=left(coalesce(nullif(trim(p_reason),''),'Payment could not be verified.'),500)
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

  if exists(select 1 from public.payment_submissions x where x.id<>s.id and x.status in ('pending','approved') and lower(regexp_replace(coalesce(x.reference_number,''),'[[:space:]]','','g'))=lower(clean_reference)) then
    raise exception 'Reference number is already used by another payment submission';
  end if;
  if exists(select 1 from public.payments p where lower(coalesce(p.reference_no,''))=lower(clean_reference)) then
    raise exception 'Reference number is already recorded as a payment';
  end if;

  select coalesce(total_amount,0) into project_total from public.projects where id=s.project_id;
  if not found then raise exception 'Project for this payment no longer exists'; end if;
  select coalesce(sum(amount_paid),0) into already_paid from public.payments where project_id=s.project_id;
  if s.submitted_amount > greatest(project_total-already_paid,0)+0.01 then
    raise exception 'Submitted amount is greater than the current project balance';
  end if;

  insert into public.payments(project_id,amount_paid,payment_date,payment_method,reference_no)
  values(s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference);

  update public.payment_submissions set
    status='approved', reviewed_at=now(), reviewed_by=p_admin_user,
    reference_number=clean_reference, rejection_reason=null, rejection_code=null, admin_note=null
  where id=p_submission_id;
  return 'approved';
end $$;
revoke all on function public.review_juan_payment_submission(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_juan_payment_submission(uuid,text,uuid,text) to service_role;
