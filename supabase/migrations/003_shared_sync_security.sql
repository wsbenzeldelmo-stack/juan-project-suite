-- JUAN PROJECT shared sync + security hardening
-- Additive. Run after 001 and 002.

-- Columns already used by the Workspace deliverable workflow and JUAN PROJECT Online.
alter table if exists public.deliverables add column if not exists progress numeric not null default 0;
alter table if exists public.deliverables add column if not exists status text not null default 'Pending';
alter table if exists public.deliverables add column if not exists completed_at timestamptz;
create unique index if not exists payment_submissions_receipt_path_key on public.payment_submissions(receipt_path);

-- Give the authenticated role table privileges; RLS policies from migration 001 remain the authorization layer.
do $$
begin
  if to_regclass('public.clients') is not null then execute 'grant select,insert,update,delete on public.clients to authenticated'; end if;
  if to_regclass('public.projects') is not null then execute 'grant select,insert,update,delete on public.projects to authenticated'; end if;
  if to_regclass('public.deliverables') is not null then execute 'grant select,insert,update,delete on public.deliverables to authenticated'; end if;
  if to_regclass('public.project_items') is not null then execute 'grant select,insert,update,delete on public.project_items to authenticated'; end if;
  if to_regclass('public.payments') is not null then execute 'grant select,insert,update,delete on public.payments to authenticated'; end if;
end $$;
grant select,insert,update,delete on public.user_roles,public.portal_accounts,public.payment_settings,public.payment_submissions to authenticated;
grant select,insert,update,delete on public.catalog_categories,public.catalog_services,public.catalog_packages,public.catalog_package_items to authenticated;
grant select on public.catalog_categories,public.catalog_services,public.catalog_packages,public.catalog_package_items to anon;

-- Stable CL-### allocation for future clients. Existing codes are preserved.
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

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='assign_juan_client_code_trigger') then
    create trigger assign_juan_client_code_trigger before insert on public.clients
    for each row execute function public.assign_juan_client_code();
  end if;
end $$;

-- Stable JP-### allocation when a future server workflow creates a project without a display code.
create or replace function public.assign_juan_project_code() returns trigger
language plpgsql security definer set search_path=public as $$
declare next_no integer;
begin
  if new.project_code is null or btrim(new.project_code)='' then
    perform pg_advisory_xact_lock(hashtext('juan-project-project-code'));
    select coalesce(max((substring(project_code from '([0-9]+)$'))::integer),0)+1
      into next_no from public.projects where project_code ~ '^JP-[0-9]+$';
    new.project_code := 'JP-' || lpad(next_no::text,3,'0');
  end if;
  return new;
end $$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='assign_juan_project_code_trigger') then
    create trigger assign_juan_project_code_trigger before insert on public.projects
    for each row execute function public.assign_juan_project_code();
  end if;
end $$;

-- Server-only persistent rate limit store for first-access, receipt AI, and payment submissions.
create table if not exists public.security_rate_limits(
  rate_key text primary key,
  window_start timestamptz not null default now(),
  hit_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from anon,authenticated;

create or replace function public.consume_juan_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_hits integer
) returns boolean
language plpgsql security definer set search_path=public as $$
declare current_hits integer;
begin
  if p_key is null or length(p_key)<8 or p_window_seconds<1 or p_max_hits<1 then
    return false;
  end if;
  insert into public.security_rate_limits(rate_key,window_start,hit_count,updated_at)
  values(p_key,now(),1,now())
  on conflict(rate_key) do update set
    window_start = case when public.security_rate_limits.window_start <= now()-make_interval(secs=>p_window_seconds) then now() else public.security_rate_limits.window_start end,
    hit_count = case when public.security_rate_limits.window_start <= now()-make_interval(secs=>p_window_seconds) then 1 else public.security_rate_limits.hit_count+1 end,
    updated_at = now()
  returning hit_count into current_hits;
  return current_hits <= p_max_hits;
end $$;
revoke all on function public.consume_juan_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_juan_rate_limit(text,integer,integer) to service_role;

-- Atomic admin review. Prevents double approval and re-checks the live balance before crediting a payment.
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
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  select * into s from public.payment_submissions where id=p_submission_id for update;
  if not found then raise exception 'Payment submission not found'; end if;
  if s.status <> 'pending' then raise exception 'Payment submission already reviewed'; end if;

  if p_decision='approved' then
    select coalesce(total_amount,0) into project_total from public.projects where id=s.project_id;
    select coalesce(sum(amount_paid),0) into already_paid from public.payments where project_id=s.project_id;
    if s.submitted_amount > greatest(project_total-already_paid,0)+0.01 then
      raise exception 'Submitted amount is greater than the current project balance';
    end if;
    insert into public.payments(project_id,amount_paid,payment_date,payment_method,reference_no)
    values(s.project_id,s.submitted_amount,coalesce(s.payment_date,current_date),coalesce(nullif(s.payment_method,''),'Client Submission'),coalesce(nullif(s.reference_number,''),s.extracted_reference));
  end if;

  update public.payment_submissions set
    status=p_decision,
    reviewed_at=now(),
    reviewed_by=p_admin_user,
    rejection_reason=case when p_decision='rejected' then left(coalesce(p_reason,''),500) else null end
  where id=p_submission_id;
  return p_decision;
end $$;
revoke all on function public.review_juan_payment_submission(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_juan_payment_submission(uuid,text,uuid,text) to service_role;
