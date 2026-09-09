-- JUAN PROJECT Suite V1 post-install verification (read-only)
select 'clients' as object, to_regclass('public.clients') is not null as present
union all select 'projects', to_regclass('public.projects') is not null
union all select 'project_items', to_regclass('public.project_items') is not null
union all select 'deliverables', to_regclass('public.deliverables') is not null
union all select 'payments', to_regclass('public.payments') is not null
union all select 'user_roles', to_regclass('public.user_roles') is not null
union all select 'portal_accounts', to_regclass('public.portal_accounts') is not null
union all select 'payment_settings', to_regclass('public.payment_settings') is not null
union all select 'payment_submissions', to_regclass('public.payment_submissions') is not null
union all select 'catalog_categories', to_regclass('public.catalog_categories') is not null
union all select 'catalog_services', to_regclass('public.catalog_services') is not null
union all select 'catalog_packages', to_regclass('public.catalog_packages') is not null
union all select 'catalog_package_items', to_regclass('public.catalog_package_items') is not null;

select proname
from pg_proc
where pronamespace='public'::regnamespace
  and proname in ('is_juan_admin','consume_juan_rate_limit','review_juan_payment_submission','assign_juan_client_code','assign_juan_project_code')
order by proname;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('clients','projects','deliverables','project_items','payments','user_roles','portal_accounts','payment_settings','payment_submissions','catalog_categories','catalog_services','catalog_packages','catalog_package_items')
order by tablename, policyname;
