-- Least-privilege execution grants for project item synchronization.
revoke execute on function public.jp_replace_project_items(text,jsonb) from public;
revoke execute on function public.jp_replace_project_items(text,jsonb) from anon;
grant execute on function public.jp_replace_project_items(text,jsonb) to authenticated;
grant execute on function public.jp_replace_project_items(text,jsonb) to service_role;
