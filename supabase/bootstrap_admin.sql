-- Run AFTER creating your admin account in Supabase Authentication.
-- Replace the email before running.
insert into public.user_roles(auth_user_id,role)
select id,'admin' from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL@example.com')
on conflict(auth_user_id) do update set role='admin';
