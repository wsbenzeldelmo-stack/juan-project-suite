-- JUAN PROJECT DATABASE V2 — POST-RESET HEALTH CHECK
select 'clients' as table_name, count(*) as rows from public.clients
union all select 'projects', count(*) from public.projects
union all select 'project_items', count(*) from public.project_items
union all select 'payments', count(*) from public.payments
union all select 'payment_submissions', count(*) from public.payment_submissions
order by table_name;

select auth_user_id, role from public.user_roles order by role, auth_user_id;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('clients','projects','project_items','payments','payment_submissions')
order by table_name,ordinal_position;

select schemaname,tablename,policyname,cmd
from pg_policies
where schemaname='public'
order by tablename,policyname;

select schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
order by tablename;

select * from public.project_financials order by project_code;
