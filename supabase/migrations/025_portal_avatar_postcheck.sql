select
  column_name,
  data_type,
  is_nullable,
  is_generated,
  generation_expression
from information_schema.columns
where table_schema='public'
  and table_name='portal_accounts'
  and column_name in (
    'auth_user_id','portal_enabled','access_status','password_set',
    'invited_at','activated_at','last_login_at'
  )
order by ordinal_position;

select
  id, client_id, auth_user_id, portal_enabled,
  access_status, password_set, invited_at, activated_at, last_login_at
from public.portal_accounts
order by created_at desc
limit 20;
