-- JUAN PROJECT Suite V1.1 verification
select 'clients' as check_name, count(*) as row_count,
       count(*) filter (where client_code ~ '^CL-[0-9]+$') as coded_count,
       count(distinct client_code) as distinct_codes
from public.clients;

select client_code, name, email
from public.clients
order by substring(client_code from '([0-9]+)$')::integer nulls last
limit 20;

select 'projects_with_drive_link' as check_name, count(*) as row_count
from public.projects
where drive_url is not null and btrim(drive_url) <> '';

select 'portal_accounts' as check_name,
       count(*) as row_count,
       count(*) filter (where portal_enabled) as enabled_count,
       count(*) filter (where not password_set) as needs_password_change
from public.portal_accounts;
