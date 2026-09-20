-- JUAN PROJECT Platform V1.3.3.2 — realtime notification alignment
-- Incoming guest orders now emit through the existing juan_sync_events bus.

begin;

drop trigger if exists juan_sync_incoming_orders_trigger on public.incoming_orders;

create trigger juan_sync_incoming_orders_trigger
after insert or update or delete on public.incoming_orders
for each row execute function public.juan_emit_sync_event();

commit;
