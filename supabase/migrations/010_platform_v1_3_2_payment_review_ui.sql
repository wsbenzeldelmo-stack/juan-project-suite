-- JUAN PROJECT Platform V1.3.2 — Payment Review UI / status hotfix
-- Standardizes client payment review statuses to Pending / Accepted / Rejected.

alter table if exists public.payment_submissions
  drop constraint if exists payment_submissions_status_check;

update public.payment_submissions
set status='accepted'
where status='approved';

alter table if exists public.payment_submissions
  add constraint payment_submissions_status_check
  check (status in ('pending','accepted','rejected'));

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
  if s.status <> 'pending' then raise exception 'Payment submission already reviewed'; end if;

  if normalized_decision='rejected' then
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

  if exists(
    select 1 from public.payment_submissions x
    where x.id<>s.id
      and x.status in ('pending','accepted')
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

  insert into public.payments(project_id,amount_paid,payment_date,payment_method,reference_no)
  values(s.project_id,s.submitted_amount,s.payment_date,coalesce(nullif(s.payment_method,''),s.sender_institution,'Client Submission'),clean_reference);

  update public.payment_submissions set
    status='accepted', reviewed_at=now(), reviewed_by=p_admin_user,
    reference_number=clean_reference, rejection_reason=null, rejection_code=null, admin_note=null
  where id=p_submission_id;
  return 'accepted';
end $$;

revoke all on function public.review_juan_payment_submission(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_juan_payment_submission(uuid,text,uuid,text) to service_role;
