-- Performance indexes for production guest order / portal extension foreign keys.
create index if not exists incoming_orders_project_idx on public.incoming_orders(project_id);
create index if not exists portal_activity_actor_idx on public.portal_activity(actor_user_id);
