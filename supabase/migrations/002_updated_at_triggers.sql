create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='portal_accounts_updated_at') then create trigger portal_accounts_updated_at before update on public.portal_accounts for each row execute function public.set_updated_at(); end if;
 if not exists(select 1 from pg_trigger where tgname='catalog_services_updated_at') then create trigger catalog_services_updated_at before update on public.catalog_services for each row execute function public.set_updated_at(); end if;
 if not exists(select 1 from pg_trigger where tgname='catalog_packages_updated_at') then create trigger catalog_packages_updated_at before update on public.catalog_packages for each row execute function public.set_updated_at(); end if;
end $$;
