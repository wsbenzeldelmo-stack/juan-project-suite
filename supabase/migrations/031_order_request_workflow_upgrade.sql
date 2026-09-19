-- JUAN PROJECT order-request workflow upgrade.
-- Adds editable/revised request pricing while preserving the original guest submission.

alter table public.incoming_orders
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists original_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists revised_at timestamptz,
  add column if not exists client_accepted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists conversion_lock uuid,
  add column if not exists conversion_started_at timestamptz;

alter table public.incoming_orders
  drop constraint if exists incoming_orders_status_check;

alter table public.incoming_orders
  add constraint incoming_orders_status_check
  check (status in (
    'Order Received',
    'Under Review',
    'Needs Changes',
    'Revised Offer Sent',
    'Client Accepted',
    'Approved',
    'Rejected'
  ));

create or replace function public.assign_juan_guest_order_code()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.code is null or btrim(new.code)='' then
    new.code := 'OR-' || lpad(new.order_number::text,3,'0');
  end if;
  return new;
end
$$;

create table if not exists public.order_request_revisions(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.incoming_orders(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  rush_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  note text not null default '',
  sent_to_client boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.order_request_revisions enable row level security;

drop policy if exists order_request_revisions_admin_all on public.order_request_revisions;
create policy order_request_revisions_admin_all
on public.order_request_revisions
for all
to authenticated
using (public.is_juan_admin())
with check (public.is_juan_admin());

grant select,insert,update,delete on public.order_request_revisions to authenticated;

create index if not exists order_request_revisions_order_idx
on public.order_request_revisions(order_id,created_at desc);

create index if not exists incoming_orders_conversion_lock_idx
on public.incoming_orders(conversion_lock)
where conversion_lock is not null;

update public.incoming_orders
set original_snapshot = jsonb_build_object(
  'items', coalesce(items,'[]'::jsonb),
  'subtotal', subtotal,
  'discount_amount', coalesce(discount_amount,0),
  'rush_fee', rush_fee,
  'total', total,
  'deadline', deadline
)
where original_snapshot = '{}'::jsonb;
